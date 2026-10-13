import type { Person } from "./model";
import { isManagedPerson, type ScopePopulation } from "./reports/scope";

export function managedPeople(people: Person[], me: { id: string; role: "admin" | "manager" | "student"; department?: string; audience?: "internal" | "client"; status?: Person["status"] }, population: ScopePopulation = "active") {
  const department = me.department || people.find(person => person.id === me.id)?.department || "";
  const actor = { ...me, department, status: me.status ?? people.find(person => person.id === me.id)?.status ?? "active" as const };
  return people.filter(person => isManagedPerson(actor, person, population));
}
