import { describe, expect, it } from "vitest";
import {
  isAllowedCompanyEmail,
  normalizeEmail,
  pendingStudentProfile,
} from "./registration-security";

describe("registration security", () => {
  it.each([
    "pessoa@demaria.com.br",
    "PESSOA@SACDEMARIA.COM.BR",
    " pessoa@demaria.com.br ",
  ])("accepts a company address: %s", email => {
    expect(isAllowedCompanyEmail(email)).toBe(true);
  });

  it.each([
    "pessoa@gmail.com",
    "pessoa@sub.demaria.com.br",
    "pessoa@demaria.com.br.example.com",
    "@demaria.com.br",
  ])("rejects a non-company address: %s", email => {
    expect(isAllowedCompanyEmail(email)).toBe(false);
  });

  it("never grants privileges during public registration", () => {
    expect(pendingStudentProfile("id", " Daniel ", "DANIEL@SACDEMARIA.COM.BR")).toEqual({
      id: "id",
      name: "Daniel",
      email: "daniel@sacdemaria.com.br",
      department: "Geral",
      role: "student",
      status: "pending",
    });
    expect(normalizeEmail(" A@DEMARIA.COM.BR ")).toBe("a@demaria.com.br");
  });
});
