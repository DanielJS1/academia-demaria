import { academyUrl } from "@/lib/discord";
import { requestOAuthCookie, verifyOAuthState } from "@/lib/discord-oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url), target = new URL(academyUrl("/aprender/trilhas"));
  try {
    verifyOAuthState(requestOAuthCookie(request), url.searchParams.get("state") ?? "");
    if (url.searchParams.has("error")) target.searchParams.set("discord_error", "Autorização cancelada. Você pode tentar novamente.");
    else {
      const code = url.searchParams.get("code"); if (!code || code.length > 256) throw new Error("Autorização inválida.");
      target.searchParams.set("discord_code", code); target.searchParams.set("discord_state", url.searchParams.get("state")!);
    }
  } catch { target.searchParams.set("discord_error", "Conexão expirada. Clique em Conectar Discord para tentar novamente."); }
  return new Response(null, { status: 303, headers: { Location: target.href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
