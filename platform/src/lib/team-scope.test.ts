import { describe, expect, it } from "vitest";
import { managedPeople } from "./team-scope";
import type { Person } from "./model";

const person = (id: string, department: string, managerId = "", status: Person["status"] = "active"): Person => ({
  id, name: id, email: `${id}@example.com`, department, managerId, status, role: "student", xp: 0, progress: 0, audience: "internal", avatar: null,
});

describe("managedPeople", () => {
  const people = [
    person("manager", "Comercial"),
    person("direct", "Suporte", "manager"),
    person("sector", "comercial"),
    person("assigned-elsewhere", "Comercial", "other"),
    person("other-sector", "Financeiro"),
    person("inactive", "Comercial", "", "inactive"),
    { ...person("client", "Comercial"), audience: "client" as const },
  ];

  it("limits a manager to direct reports and unassigned people in their sector", () => {
    expect(managedPeople(people, { id: "manager", role: "manager", department: "Comercial" }).map(item => item.id)).toEqual(["direct", "sector"]);
  });

  it("shows the internal organization to an administrator without inactive or client profiles", () => {
    expect(managedPeople(people, { id: "admin", role: "admin" }).map(item => item.id)).toEqual(["manager", "direct", "sector", "assigned-elsewhere", "other-sector"]);
  });
});
