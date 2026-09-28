import type { Person } from "./model";
import { normalize } from "./utils";

export function managedPeople(people: Person[], me: { id: string; role: "admin" | "manager" | "student"; department?: string }) {
  const department = me.department || people.find(person => person.id === me.id)?.department || "";
  return people.filter(person =>
    person.id !== me.id &&
    person.audience !== "client" &&
    person.status !== "inactive" &&
    (me.role === "admin" || person.managerId === me.id ||
      (me.role === "manager" && !person.managerId && Boolean(department) && normalize(person.department) === normalize(department)))
  );
}
