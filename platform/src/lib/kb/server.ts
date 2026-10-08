import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError } from "../api-error";
import { authenticate } from "../pilot-server";
import { asLocal, localDatabase, localRequest, pilotProfiles } from "./local-db";
import { validateDocument } from "./document";

export const commandSchema = z.object({ action: z.enum(["create","save","submit","withdraw","return","publish","visibility","unpublish","restore"]), articleId: z.string().uuid().optional(), expectedVersion: z.number().int().positive().optional(), revisionId: z.string().uuid().optional(), submissionId: z.string().uuid().optional(), document: z.unknown().optional(), visibility: z.enum(["public","private"]).optional(), comment: z.string().max(4000).optional(), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(180).optional() }).strict();
export const privateHeaders = { "Cache-Control": "no-store, private", "Vary": "Authorization, Cookie" };
export async function context(request: Request, required = false) {
  if (localRequest(request)) {
    const actor = request.headers.get("cookie")?.match(/(?:^|;\s*)kb-pilot=([a-f0-9-]+)/)?.[1];
    const me = pilotProfiles.find(p => p.id === actor) || null;
    if (required && (!me || me.status !== "active" || me.audience !== "internal")) throw new ApiError("Acesso editorial restrito a colaboradores aprovados.",403);
    return { local: true as const, actor: me?.id || null, me, db: await localDatabase(), client: null };
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ApiError("Configure a Base de Conhecimento para continuar.",503);
  const client = createClient(url,key,{ auth: { persistSession: false, autoRefreshToken: false }, global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined });
  let me = null;
  if (token) { const auth = await authenticate(request); me = auth.me; }
  if (required && (!me || me.status !== "active" || me.audience !== "internal")) throw new ApiError("Acesso editorial restrito a colaboradores aprovados.",403);
  return { local: false as const, actor: me?.id || null, me, db: null, client };
}
export type KbContext = Awaited<ReturnType<typeof context>>;
export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha na Base de Conhecimento.";
  const status = error instanceof ApiError ? error.status : /Conflict|Obsolete|Withdraw|submitted/i.test(message) ? 409 : /Forbidden|Admin required|permission denied/i.test(message) ? 403 : 400;
  return Response.json({ error: status === 403 ? "Operação não autorizada." : message }, { status, headers: privateHeaders });
}
export async function mutate(ctx: KbContext, input: unknown) {
  const cmd = commandSchema.parse(input);
  if (cmd.document !== undefined) cmd.document = validateDocument(cmd.document);
  if (cmd.action !== "create" && (!cmd.articleId || !cmd.expectedVersion)) throw new ApiError("Informe o artigo e sua versão.");
  if (["withdraw","publish","return"].includes(cmd.action) && (!cmd.revisionId || !cmd.submissionId)) throw new ApiError("Informe a revisão exata analisada.");
  if (!ctx.me || ctx.me.status !== "active" || ctx.me.audience !== "internal") throw new ApiError("Operação não autorizada.",403);
  if (["publish","return","unpublish","visibility"].includes(cmd.action) && ctx.me.role !== "admin") throw new ApiError("Somente administradores publicam e revisam.",403);
  if (ctx.local) return asLocal(ctx.db,ctx.actor, async tx => (await tx.query<{ id: string }>("select public.kb_mutate($1::jsonb) as id",[JSON.stringify(cmd)])).rows[0].id);
  const result = await ctx.client.rpc("kb_mutate",{cmd}); if (result.error) throw new Error(result.error.message); return result.data as string;
}
export async function editorialList(ctx: KbContext, page = 1, filter="mine") {
  const offset=(page-1)*20;
  if (ctx.local) return asLocal(ctx.db,ctx.actor, async tx => (await tx.query("select a.*, d.document->'metadata'->>'title' as title from kb_articles a join kb_drafts d on d.article_id=a.id where ($2='all' or ($2='mine' and a.owner_id=auth.uid()) or a.status=$2) order by a.updated_at desc limit 21 offset $1",[offset,filter])).rows);
  let query=ctx.client.from("kb_articles").select("*,kb_drafts(document)");if(filter==="mine")query=query.eq("owner_id",ctx.actor);else if(filter!=="all")query=query.eq("status",filter);
  const result = await query.order("updated_at",{ascending:false}).range(offset,offset+20); if(result.error)throw new Error(result.error.message);
  return result.data.map(a => ({...a,title:a.kb_drafts?.[0]?.document?.metadata?.title || a.kb_drafts?.document?.metadata?.title || "Sem título",kb_drafts:undefined}));
}
export async function editorialDetail(ctx: KbContext, id: string) {
  z.string().uuid().parse(id);
  if (ctx.local) return asLocal(ctx.db,ctx.actor, async tx => {
    const a=(await tx.query("select a.*,d.document,d.proposed_visibility from kb_articles a join kb_drafts d on d.article_id=a.id where a.id=$1",[id])).rows[0]; if(!a)throw new ApiError("Artigo não encontrado.",404);
    const submissions=(await tx.query("select s.*,r.document from kb_submissions s join kb_revisions r on r.id=s.revision_id where s.article_id=$1 order by s.created_at desc limit 50",[id])).rows;
    const events=(await tx.query("select action,comment,revision_id,created_at from kb_review_events where article_id=$1 order by created_at desc limit 50",[id])).rows;
    const publication=(await tx.query("select revision_id,visibility,document from kb_publications where article_id=$1",[id])).rows[0] || null;
    return {...a,submissions,events,publication};
  });
  const a=await ctx.client.from("kb_articles").select("*,kb_drafts(document,proposed_visibility)").eq("id",id).maybeSingle(); if(a.error)throw new Error(a.error.message); if(!a.data)throw new ApiError("Artigo não encontrado.",404);
  const results=await Promise.all([ctx.client.from("kb_submissions").select("*,kb_revisions(document)").eq("article_id",id).order("created_at",{ascending:false}).limit(50),ctx.client.from("kb_review_events").select("action,comment,revision_id,created_at").eq("article_id",id).order("created_at",{ascending:false}).limit(50),ctx.client.from("kb_publications").select("revision_id,visibility,document").eq("article_id",id).maybeSingle()]);
  for (const r of results) if(r.error)throw new Error(r.error.message);
  const draft=Array.isArray(a.data.kb_drafts)?a.data.kb_drafts[0]:a.data.kb_drafts;
  return {...a.data,...draft,submissions:(results[0].data as unknown as { kb_revisions: {document:unknown} }[]).map(s=>({...s,document:s.kb_revisions.document})),events:results[1].data,publication:results[2].data};
}
export async function publicSearch(ctx: KbContext, params: URLSearchParams) {
  const args={ q:(params.get("q")||"").slice(0,200), product:(params.get("produto")||"").slice(0,120), category:(params.get("categoria")||"").slice(0,120), tag:(params.get("tag")||"").slice(0,60), page:Math.max(1,Math.min(10000,Math.floor(Number(params.get("pagina")))||1)) };
  if (ctx.local) return asLocal(ctx.db,ctx.actor,async tx=>(await tx.query("select * from public.kb_search($1,$2,$3,$4,$5)",[args.q,args.product,args.category,args.tag,args.page])).rows);
  const result=await ctx.client.rpc("kb_search",{query:args.q,product_filter:args.product,category_filter:args.category,tag_filter:args.tag,page_number:args.page}); if(result.error)throw new ApiError("Busca indisponível. Confira a migração da BC.",503); return result.data;
}
export async function publication(ctx: KbContext, slug: string):Promise<{slug:string;title:string;summary:string;document:unknown;published_at:string}|null> {
  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))throw new ApiError("Artigo não encontrado.",404);
  if (ctx.local) return asLocal(ctx.db,ctx.actor,async tx=>(await tx.query<{slug:string;title:string;summary:string;document:unknown;published_at:string}>("select slug,title,summary,product,category,tags,document,published_at from kb_publications where slug=$1",[slug])).rows[0] || null);
  const result=await ctx.client.from("kb_publications").select("slug,title,summary,product,category,tags,document,published_at").eq("slug",slug).maybeSingle(); if(result.error)throw new ApiError("Leitura indisponível.",503); return result.data;
}
