import { ZodError } from "zod";
import { authenticate, ApiError, canAccessCourse, type Profile, type database } from "./pilot-server";
import { courseSchema, normalizeStoredCourseLevel } from "./model";
import { canTransitionLive, chatInputSchema, highlightsInputSchema, liveEventInputSchema, liveEventSchema, liveMessageSchema, liveHref, type LiveEvent, type Highlight } from "./live-events";

type Db = ReturnType<typeof database>;
const noStore = { "Cache-Control": "no-store, private" };
export function liveResponse(value: unknown) { return Response.json(value, { headers: noStore }); }
export function liveFailure(error: unknown) {
  const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof ApiError ? error.message : "Não foi possível acessar as aulas ao vivo. Tente novamente.";
  return Response.json({ error: message }, { status: error instanceof ApiError ? error.status : error instanceof ZodError ? 400 : 503, headers: noStore });
}
export function ensureLive(result: { error: { message: string; code?: string } | null }) {
  if (!result.error) return;
  const { message, code } = result.error;
  if (code === "40001") throw new ApiError("Outra pessoa atualizou este conteúdo. Recarregue antes de salvar.", 409);
  if (message.includes("Aguarde")) throw new ApiError("Aguarde 3 segundos antes de enviar outra mensagem.", 429);
  if (code === "P0001") throw new ApiError(message, 400);
  throw new ApiError("Não foi possível acessar as aulas ao vivo. Tente novamente.", 503);
}
export async function liveAccount(db: Db, me: Profile) {
  if (me.audience !== "client") return;
  if (!me.cartorio_id) throw new ApiError("Seu acesso precisa estar vinculado a um cartório ativo.", 403);
  const result = await db.from("academy_cartorios").select("status").eq("id", me.cartorio_id).maybeSingle();
  ensureLive(result);
  if (result.data?.status !== "active") throw new ApiError("O acesso deste cartório está inativo.", 403);
}
export function accessibleLive(event: LiveEvent, me: Profile, admin = false) {
  if (admin && me.role === "admin") return true;
  return !["draft", "cancelled"].includes(event.status) && (event.audience === "both" || event.audience === (me.audience || "internal"));
}
function parseEvent(row: { id: string; document: unknown; version: number }) {
  return liveEventSchema.parse({ ...(row.document as object), id: row.id, version: row.version });
}
export async function listLive(db: Db, me: Profile, admin = false) {
  await liveAccount(db, me);
  let query = db.from("academy_live_events").select("id,document,version").order("created_at", { ascending: false });
  if (!admin || me.role !== "admin") query = query.not("document->>status", "in", '("draft","cancelled")').in("document->>audience", ["both", me.audience || "internal"]);
  const result = await query.limit(250); ensureLive(result);
  return (result.data || []).map(parseEvent).filter(event => accessibleLive(event, me, admin));
}
export async function requireLive(db: Db, me: Profile, id: string) {
  await liveAccount(db, me);
  const result = await db.from("academy_live_events").select("id,document,version").eq("id", id).maybeSingle(); ensureLive(result);
  if (!result.data) throw new ApiError("Aula ao vivo não encontrada.", 404);
  const event = parseEvent(result.data);
  if (!accessibleLive(event, me, true)) throw new ApiError("Esta aula não está disponível para seu perfil.", 403);
  return event;
}
export async function readHighlights(db: Db) {
  const result = await db.from("academy_home_highlights").select("items,version").eq("id", "home").maybeSingle(); ensureLive(result);
  return highlightsInputSchema.parse(result.data || { items: [], version: 0 });
}
export async function resolveHighlights(db: Db, me: Profile, events: LiveEvent[], items: Highlight[]) {
  const now = Date.now();
  const candidates = items.filter(item => (item.audience === "both" || item.audience === (me.audience || "internal")) && (!item.startsAt || Date.parse(item.startsAt) <= now) && (!item.endsAt || Date.parse(item.endsAt) > now));
  if (!candidates.length) return [];
  const needsState = candidates.some(item => ["course", "lesson", "article"].includes(item.kind));
  const [resources, quizzes] = await Promise.all([
    needsState ? db.from("academy_resources").select("id,kind,published").in("id", candidates.filter(item => ["course", "lesson", "article"].includes(item.kind)).map(item => item.targetId)) : null,
    candidates.some(item => item.kind === "quiz") ? db.rpc("academy_list_periodic_quizzes", { actor: me.id }) : null,
  ]);
  if (resources) ensureLive(resources);
  if (quizzes) ensureLive(quizzes);
  const available = (quizzes?.data?.available || []) as { id: string }[];
  const resolved = await Promise.all(candidates.map(async item => {
    let href = "";
    if (item.kind === "announcement") href = item.href;
    if (item.kind === "live" && events.some(event => event.id === item.targetId)) href = liveHref(item.targetId);
    if (item.kind === "quiz" && available.some(quiz => quiz.id === item.targetId)) href = `/desafios/${encodeURIComponent(item.targetId)}`;
    const resource = resources?.data?.find(row => row.id === item.targetId);
    if (item.kind === "article" && me.audience !== "client" && resource?.kind === "article" && resource.published?.status === "published") href = `/conhecimento/${encodeURIComponent(item.targetId)}`;
    const parsed = resource?.kind === "course" && resource.published ? courseSchema.safeParse({ ...resource.published, level: normalizeStoredCourseLevel(resource.published.level) }) : null;
    const course = parsed?.success && await canAccessCourse(db, me, parsed.data) ? parsed.data : null;
    if (item.kind === "course" && course) href = `/aprender/${encodeURIComponent(course.id)}`;
    if (item.kind === "lesson" && course?.lessons.some(lesson => lesson.id === item.lessonId)) href = `/aprender/${encodeURIComponent(course.id)}/aula?aula=${encodeURIComponent(item.lessonId)}`;
    return href ? { ...item, href } : null;
  }));
  return resolved.filter((item): item is Highlight => item !== null);
}
export async function liveContext(request: Request, admin = false) {
  const context = await authenticate(request);
  if (admin && context.me.role !== "admin") throw new ApiError("Apenas administradores podem gerenciar este conteúdo.", 403);
  return context;
}
export async function saveLive(db: Db, me: Profile, value: unknown) {
  const input = liveEventInputSchema.parse(value);
  const previous = input.id ? await requireLive(db, me, input.id) : null;
  if (!canTransitionLive(previous?.status || "draft", input.status)) throw new ApiError("Esta mudança de etapa não é permitida. Use as ações da aula.");
  if (previous?.status === "live" && input.youtubeUrl !== previous.youtubeUrl) throw new ApiError("Encerre a transmissão antes de trocar o vídeo.");
  const result = await db.rpc("academy_save_live_event", { actor: me.id, payload: input }); ensureLive(result);
  return parseEvent(result.data);
}
export async function readLiveMessages(db: Db, id: string, before?: number) {
  let query = db.from("academy_live_messages").select("*").eq("event_id", id).order("seq", { ascending: false }).limit(101);
  if (before) query = query.lt("seq", before);
  const result = await query; ensureLive(result);
  const rows = result.data || [];
  return { messages: rows.slice(0, 100).reverse().map(row => liveMessageSchema.parse(row)), hasOlder: rows.length > 100 };
}
export async function changeLiveMessage(db: Db, me: Profile, id: string, value: unknown) {
  const input = chatInputSchema.parse(value);
  const event = await requireLive(db, me, id);
  if (input.action !== "send" && me.role !== "admin") throw new ApiError("Apenas administradores podem moderar o chat.", 403);
  if (input.action === "send" && (event.status !== "live" || !event.chatEnabled)) throw new ApiError("O chat está fechado. O histórico continua disponível.");
  const result = await db.rpc("academy_live_chat", { actor: me.id, event: id, payload: input }); ensureLive(result);
  return liveMessageSchema.parse(result.data);
}
