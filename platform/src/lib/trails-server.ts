import { timingSafeEqual } from "node:crypto";
import { ApiError, type Profile, type database } from "./pilot-server";
import { courseSchema, normalizeStoredCourseLevel, type AcademyState, type Course } from "./model";
import { alertPolicySchema, DEFAULT_ALERT_POLICY, canManagePerson, deadlineKind, daysUntil, formatTrailDate, localDay, trailCompletion, trailCommandSchema, type Assignment, type TrailNotice, type TrailsData, type AlertPolicy } from "./trails";

type DB = ReturnType<typeof database>;
type Row = Record<string, any>;
const person = (p: Profile) => ({ ...p, audience: p.audience ?? "internal", managerId: p.manager_id ?? "" });
export function manages(actor: Profile, target: Profile) { return actor.audience !== "client" && canManagePerson(person(actor), person(target)); }
async function rows(db: DB, table: string, columns: string, order = "id") {
  const all: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(table).select(columns);
    for (const field of order.split(",")) query = query.order(field);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new ApiError("Trilhas indisponíveis. Confira a migração de trilhas ou tente novamente.", 503);
    all.push(...(data ?? [])); if ((data?.length ?? 0) < 1000) return all;
  }
}
export async function trailContext(db: DB) {
  const [profiles, resources, assignments, policies, presence, daily, progress, attempts, notices, trails, config] = await Promise.all([
    rows(db, "academy_profiles", "id,name,email,department,manager_id,role,status,audience,created_at"),
    rows(db, "academy_resources", "id,kind,published"), rows(db, "academy_trail_assignments", "*"),
    rows(db, "academy_trail_policies", "*", "owner_id"), rows(db, "academy_presence", "user_id,last_access_at", "user_id"),
    rows(db, "academy_engagement_daily", "user_id,day,active_seconds", "user_id,day"),
    rows(db, "academy_progress", "user_id,course_id,version,lesson_id,done,position", "user_id,course_id,version,lesson_id"),
    rows(db, "academy_attempts", "id,user_id,course_id,version,quiz_id,status,snapshot"),
    rows(db, "academy_learning_notices", "*"), rows(db, "academy_trails", "*"),
    db.from("academy_engagement_config").select("collected_since").single(),
  ]);
  if (config.error) throw new ApiError("Histórico de presença indisponível.", 503);
  const courses: Course[] = resources.flatMap(r => {
    if (r.kind !== "course" || !r.published || r.published.audience === "client") return [];
    const parsed = courseSchema.safeParse({ ...r.published, level: normalizeStoredCourseLevel(r.published.level) });
    return parsed.success ? [parsed.data] : [];
  });
  const completed = new Map<string, Record<string, string[]>>();
  for (const p of progress) if (p.done && courses.some(c => c.id === p.course_id && c.version === p.version)) {
    const map = completed.get(p.user_id) ?? {}; (map[p.course_id] ??= []).push(p.lesson_id); completed.set(p.user_id, map);
  }
  const stateFor = (userId: string) => ({ completed: completed.get(userId) ?? {}, attempts: attempts.filter(a => a.user_id === userId).map(a => ({ id: a.id, userId, courseId: a.course_id, courseVersion: a.version, quizId: a.quiz_id, status: a.status, snapshot: a.snapshot })) }) as unknown as AcademyState;
  const mapped: Assignment[] = assignments.map(a => ({
    id: a.id, trailId: a.trail_id, userId: a.user_id, assignedBy: a.assigned_by, title: a.title,
    courseIds: a.course_ids, dueDate: a.due_date, learnerDays: a.learner_days, managerDays: a.manager_days,
    active: a.active, revision: a.revision, createdAt: a.created_at,
    ...trailCompletion(a.course_ids, courses, stateFor(a.user_id), a.user_id),
  }));
  return { profiles: profiles as Profile[], profileDates: profiles, assignments: mapped, policies, presence, daily, progress, notices, trails, courses, stateFor, collectedSince: config.data.collected_since as string };
}
export type TrailContext = Awaited<ReturnType<typeof trailContext>>;
export function policyFor(context: TrailContext, ownerId: string): AlertPolicy {
  const result = alertPolicySchema.safeParse(context.policies.find(p => p.owner_id === ownerId)?.data ?? {});
  return result.success ? result.data : DEFAULT_ALERT_POLICY;
}
type Candidate = { key: string; userId: string; subjectId: string; assignmentId: string | null; kind: string; title: string; message: string; link: string; popup: boolean; email: boolean; repeatDays: number; discord?: boolean; discordWeekdays?: number[] };
export function alertCandidates(context: TrailContext, subject: Profile, now = new Date()): Candidate[] {
  if (subject.status !== "active" || subject.audience === "client") return [];
  const today = localDay(now), result: Candidate[] = [];
  const currentManager = context.profiles.find(p => p.id === subject.manager_id && p.status === "active" && p.audience !== "client" && p.role !== "student")
    ?? (!subject.manager_id ? context.profiles.find(p => p.id !== subject.id && p.role === "manager" && manages(p, subject)) : undefined);
  const add = (value: Omit<Candidate, "subjectId">) => {
    const ownerId = value.assignmentId ? context.assignments.find(a => a.id === value.assignmentId)?.assignedBy : currentManager?.id;
    const policy = ownerId ? policyFor(context, ownerId) : DEFAULT_ALERT_POLICY;
    result.push({ ...value, subjectId: subject.id, discord: policy.discord, discordWeekdays: policy.discordWeekdays });
  };
  for (const a of context.assignments.filter(a => a.userId === subject.id && a.active && !a.complete)) {
    const policy = policyFor(context, a.assignedBy);
    add({ key: `assigned:${a.id}`, userId: subject.id, assignmentId: a.id, kind: "assigned", title: `Sua trilha: ${a.title}`, message: `Você tem ${a.totalCourses} cursos para concluir até ${a.dueDate.split("-").reverse().join("/")}.`, link: "/aprender/trilhas", popup: policy.popup, email: false, repeatDays: policy.repeatDays });
    const fallback = context.profiles.find(p => p.id === a.assignedBy && p.status === "active" && p.audience !== "client" && p.role !== "student" && manages(p, subject));
    for (const recipient of [subject, currentManager ?? fallback].filter((p): p is Profile => !!p)) {
      const isManager = recipient.id !== subject.id;
      const kind = deadlineKind(a, isManager, today); if (!kind) continue;
      add({ key: `${kind}:${a.id}:${a.revision}:${recipient.id}`, userId: recipient.id, assignmentId: a.id, kind,
        title: kind === "overdue" ? "Prazo da trilha vencido" : "Prazo da trilha se aproxima",
        message: `${isManager ? subject.name + ": " : ""}a trilha ${a.title} tem prazo de conclusão em ${formatTrailDate(a.dueDate)}. Confira os cursos pendentes.`,
        link: isManager ? "/equipe/trilhas" : "/aprender/trilhas", popup: policy.popup, email: policy.email, repeatDays: policy.repeatDays });
    }
  }
  // Only observed presence counts; do not invent inactivity before collection/registration.
  if (currentManager) {
    const policy = policyFor(context, currentManager.id);
    const registration = context.profileDates.find(p => p.id === subject.id)?.created_at ?? context.collectedSince;
    const observationStart = new Date(Math.max(Date.parse(registration), Date.parse(context.collectedSince)));
    const last = context.presence.find(p => p.user_id === subject.id)?.last_access_at;
    const absentDays = daysUntil(today, localDay(new Date(last ?? observationStart)));
    const windowStart = new Date(now.getTime() - (policy.lowAccessWindow - 1) * 86400000);
    const activeDays = context.daily.filter(d => d.user_id === subject.id && d.day >= localDay(windowStart) && d.day <= today).length;
    const inactive = policy.inactivityEnabled && absentDays >= policy.inactivityDays;
    const low = policy.lowAccessEnabled && now.getTime() - observationStart.getTime() >= policy.lowAccessWindow * 86400000 && activeDays < policy.lowAccessMinDays;
    const kind = inactive ? "inactive" : low ? "low-access" : null;
    if (kind) for (const recipient of [subject, currentManager]) add({ key: `${kind}:${subject.id}:${recipient.id}:${inactive ? policy.inactivityDays : policy.lowAccessWindow + "-" + policy.lowAccessMinDays}`, userId: recipient.id, assignmentId: null, kind,
      title: inactive ? "Vamos retomar o aprendizado?" : "Acompanhamento de frequência",
      message: `${recipient.id === subject.id ? "Você" : subject.name} ${inactive ? `ficou pelo menos ${policy.inactivityDays} dias sem acesso registrado` : `ficou abaixo da meta de ${policy.lowAccessMinDays} dias com acesso em um período de ${policy.lowAccessWindow} dias`}. Confira os cursos e as trilhas pendentes.`,
      link: recipient.id === subject.id ? "/aprender/trilhas" : "/equipe/trilhas", popup: policy.popup, email: policy.email, repeatDays: policy.repeatDays });
    if (policy.resumeEnabled) {
      const started = context.courses.find(c => c.status === "published" && (c.availability ?? "active") === "active" && context.progress.some(p => p.user_id === subject.id && p.course_id === c.id && p.version === c.version && (p.done || Number(p.position) > 0)) && !trailCompletion([c.id], context.courses, context.stateFor(subject.id), subject.id).complete);
      if (started) add({ key: `resume:${subject.id}:${started.id}`, userId: subject.id, assignmentId: null, kind: "resume", title: "Continue de onde parou", message: `Retome ${started.title} e avance no seu aprendizado.`, link: `/aprender/${encodeURIComponent(started.id)}/aula`, popup: policy.popup, email: false, repeatDays: policy.repeatDays });
    }
  }
  return result;
}
export async function evaluateAlerts(db: DB, context: TrailContext, subjects: Profile[], now = new Date()) {
  let created = 0;
  for (const subject of subjects) {
    const candidates = alertCandidates(context, subject, now);
    const previous = context.notices.filter(n => n.subject_id === subject.id && n.kind !== "manual");
    const stale = previous.filter(n => !n.resolved_at && !candidates.some(c => n.dedupe_key.startsWith(c.key + ":")));
    if (stale.length) {
      const { error } = await db.from("academy_learning_notices").update({ resolved_at: now.toISOString() }).in("id", stale.map(n => n.id));
      if (error) throw new ApiError("Não foi possível atualizar os avisos.", 503);
      await db.from("academy_learning_notices").update({ email_status: "cancelled" }).in("id", stale.map(n => n.id)).in("email_status", ["pending", "failed"]);
      await db.from("academy_learning_notices").update({ discord_status: "cancelled" }).in("id", stale.map(n => n.id)).in("discord_status", ["pending", "failed", "unlinked"]);
    }
    for (const c of candidates) {
      const live = previous.filter(n => !n.resolved_at && n.dedupe_key.startsWith(c.key + ":"));
      for (const n of live) {
        const emailStatus = !c.email && ["pending", "failed"].includes(n.email_status) ? "cancelled" : c.email && n.email_status === "disabled" ? "pending" : n.email_status;
        if (n.popup !== c.popup || emailStatus !== n.email_status) {
          const { error } = await db.from("academy_learning_notices").update({ popup: c.popup, email_status: emailStatus }).eq("id", n.id).eq("email_status", n.email_status);
          if (error) throw new ApiError("Não foi possível aplicar as preferências de avisos.", 503);
        }
        const discordStatus = c.discord && (n.discord_status ?? "disabled") === "disabled" ? "pending" : !c.discord && ["pending", "failed", "unlinked"].includes(n.discord_status) ? "cancelled" : n.discord_status;
        if (discordStatus && discordStatus !== n.discord_status) await db.from("academy_learning_notices").update({ discord_status: discordStatus }).eq("id", n.id).eq("discord_status", n.discord_status ?? "disabled");
      }
      if (!c.popup && !c.email && !c.discord) continue;
      const matching = previous.filter(n => n.dedupe_key.startsWith(c.key + ":")).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (matching.length && (c.kind === "assigned" || now.getTime() - Date.parse(matching[0].created_at) < c.repeatDays * 86400000)) continue;
      const key = `${c.key}:${Math.floor(Date.parse(localDay(now)) / (c.repeatDays * 86400000))}`;
      const { data, error } = await db.from("academy_learning_notices").upsert({ dedupe_key: key, user_id: c.userId, subject_id: c.subjectId, assignment_id: c.assignmentId, kind: c.kind, title: c.title, message: c.message, link: c.link, popup: c.popup, email_status: c.email ? "pending" : "disabled", discord_status: c.discord ? "pending" : "disabled", created_at: now.toISOString() }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
      if (error) throw new ApiError("Não foi possível preparar os avisos.", 503); created += data?.length ?? 0;
    }
  }
  return created;
}
export function mapNotice(n: Row): TrailNotice { return { id: n.id, userId: n.user_id, subjectId: n.subject_id, assignmentId: n.assignment_id, kind: n.kind, title: n.title, message: n.message, link: n.link, popup: n.popup, createdAt: n.created_at, seenAt: n.seen_at, resolvedAt: n.resolved_at, emailStatus: n.email_status, emailError: n.email_error, emailSentAt: n.email_sent_at, discordStatus: n.discord_status ?? "disabled", discordError: n.discord_error, discordSentAt: n.discord_sent_at, discordConfirmedAt: n.discord_confirmed_at }; }
export async function readTrails(db: DB, me: Profile): Promise<TrailsData> {
  if (me.audience === "client") throw new ApiError("Trilhas disponíveis para colaboradores internos.", 403);
  const context = await trailContext(db);
  const subjects = context.profiles.filter(p => p.id === me.id || manages(me, p));
  await evaluateAlerts(db, context, subjects);
  const ids = new Set(subjects.map(p => p.id));
  const notices = await rows(db, "academy_learning_notices", "*");
  return { trails: context.trails.filter(t => me.role !== "student" || context.assignments.some(a => a.userId === me.id && a.trailId === t.id)).map(t => ({ ...t.data, ownerId: t.owner_id, revision: t.revision })),
    assignments: context.assignments.filter(a => ids.has(a.userId)),
    notices: notices.filter(n => n.user_id === me.id || me.role !== "student" && ids.has(n.subject_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 500).map(mapNotice),
    policy: policyFor(context, me.id), policyRevision: context.policies.find(p => p.owner_id === me.id)?.revision ?? 0,
    emailConfigured: !!(process.env.RESEND_API_KEY && process.env.LEARNING_EMAIL_FROM && process.env.NEXT_PUBLIC_SITE_URL && process.env.CRON_SECRET) };
}
export async function mutateTrails(db: DB, me: Profile, input: unknown) {
  const parsed = trailCommandSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message || "Revise os campos enviados.");
  if (me.audience === "client") throw new ApiError("Trilhas disponíveis apenas para colaboradores internos.", 403);
  if (parsed.data.type !== "ack" && me.role === "student") throw new ApiError("Somente a gestão pode administrar trilhas e avisos.", 403);
  const { error } = await db.rpc("academy_trail_mutate", { actor: me.id, command: parsed.data });
  if (error) throw new ApiError(error.code === "23505" ? "Um colaborador já tem essa trilha ativa. Altere a atribuição existente." : error.message, error.code === "42501" ? 403 : 409);
}
export function validCronToken(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  return !!secret && !!provided && Buffer.byteLength(secret) === Buffer.byteLength(provided) && timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
}
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export async function dispatchEmails(db: DB, context: TrailContext) {
  const key = process.env.RESEND_API_KEY, from = process.env.LEARNING_EMAIL_FROM, site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !from || !site) return { sent: 0, failed: 0, configured: false };
  const base = new URL(site); if (base.protocol !== "https:") throw new ApiError("Endereço de envio inválido.", 503);
  const stamp = new Date();
  // Retry a lease only inside the provider's 24h idempotency window. Older uncertain
  // deliveries require inspection instead of sending the same message again blindly.
  const safeWindow = new Date(stamp.getTime() - 23 * 3600000).toISOString();
  await db.from("academy_learning_notices").update({ email_status: "uncertain", email_error: "Entrega não confirmada; confira o provedor antes de reenviar." }).eq("email_status", "sending").lt("email_lease_at", safeWindow);
  await db.from("academy_learning_notices").update({ email_status: "pending" }).eq("email_status", "sending").gte("email_lease_at", safeWindow).lt("email_lease_at", new Date(stamp.getTime() - 15 * 60000).toISOString());
  const pending = await db.from("academy_learning_notices").select("*").is("resolved_at", null).in("email_status", ["pending", "failed"]).lt("email_attempts", 5).order("created_at").limit(50);
  if (pending.error) throw new ApiError("Fila de e-mails indisponível.", 503);
  let sent = 0, failed = 0;
  for (const n of pending.data ?? []) {
    if (Date.now() - stamp.getTime() > 40000) break;
    const recipient = context.profiles.find(p => p.id === n.user_id && p.status === "active" && p.audience !== "client");
    const subject = context.profiles.find(p => p.id === n.subject_id);
    const candidate = subject && alertCandidates(context, subject, stamp).find(c => n.dedupe_key.startsWith(c.key + ":") && c.email && c.userId === n.user_id);
    if (!recipient?.email || !candidate) {
      await db.from("academy_learning_notices").update({ email_status: "cancelled", resolved_at: stamp.toISOString() }).eq("id", n.id).neq("email_status", "sent"); continue;
    }
    const claim = await db.from("academy_learning_notices").update({ email_status: "sending", email_lease_at: stamp.toISOString(), email_attempts: n.email_attempts + 1 }).eq("id", n.id).eq("email_status", n.email_status).is("resolved_at", null).select("id");
    if (claim.error) throw new ApiError("Não foi possível reservar o envio.", 503);
    if (!claim.data?.length) continue;
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `learning-${n.id}` }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ from, to: [recipient.email], subject: n.title, text: `${n.message}\n\nAcesse a Academia DeMaria: ${new URL(n.link, base).href}`, html: `<p>${escapeHtml(n.message)}</p><p><a href="${escapeHtml(new URL(n.link, base).href)}">Abrir Academia DeMaria</a></p>` }) });
      if (!response.ok) throw new Error(`Provedor recusou o envio (HTTP ${response.status}).`);
      const saved = await db.from("academy_learning_notices").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", n.id).eq("email_status", "sending");
      if (saved.error) throw new Error("Entrega aceita; registro pendente de confirmação."); sent++;
    } catch (e) {
      const rejected = e instanceof Error && e.message.startsWith("Provedor");
      await db.from("academy_learning_notices").update({ email_status: rejected ? "failed" : "uncertain", email_error: rejected ? e.message : "Entrega não confirmada; confira o provedor antes de reenviar." }).eq("id", n.id).eq("email_status", "sending"); failed++;
    }
  }
  return { sent, failed, configured: true };
}
