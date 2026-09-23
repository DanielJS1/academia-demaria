/**
 * Uso manual (na pasta platform):
 *   node --experimental-strip-types scripts/cleanup-test-users.ts --email teste@exemplo.com
 *   node --experimental-strip-types scripts/cleanup-test-users.ts --email teste@exemplo.com --execute
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.
 * Nunca deve ser executado como migration ou durante o deploy.
 */
import { createClient } from "@supabase/supabase-js";

const BOOTSTRAP_EMAIL = "daniel@sacdemaria.com.br";
const DEPENDENT_TABLES = [
  "academy_progress",
  "academy_attempts",
  "academy_xp",
  "academy_preferences",
  "academy_presence",
  "academy_engagement_daily",
  "academy_community_reactions",
] as const;

function parseArgs(args: string[]) {
  const emails: string[] = [];
  let execute = false;
  let dryRun = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--email") {
      const email = args[++index]?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Use --email com um endereço válido.");
      emails.push(email);
    } else if (arg === "--execute") execute = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (execute && dryRun) throw new Error("Escolha apenas --dry-run ou --execute.");
  if (!emails.length) throw new Error("Informe ao menos um --email. Nenhuma busca genérica é permitida.");
  return { emails: [...new Set(emails)], execute };
}

async function main() {
  const { emails, execute } = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  if (emails.includes(BOOTSTRAP_EMAIL)) throw new Error("O administrador de bootstrap está protegido.");

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const authUsers = new Map<string, { id: string; email: string }>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) authUsers.set(user.email.toLowerCase(), { id: user.id, email: user.email });
    }
    if (data.users.length < 1000) break;
  }

  const plan = [];
  for (const email of emails) {
    const { data: profile, error } = await db.from("academy_profiles")
      .select("id,email,name,role").eq("email", email).maybeSingle();
    if (error) throw error;
    const authUser = authUsers.get(email);
    if (profile?.role === "admin") throw new Error(`Conta administradora protegida: ${email}`);
    if (profile && authUser && profile.id !== authUser.id) throw new Error(`IDs divergentes para ${email}; operação cancelada.`);
    const id = profile?.id || authUser?.id;
    const counts: Record<string, number> = {};
    if (profile) {
      for (const table of DEPENDENT_TABLES) {
        const { count, error: countError } = await db.from(table).select("*", { count: "exact", head: true }).eq("user_id", id);
        if (countError) throw countError;
        counts[table] = count || 0;
      }
      const { count, error: commentsError } = await db.from("academy_community_comments")
        .select("*", { count: "exact", head: true }).eq("user_id", id);
      if (commentsError) throw commentsError;
      counts.academy_community_comments = count || 0;
    }
    plan.push({ email, id, profile: !!profile, auth: !!authUser, name: profile?.name, dependents: counts });
  }

  console.log(`Modo: ${execute ? "EXECUÇÃO" : "DRY RUN"}. Alvos exatos: ${plan.length}.`);
  for (const item of plan) console.log(JSON.stringify(item));
  if (!execute) {
    console.log("Nenhum registro alterado. Use --execute para efetivar a lista acima.");
    return;
  }

  for (const item of plan) {
    if (!item.id) {
      console.log(`[IGNORADO] ${item.email}: conta já ausente.`);
      continue;
    }
    try {
      if (item.profile) {
        const { error: commentsError } = await db.from("academy_community_comments").delete().eq("user_id", item.id);
        if (commentsError) throw commentsError;
        // FKs ON DELETE CASCADE removem progresso, provas, XP, preferências,
        // presença e reações. FKs SET NULL preservam auditoria e conteúdo comum.
        const { error } = await db.from("academy_profiles").delete().eq("id", item.id);
        if (error) throw error;
        console.log(`[PERFIL] ${item.email}: removido com dependências.`);
      }
      if (item.auth) {
        const { error } = await db.auth.admin.deleteUser(item.id);
        if (error) throw error;
        console.log(`[AUTH] ${item.email}: removido.`);
      }
    } catch (error) {
      console.error(`[FALHA] ${item.email}:`, error);
      process.exitCode = 1;
    }
  }
  console.log("Concluído. Reexecute o mesmo comando para conferir ou concluir falhas parciais.");
}

main().catch(error => {
  console.error("Limpeza cancelada:", error);
  process.exitCode = 1;
});
