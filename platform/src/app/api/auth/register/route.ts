import { database } from "@/lib/pilot-server";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(12, "A senha deve ter pelo menos 12 caracteres."),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const result = registerSchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    const { name, email, password } = result.data;
    const db = database();
    const normalizedEmail = email.toLowerCase();

    const existing = await db
      .from("academy_profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing.data) {
      return Response.json(
        { error: "Este e-mail já está cadastrado na plataforma." },
        { status: 400 }
      );
    }

    const isDaniel = normalizedEmail === "daniel@sacdemaria.com.br";

    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData.user) {
      return Response.json(
        { error: authError?.message || "Não foi possível criar o usuário no Supabase Auth." },
        { status: 400 }
      );
    }

    const { error: profileError } = await db.from("academy_profiles").insert({
      id: authData.user.id,
      name,
      email: normalizedEmail,
      department: "Geral",
      role: isDaniel ? "admin" : "student",
      status: isDaniel ? "active" : "pending",
    });

    if (profileError) {
      return Response.json(
        { error: "Conta criada, mas houve um erro ao registrar seu perfil. Fale com o administrador." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "Cadastro realizado com sucesso! Sua conta está aguardando liberação do administrador.",
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erro ao processar cadastro." },
      { status: 500 }
    );
  }
}
