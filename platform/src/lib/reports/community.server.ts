import { z } from "zod";
import { ApiError } from "../api-error";
import type { ResolvedReportPeriod } from "./periods";
import { chunks, readPages, metric, currentCoverage, refineReport, REPORT_MAX_RECORDS, type ReportDB, type ReportPerson, type ReportDomain, type Coverage } from "./read.server";
import { reportCollectedSince, historicalCoverage } from "./history.server";

const nullableId = z.string().nullable();
const commentSchema = z.object({ id: z.string(), article_id: z.string(), user_id: nullableId, created_at: z.iso.datetime({ offset: true }) });
const reactionSchema = z.object({ article_id: z.string(), user_id: nullableId, reaction: z.enum(["like", "hype"]) });
const eventSchema = reactionSchema.extend({ id: z.string(), author_id: nullableId, occurred_at: z.iso.datetime({ offset: true }) });
function parse<T>(schema: z.ZodType<T>, rows: unknown): T {
  const parsed = schema.safeParse(rows); if (!parsed.success) throw new ApiError("Registros de comunidade inválidos.", 503); return parsed.data;
}
export async function communityReport(db: ReportDB, people: ReportPerson[], period: ResolvedReportPeriod): Promise<ReportDomain> {
  const since = await reportCollectedSince(db), ids = people.map(person => person.id);
  let records = 0;
  async function load(table: string, columns: string, field: string, selected: string[], orders: string[], time?: string, active = false) {
    const rows = [];
    for (const batch of chunks(selected)) {
      rows.push(...await readPages((start, end) => {
        let builder = db.from(table).select(columns).in(field, batch);
        if (time) builder = builder.gte(time, period.startInclusive).lt(time, period.endExclusive);
        if (active) builder = builder.eq("active", true);
        for (const order of orders) builder = builder.order(order);
        return builder.range(start, end);
      }));
      if (records + rows.length > REPORT_MAX_RECORDS) refineReport();
    }
    records += rows.length;
    return rows;
  }
  const metadata = parse(z.array(z.object({ article_id: z.string(), author_id: nullableId })), await load("academy_community_articles", "article_id,author_id", "author_id", ids, ["article_id"]));
  const articleIds = metadata.map(row => row.article_id), owners = new Map(metadata.map(row => [row.article_id, row.author_id]));
  const publications = parse(z.array(z.object({ article_id: z.string(), author_id: nullableId, first_published_at: z.iso.datetime({ offset: true }), origin: z.enum(["legacy_reward", "prospective"]) })),
    await load("academy_report_publications", "article_id,author_id,first_published_at,origin", "author_id", ids, ["article_id"], "first_published_at"));
  const commentsMade = parse(z.array(commentSchema), await load("academy_community_comments", "id,article_id,user_id,created_at", "user_id", ids, ["id"], "created_at"));
  const commentsReceived = parse(z.array(commentSchema), await load("academy_community_comments", "id,article_id,user_id,created_at", "article_id", articleIds, ["id"], "created_at"));
  const activationCoverage = historicalCoverage(period, since);
  const made = activationCoverage.availability === "unavailable" ? [] : parse(z.array(eventSchema), await load("academy_report_reactions", "id,article_id,user_id,author_id,reaction,occurred_at", "user_id", ids, ["id"], "occurred_at", true));
  const received = activationCoverage.availability === "unavailable" ? [] : parse(z.array(eventSchema), await load("academy_report_reactions", "id,article_id,user_id,author_id,reaction,occurred_at", "author_id", ids, ["id"], "occurred_at", true));
  if (received.some(row => row.user_id === null)) {
    activationCoverage.availability = "partial";
    activationCoverage.reason = [activationCoverage.reason, "Contas excluídas deixam atores sem identidade; deduplicação recebida representa somente o mínimo comprovado."].filter(Boolean).join(" ");
  }
  const activeMade = parse(z.array(reactionSchema), await load("academy_community_reactions", "article_id,user_id,reaction", "user_id", ids, ["article_id", "user_id", "reaction"], undefined, true));
  const activeReceived = parse(z.array(reactionSchema), await load("academy_community_reactions", "article_id,user_id,reaction", "article_id", articleIds, ["article_id", "user_id", "reaction"], undefined, true));
  const publicationCoverage = historicalCoverage(period, since, true);
  const commentCoverage: Coverage = { availability: "partial", semantics: "period", observedFrom: null, observedUntil: period.endExclusive, reason: "Contagem dos comentários persistidos por created_at, inclusive sem recompensa. Exclusões por moderação podem remover registros históricos." };
  const current = currentCoverage();
  const output = people.map(person => {
    const values: Record<string, number | null> = {
      publications: 0, comments_made: 0, comments_received: 0,
    };
    for (const kind of ["like", "hype"] as const) {
      values[`${kind}_made`] = activationCoverage.availability === "unavailable" ? null : 0;
      values[`${kind}_received`] = activationCoverage.availability === "unavailable" ? null : 0;
      values[`${kind}_active_made`] = 0; values[`${kind}_active_received`] = 0;
    }
    return { person, values };
  });
  const byUser = new Map(output.map(row => [row.person.id, row.values]));
  const add = (userId: string | null | undefined, id: string) => { const values = userId ? byUser.get(userId) : undefined; if (values && typeof values[id] === "number") values[id]! += 1; };
  for (const row of new Map(publications.map(row => [row.article_id, row])).values()) add(row.author_id, "publications");
  for (const row of new Map(commentsMade.map(row => [row.id, row])).values()) add(row.user_id, "comments_made");
  for (const row of new Map(commentsReceived.map(row => [row.id, row])).values()) { const owner = owners.get(row.article_id); if (row.user_id !== owner) add(owner, "comments_received"); }
  const addEvents = (rows: typeof made, receiving: boolean) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const userId = receiving ? row.author_id : row.user_id;
      const key = JSON.stringify([userId, row.user_id, row.article_id, row.reaction]);
      if (seen.has(key) || (receiving && row.user_id === userId)) continue;
      seen.add(key); add(userId, `${row.reaction}_${receiving ? "received" : "made"}`);
    }
  };
  addEvents(made, false); addEvents(received, true);
  for (const row of activeMade) add(row.user_id, `${row.reaction}_active_made`);
  for (const row of activeReceived) { const owner = owners.get(row.article_id); if (owner !== row.user_id) add(owner, `${row.reaction}_active_received`); }
  const coverageFor = (id: string) => id === "publications" ? publicationCoverage : id.startsWith("comments_") ? commentCoverage : id.includes("_active_") ? current : activationCoverage;
  const metricIds = ["publications", "comments_made", "comments_received", "like_made", "like_received", "hype_made", "hype_received", "like_active_made", "like_active_received", "hype_active_made", "hype_active_received"];
  return { collectedSince: since, coverage: { publications: publicationCoverage, comments: commentCoverage, reactions: activationCoverage, activeReactions: current },
    rows: output.map(row => ({ type: "community", id: row.person.id, userId: row.person.id, name: row.person.name, department: row.person.department,
      metrics: metricIds.map(id => metric(id, row.values[id], "count", coverageFor(id))) })),
    kpis: metricIds.map(id => metric(id, coverageFor(id).availability === "unavailable" ? null : output.reduce((sum, row) => sum + (row.values[id] ?? 0), 0), "count", coverageFor(id))),
    series: [{ id: "person_publications", metricId: "publications", points: output.map(row => ({ id: row.person.id, userId: row.person.id, label: row.person.name, value: row.values.publications })) }],
  };
}
