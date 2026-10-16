export type ScopeActor = {
  id: string; role: "admin" | "manager" | "student"; status: "active" | "pending" | "inactive";
  department?: string; audience?: "internal" | "client";
};
export type ScopePerson = {
  id: string; managerId?: string | null; department: string;
  status: "active" | "pending" | "inactive"; audience?: "internal" | "client";
};
export type ScopePopulation = "active" | "pending" | "operational";
const departmentKey = (value?: string) => (value ?? "").trim().toLowerCase();

export function assertReportActor(actor: ScopeActor): void {
  if (actor.status !== "active" || actor.audience === "client" || !["admin", "manager"].includes(actor.role)) {
    throw new Error("Somente gestores internos ativos podem consultar a equipe.");
  }
}

export function isManagedPerson(actor: ScopeActor, person: ScopePerson, population: ScopePopulation = "active"): boolean {
  if (actor.status !== "active" || actor.audience === "client" || !["admin", "manager"].includes(actor.role)) return false;
  if (person.id === actor.id || person.audience === "client" || person.status === "inactive") return false;
  if (population !== "operational" && person.status !== population) return false;
  const department = departmentKey(actor.department);
  return actor.role === "admin" || person.managerId === actor.id ||
    (!person.managerId && !!department && departmentKey(person.department) === department);
}

export function selectManagedPeople<T extends ScopePerson>(people: readonly T[], actor: ScopeActor, population: ScopePopulation = "active"): T[] {
  assertReportActor(actor);
  return people.filter(person => isManagedPerson(actor, person, population));
}

export function assertManagedPerson(actor: ScopeActor, person: ScopePerson): void {
  assertReportActor(actor);
  if (!isManagedPerson(actor, person)) throw new Error("Colaborador fora da equipe ativa autorizada.");
}

/** Adapt authenticated database profiles without importing server credentials into helpers. */
export function scopeProfile<T extends { manager_id?: string | null }>(profile: T): T & { managerId: string | null } {
  return { ...profile, managerId: profile.manager_id ?? null };
}
