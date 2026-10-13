import type { database, Profile } from "../pilot-server";
import { ApiError } from "../api-error";
import { z } from "zod";
import { assertReportActor, scopeProfile, selectManagedPeople } from "./scope";
import type { ReportQuery, ReportMetric, ReportDataset } from "./contracts";

export type ReportDB = ReturnType<typeof database>;
export const REPORT_MAX_ROWS = 10_000;
export const REPORT_MAX_RECORDS = 200_000;
export const REPORT_BATCH = 500;
export function refineReport(): never { throw new ApiError("Consulta excede o limite de 10.000 linhas ou 200.000 registros de origem. Refine colaborador, curso, departamento ou período.", 422); }
export async function readPages<T>(page: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>, limit = REPORT_MAX_RECORDS): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += REPORT_BATCH) {
    const result = await page(offset, offset + REPORT_BATCH - 1);
    if (result.error) throw new ApiError("Fonte de relatório indisponível. Confira as migrações existentes ou tente novamente.", 503);
    rows.push(...(result.data ?? []));
    if (rows.length > limit) refineReport();
    if ((result.data?.length ?? 0) < REPORT_BATCH) return rows;
  }
}
export function chunks<T>(items: readonly T[], size = 100): T[][] {
  const result: T[][] = []; for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size)); return result;
}
const personSchema = z.object({ id: z.string(), name: z.string(), department: z.string(), manager_id: z.string().nullable(), status: z.enum(["active", "pending", "inactive"]), audience: z.enum(["internal", "client"]), created_at: z.iso.datetime({ offset: true }).nullable() });
export type ReportPerson = z.infer<typeof personSchema>;
export async function reportPeople(db: ReportDB, actor: Profile, query: ReportQuery) {
  try { assertReportActor(actor); } catch { throw new ApiError("Somente gestores internos ativos podem consultar relatórios.", 403); }
  const columns = "id,name,department,manager_id,status,audience,created_at";
  const base = () => db.from("academy_profiles").select(columns).eq("status", "active").eq("audience", "internal").neq("id", actor.id);
  const filterPerson = (builder: ReturnType<typeof base>) => {
    if (query.personId) builder = builder.eq("id", query.personId);
    if (query.department) builder = builder.ilike("department", `%${query.department.replace(/[\\%_]/g, value => `\\${value}`)}%`);
    return builder;
  };
  let candidates;
  if (actor.role === "admin") candidates = await readPages((start, end) => filterPerson(base()).order("id").range(start, end));
  else {
    const department = actor.department.trim().replace(/[\\%_]/g, value => `\\${value}`);
    const [direct, fallback] = await Promise.all([
      readPages((start, end) => filterPerson(base()).eq("manager_id", actor.id).order("id").range(start, end)),
      department ? readPages((start, end) => filterPerson(base()).is("manager_id", null).ilike("department", `%${department}%`).order("id").range(start, end)) : [],
    ]);
    candidates = [...direct, ...fallback];
  }
  if (candidates.length > REPORT_MAX_RECORDS) refineReport();
  const parsed = z.array(personSchema).safeParse(candidates);
  if (!parsed.success) throw new ApiError("Perfis de relatório inválidos.", 503);
  let people = selectManagedPeople(parsed.data.map(scopeProfile), actor);
  if (query.personId && !people.some(person => person.id === query.personId)) throw new ApiError("Colaborador fora da equipe ativa autorizada.", 403);
  if (query.department) {
    const key = query.department.trim().toLowerCase();
    if (!people.some(person => person.department.trim().toLowerCase() === key)) throw new ApiError("Departamento fora da equipe ativa autorizada.", 403);
    people = people.filter(person => person.department.trim().toLowerCase() === key);
  }
  if (people.length > REPORT_MAX_ROWS) refineReport();
  return people;
}
export type Coverage = ReportMetric["coverage"];
export const currentCoverage = (): Coverage => ({ availability: "available", semantics: "current", observedFrom: null, observedUntil: null });
export function metric(id: string, value: number | null, unit: ReportMetric["unit"], coverage: Coverage, denominator?: number | null, estimated = false): ReportMetric {
  return { id, value, unit, coverage, estimated, ...(denominator === undefined ? {} : { denominator }) };
}
export function unavailable(semantics: Coverage["semantics"], reason: string): Coverage { return { availability: "unavailable", semantics, observedFrom: null, observedUntil: null, reason }; }
export type ReportDomain = Pick<ReportDataset, "rows" | "kpis" | "series"> & { coverage: Record<string, Coverage>; collectedSince?: string | null };
