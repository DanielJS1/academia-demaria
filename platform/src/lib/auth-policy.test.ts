import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, newPasswordSchema } from "./auth-policy";
import { commandSchema } from "./pilot-contract";

describe("política de senha", () => {
  it("rejeita 7 caracteres e aceita 8, sem remover espaços", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(newPasswordSchema.safeParse("1234567").success).toBe(false);
    expect(newPasswordSchema.safeParse("12345678").success).toBe(true);
    expect(newPasswordSchema.safeParse(" 1234567").data).toBe(" 1234567");
  });

  it("aplica a mesma regra aos comandos administrativos", () => {
    const invite = { type: "invite", name: "Pessoa Teste", email: "pessoa@example.com", department: "Geral", managerId: "", role: "student" };
    expect(commandSchema.safeParse({ ...invite, temporaryPassword: "1234567" }).success).toBe(false);
    expect(commandSchema.safeParse({ ...invite, temporaryPassword: "12345678" }).success).toBe(true);
  });
});
