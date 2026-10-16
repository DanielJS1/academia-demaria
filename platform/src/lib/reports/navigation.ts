import { reportQuerySchema, resolveReportQuery, type ReportQuery } from "./contracts";
export type ReportLocation = { query: ReportQuery; format: "table" | "bars" | "donut"; metric?: string; page: number; order: string; direction: "asc" | "desc"; rank: "top" | "bottom" };
const views = { geral: "overview", presenca: "presence", aprendizagem: "learning", desafios: "challenges", comunidade: "community", xp: "xp" } as const;
const formats = { tabela: "table", barras: "bars", rosca: "donut" } as const;
export const defaultReportLocation = (): ReportLocation => ({ query: { view: "overview", population: "active", period: { kind: "last30" } }, format: "bars", page: 1, order: "name", direction: "asc", rank: "top" });
export function normalizeReportQuery(input: unknown): ReportQuery {
  const query = reportQuerySchema.parse(input);
  if (query.view === "learning") {
    query.learningDetail ??= "courses"; query.learningMode ??= query.learningDetail === "assessments" ? "activity" : "current";
    query.learningScope ??= query.learningDetail === "assessments" ? "catalog" : "assigned";
    if (query.learningDetail === "assessments") query.attemptPolicy ??= "latest";
  }
  return query;
}
export function readReportLocation(params: URLSearchParams, now = new Date()): ReportLocation {
  const known = ["visao", "periodo", "inicio", "fim", "pessoa", "departamento", "curso", "desafio", "status", "modo", "detalhe", "escopo", "tentativas", "formato", "indicador", "pagina", "ordem", "direcao", "ranking"];
  for (const key of params.keys()) if (!known.includes(key) || params.getAll(key).length !== 1) throw new Error("Filtros da URL inválidos. Restaure os filtros para continuar.");
  const get = (key: string) => params.get(key) ?? undefined;
  const map = <T extends string>(key: string, values: Record<string, T>): T | undefined => { const value = get(key); if (!value) return undefined; if (!values[value]) throw new Error("Filtro incompatível na URL."); return values[value]; };
  const view = map("visao", views) ?? "overview";
  const period = get("periodo") ?? (get("inicio") || get("fim") ? "custom" : "30");
  if (!["7", "30", "custom"].includes(period)) throw new Error("Período inválido.");
  const query = normalizeReportQuery({ view, period: period === "custom" ? { kind: "custom", startDate: get("inicio"), endDate: get("fim") } : { kind: period === "7" ? "last7" : "last30" },
    personId: get("pessoa"), department: get("departamento"), courseId: get("curso"), challengeId: get("desafio"), status: get("status"),
    learningMode: map("modo", { atual: "current", periodo: "activity" }), learningDetail: map("detalhe", { cursos: "courses", avaliacoes: "assessments" }), learningScope: map("escopo", { atribuidos: "assigned", catalogo: "catalog" }), attemptPolicy: map("tentativas", { ultima: "latest", melhor: "best", todas: "all" }) });
  resolveReportQuery(query, now);
  if (query.learningMode === "activity" && query.learningDetail === "courses" && query.status && query.status !== "completed") throw new Error("Atividade por curso mostra somente eventos de conclusão.");
  const page = Number(get("pagina") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 400) throw new Error("Página inválida.");
  const order = get("ordem") ?? "name", metric = get("indicador");
  if (![order, metric ?? "valid"].every(value => /^[a-zA-Z_]{1,60}$/.test(value))) throw new Error("Indicador ou ordenação inválida.");
  return { query, page, order, metric, format: map("formato", formats) ?? "bars", direction: map("direcao", { asc: "asc", desc: "desc" }) ?? "asc", rank: map("ranking", { maiores: "top", menores: "bottom" }) ?? "top" };
}
export function reportLocationParams(location: ReportLocation): URLSearchParams {
  const params = new URLSearchParams(); const q = location.query;
  params.set("visao", Object.keys(views).find(key => views[key as keyof typeof views] === q.view)!);
  params.set("periodo", q.period.kind === "custom" ? "custom" : q.period.kind === "last7" ? "7" : "30");
  if (q.period.kind === "custom") { params.set("inicio", q.period.startDate); params.set("fim", q.period.endDate); }
  for (const [key, value] of Object.entries({ pessoa: q.personId, departamento: q.department, curso: q.courseId, desafio: q.challengeId, status: q.status,
    modo: q.learningMode === undefined ? undefined : q.learningMode === "current" ? "atual" : "periodo", detalhe: q.learningDetail === undefined ? undefined : q.learningDetail === "courses" ? "cursos" : "avaliacoes", escopo: q.learningScope === undefined ? undefined : q.learningScope === "assigned" ? "atribuidos" : "catalogo", tentativas: q.attemptPolicy === undefined ? undefined : { latest: "ultima", best: "melhor", all: "todas" }[q.attemptPolicy] })) if (value) params.set(key, value);
  params.set("formato", Object.keys(formats).find(key => formats[key as keyof typeof formats] === location.format)!);
  if (location.metric) params.set("indicador", location.metric);
  if (location.page > 1) params.set("pagina", String(location.page));
  if (location.order !== "name") params.set("ordem", location.order);
  if (location.direction !== "asc") params.set("direcao", location.direction);
  if (location.rank !== "top") params.set("ranking", "menores");
  return params;
}
export function changeReportView(location: ReportLocation, view: ReportQuery["view"]): ReportLocation {
  return { ...defaultReportLocation(), query: normalizeReportQuery({ view, population: "active", period: location.query.period, department: location.query.department, personId: location.query.personId }) };
}
