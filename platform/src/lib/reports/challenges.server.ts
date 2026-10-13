import { z } from "zod";
import { ApiError } from "../api-error";
import type { ReportQuery } from "./contracts";
import type { ResolvedReportPeriod } from "./periods";
import { chunks, readPages, metric, unavailable, refineReport, REPORT_MAX_ROWS, type ReportDB, type ReportPerson, type ReportDomain, type Coverage } from "./read.server";

const attemptSchema = z.object({ id: z.string(), user_id: z.string(), quiz_id: z.string(), score_percentage: z.number().min(0).max(100), passed: z.boolean(), completed_at: z.iso.datetime({ offset: true }),
  snapshot: z.record(z.string(), z.unknown()).nullable(), quiz_revision: z.number().int().positive().nullable(), scoring_version: z.number().int().positive(), snapshot_status: z.enum(["complete", "unavailable"]), correct_count: z.number().int().nonnegative().nullable(), question_count: z.number().int().positive().nullable() });
export async function challengesReport(db: ReportDB, people: ReportPerson[], query: ReportQuery, period: ResolvedReportPeriod): Promise<ReportDomain> {
  if (query.challengeId) {
    const allowed = await db.from("academy_quizzes").select("id,target_audience").eq("id", query.challengeId).maybeSingle();
    if (allowed.error) throw new ApiError("Desafio indisponível.", 503);
    if (!allowed.data || allowed.data.target_audience !== "internal") throw new ApiError("Desafio fora do conjunto interno autorizado.", 403);
  }
  const rows = [];
  for (const ids of chunks(people.map(person => person.id))) {
    rows.push(...await readPages((start, end) => {
      let builder = db.from("academy_quiz_attempts").select("id,user_id,quiz_id,score_percentage,passed,completed_at,snapshot,quiz_revision,scoring_version,snapshot_status,correct_count,question_count").in("user_id", ids).gte("completed_at", period.startInclusive).lt("completed_at", period.endExclusive);
      if (query.challengeId) builder = builder.eq("quiz_id", query.challengeId);
      return builder.order("id").range(start, end);
    }));
    if (rows.length > REPORT_MAX_ROWS) refineReport();
  }
  const parsed = z.array(attemptSchema).safeParse(rows);
  if (!parsed.success) throw new ApiError("Tentativas de desafios inválidas.", 503);
  const internalIds = new Set<string>();
  for (const ids of chunks([...new Set(parsed.data.map(row => row.quiz_id))])) {
    const quizzes = await readPages((start, end) => db.from("academy_quizzes").select("id").in("id", ids).eq("target_audience", "internal").order("id").range(start, end));
    for (const quiz of quizzes) internalIds.add(quiz.id);
  }
  parsed.data = parsed.data.filter(row => row.snapshot?.target_audience === "internal" || (row.snapshot?.target_audience !== "client" && internalIds.has(row.quiz_id)));
  const unique = new Map(parsed.data.map(row => [JSON.stringify([row.user_id, row.quiz_id]), row]));
  if (unique.size !== parsed.data.length) throw new ApiError("Há mais de uma tentativa oficial por edição de desafio.", 503);
  const peopleById = new Map(people.map(person => [person.id, person]));
  const coverage: Coverage = { availability: "available", semantics: "period", observedFrom: period.startInclusive, observedUntil: period.endExclusive };
  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of parsed.data) { const total = totals.get(row.user_id) ?? { sum: 0, count: 0 }; total.sum += row.score_percentage; total.count++; totals.set(row.user_id, total); }
  const means = [...totals].map(([userId, total]) => ({ userId, average: total.sum / total.count }));
  const canReview = (row: z.infer<typeof attemptSchema>) => row.snapshot_status === "complete" && Array.isArray(row.snapshot?.questions) && row.snapshot.questions.length === row.question_count && row.correct_count !== null;
  return { coverage: { challenges: coverage, challengeReview: parsed.data.some(row => !canReview(row)) ? { ...coverage, availability: "partial", reason: "Tentativas legadas sem snapshot completo não permitem revisão detalhada." } : coverage },
    rows: parsed.data.map(row => { const person = peopleById.get(row.user_id)!; const reviewAvailable = canReview(row);
      return { type: "challenge", id: row.id, userId: row.user_id, name: person.name, department: person.department, challengeId: row.quiz_id,
        challengeTitle: typeof row.snapshot?.title === "string" ? row.snapshot.title : "Desafio (registro legado)", attemptId: row.id, completedAt: row.completed_at, passed: row.passed,
        revision: row.quiz_revision, scoringVersion: row.scoring_version, reviewAvailable, correctCount: reviewAvailable ? row.correct_count : null, questionCount: reviewAvailable ? row.question_count : null,
        metrics: [metric("challenge_score", row.score_percentage, "percent", coverage)] };
    }), kpis: [metric("challenge_attempts", parsed.data.length, "count", coverage), metric("challenge_participants", means.length, "count", coverage),
      metric("challenge_average", means.length ? means.reduce((sum, row) => sum + row.average, 0) / means.length : null, "percent", coverage, means.length),
      metric("challenge_participation_rate", null, "percent", unavailable("period", "Não existe snapshot do público departamental elegível por edição."))],
    series: [{ id: "person_challenge_scores", metricId: "challenge_average", points: means.map(row => ({ id: row.userId, userId: row.userId, label: peopleById.get(row.userId)!.name, value: row.average })) }],
  };
}
