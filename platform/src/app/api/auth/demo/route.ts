import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const profiles = {
  admin: { email: "demo.apresentacao.admin@demaria.com.br", role: "admin", audience: "internal" },
  gestor: { email: "demo.gestor.1@demaria.com.br", role: "manager", audience: "internal" },
  colaborador: { email: "demo.colaborador.1.1@demaria.com.br", role: "student", audience: "internal" },
  cartorio: { email: "demo.cartorio.apresentacao@demaria.com.br", role: "student", audience: "client" },
} as const;
const input = z.object({ profile: z.enum(["admin", "gestor", "colaborador", "cartorio"]) }).strict();

function enabled() {
  return process.env.DEMO_LOGIN_ENABLED === "true"
    && process.env.NEXT_PUBLIC_APP_ENV === "homologacao"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "https://attnodzrjlhqydhrgqtr.supabase.co"
    && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
export async function GET() {
  return Response.json({ enabled: enabled() }, { headers });
}

export async function POST(request: Request) {
  if (!enabled()) return Response.json({ error: "Acesso indisponível." }, { status: 404, headers });
  const source = request.headers.get("origin");
  const target = new URL(request.url);
  const host = request.headers.get("host") || target.host;
  let sameOrigin = false;
  try { const origin = new URL(source || ""); sameOrigin = origin.host === host && origin.protocol === target.protocol; } catch {}
  if (!sameOrigin) {
    return Response.json({ error: "Solicitação inválida." }, { status: 403, headers });
  }
  try {
    const body = await request.text();
    if (body.length > 256) return Response.json({ error: "Solicitação inválida." }, { status: 400, headers });
    let raw: unknown;
    try { raw = JSON.parse(body); } catch { return Response.json({ error: "Solicitação inválida." }, { status: 400, headers }); }
    const parsed = input.safeParse(raw);
    if (!parsed.success) return Response.json({ error: "Perfil inválido." }, { status: 400, headers });
    const selected = profiles[parsed.data.profile];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    const { data: profile, error } = await admin.from("academy_profiles").select("id,role,status,audience").eq("email", selected.email).single();
    if (error || !profile || profile.status !== "active" || profile.role !== selected.role || profile.audience !== selected.audience) {
      return Response.json({ error: "Este perfil de demonstração está indisponível." }, { status: 403, headers });
    }
    // Generate and consume a one-time link on the server; no password or email delivery.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: selected.email });
    if (link.error || link.data.user.id !== profile.id) throw new Error("Demo identity unavailable");
    const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const result = await auth.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "email" });
    if (result.error || !result.data.session || result.data.user?.id !== profile.id) throw new Error("Demo session unavailable");
    return Response.json({ access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token }, { headers });
  } catch {
    return Response.json({ error: "Não foi possível iniciar a demonstração. Tente novamente." }, { status: 503, headers });
  }
}
