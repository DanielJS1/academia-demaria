import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const pilotProfiles = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Autor piloto", role: "student", status: "active", audience: "internal" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Administrador piloto", role: "admin", status: "active", audience: "internal" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Outro autor", role: "student", status: "active", audience: "internal" },
  { id: "44444444-4444-4444-8444-444444444444", name: "Cliente piloto", role: "student", status: "active", audience: "client" },
  { id: "55555555-5555-4555-8555-555555555555", name: "Pendente piloto", role: "student", status: "pending", audience: "internal" },
  { id: "66666666-6666-4666-8666-666666666666", name: "Inativo piloto", role: "admin", status: "inactive", audience: "internal" },
] as const;
export async function initializeLocal(db: PGlite) {
  await db.exec(`create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create table public.academy_profiles(id uuid primary key,name text,role text,status text,audience text);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await db.exec(await readFile(path.resolve("supabase/migrations/20261008125328_knowledge_base.sql"), "utf8"));
  await db.exec(await readFile(path.resolve("supabase/migrations/20261008180000_kb_unified_editor.sql"), "utf8"));
  await db.exec(await readFile(path.resolve("supabase/migrations/20261008195500_kb_template_dates.sql"), "utf8"));
  for (const p of pilotProfiles) await db.query("insert into academy_profiles values($1,$2,$3,$4,$5)", [p.id,p.name,p.role,p.status,p.audience]);
}
const globalDb = globalThis as typeof globalThis & { kbPilotDb?: Promise<PGlite> };
export function localDatabase() {
  if (process.env.NODE_ENV === "production" || process.env.KB_LOCAL_PILOT !== "1") throw new Error("Piloto local desativado.");
  return globalDb.kbPilotDb ??= (async () => {
    const db = new PGlite(path.resolve(".kb-pilot/database")); await db.waitReady;
    const exists = await db.query("select to_regclass('public.kb_articles') as table");
    if (!(exists.rows[0] as { table: string | null }).table) await initializeLocal(db);
    await db.exec(await readFile(path.resolve("supabase/migrations/20261008180000_kb_unified_editor.sql"), "utf8"));
    await db.exec(await readFile(path.resolve("supabase/migrations/20261008195500_kb_template_dates.sql"), "utf8"));
    return db;
  })();
}
export function localRequest(request: Request) { return process.env.KB_LOCAL_PILOT === "1" && process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost", "[::1]"].includes(new URL(request.url).hostname); }
export async function asLocal<T>(db: PGlite, actor: string | null, fn: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<T>) {
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor || ""]);
    await tx.exec(actor ? "set local role authenticated" : "set local role anon");
    return fn(tx);
  });
}
