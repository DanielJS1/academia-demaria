import { database } from "@/lib/pilot-server";
import {
  isAllowedCompanyEmail,
  normalizeEmail,
  pendingStudentProfile,
} from "@/lib/registration-security";
import { z } from "zod";
import { DEPARTMENTS } from "@/lib/departments";
import { newPasswordSchema } from "@/lib/auth-policy";

const registerSchema = z.object({
  department: z.enum(DEPARTMENTS, { error: "Selecione seu setor." }),
  name: z.string().trim().min(2, "Informe seu nome completo."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .refine(isAllowedCompanyEmail, "Use um e-mail @demaria.com.br ou @sacdemaria.com.br."),
  password: newPasswordSchema,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registrationAttempts = new Map<string, number[]>();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 5;

function acceptsRegistrationAttempt(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (registrationAttempts.get(client) || []).filter(
    attempt => now - attempt < ATTEMPT_WINDOW_MS
  );
  if (recent.length >= ATTEMPT_LIMIT) return false;
  registrationAttempts.set(client, [...recent, now]);
  return true;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_384) {
      return Response.json({ error: "Solicitação inválida." }, { status: 413 });
    }
    if (!acceptsRegistrationAttempt(request)) {
      return Response.json(
        { error: "Muitas tentativas de cadastro. Aguarde alguns minutos." },
        { status: 429 }
      );
    }
    const raw = await request.json();
    const result = registerSchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    const { name, email, password, department } = result.data;
    const db = database();
    const normalizedEmail = normalizeEmail(email);

    const existing = await db
      .from("academy_profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing.data) {
      return Response.json({
        success: true,
        message: "Se o endereço estiver disponível, o cadastro ficará aguardando liberação do administrador.",
      });
    }

    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name, department },
    });

    if (authError || !authData.user) {
      console.error("Public registration failed in Supabase Auth.", authError?.code);
      return Response.json({
        success: true,
        message: "Se o endereço estiver disponível, o cadastro ficará aguardando liberação do administrador.",
      });
    }

    const { error: profileError } = await db
      .from("academy_profiles")
      .insert({ ...pendingStudentProfile(authData.user.id, name, normalizedEmail), department });

    if (profileError) {
      const cleanup = await db.auth.admin.deleteUser(authData.user.id);
      if (cleanup.error) console.error("Failed to roll back incomplete registration.", cleanup.error.code);
      return Response.json(
        { error: "Não foi possível concluir o cadastro. Tente novamente mais tarde." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "Cadastro realizado com sucesso! Sua conta está aguardando liberação do administrador.",
    });
  } catch {
    return Response.json(
      { error: "Não foi possível processar o cadastro." },
      { status: 500 }
    );
  }
}
