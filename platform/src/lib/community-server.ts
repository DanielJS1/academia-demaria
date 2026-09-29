import { articlePlainText, communityValidationError } from "./community";
import type { Article, ArticleComment } from "./model";
import type { Command } from "./pilot-contract";
import { ApiError, type database, type Profile } from "./pilot-server";

type Database = ReturnType<typeof database>;
export async function readCommunity(db: Database, me: Profile) {
  if (me.audience === "client") return { articles: [] as Article[], articleDrafts: [] as Article[] };
  const { data, error } = await db.rpc("academy_community_read", { actor: me.id });
  if (error) throw new ApiError("Não foi possível consultar a biblioteca. Confira a migração da comunidade.", 503);
  const result = data as { articles: Article[]; articleDrafts: Article[] };
  const ids = result.articles.map(article => article.id);
  if (ids.length) {
    const coauthors = await db.from("academy_article_coauthors").select("article_id,user_id,academy_profiles!academy_article_coauthors_user_id_fkey(name)").in("article_id",ids);
    if (coauthors.error) throw new ApiError("Não foi possível consultar os coautores. Confira a migração de colaboração.",503);
    for (const article of result.articles) {
      const coauthor = coauthors.data?.find(row => row.article_id === article.id);
      if (coauthor) article.coauthor = { id:coauthor.user_id, name:(coauthor.academy_profiles as unknown as {name:string})?.name || "Colaborador" };
    }
  }
  return result;
}

export async function readCommunityArticle(db: Database, me: Profile, id: string, edit: boolean, proposalId?: string) {
  if (me.audience === "client" || me.status !== "active") throw new ApiError("A biblioteca é exclusiva dos colaboradores aprovados.", 403);
  const { data, error } = await db.rpc("academy_community_read", { actor: me.id, article_id: id, edit });
  if (error) throw new ApiError(error.message, error.message.includes("não encontrado") ? 404 : 403);
  const result = data as { article: Article; comments: ArticleComment[] };
  if (proposalId) {
    if (result.article.authorId !== me.id) throw new ApiError("Somente o autor pode revisar esta proposta.",403);
    const proposal = await db.from("academy_article_suggestions").select("id,proposer_id,proposed_text,proposed_body,base_revision,status,academy_profiles!academy_article_suggestions_proposer_id_fkey(name)").eq("id",proposalId).eq("article_id",id).maybeSingle();
    if (proposal.error || !proposal.data || proposal.data.status !== "pending") throw new ApiError("Proposta não encontrada ou já analisada.",404);
    return {article:(proposal.data.proposed_body || result.article) as Article,original:result.article,comments:[],proposal:{id:proposal.data.id,message:proposal.data.proposed_text,proposer:(proposal.data.academy_profiles as unknown as {name:string})?.name || "Colaborador",baseRevision:proposal.data.base_revision ?? result.article.revision,legacy:!proposal.data.proposed_body}};
  }
  const coauthor = await db.from("academy_article_coauthors").select("user_id,academy_profiles!academy_article_coauthors_user_id_fkey(name)").eq("article_id",id).maybeSingle();
  if (coauthor.error) throw new ApiError("Não foi possível consultar a colaboração.",503);
  if (coauthor.data) result.article.coauthor = { id:coauthor.data.user_id, name:(coauthor.data.academy_profiles as unknown as {name:string})?.name || "Colaborador" };
  if (result.article.authorId === me.id) {
    const suggestions = await db.from("academy_article_suggestions").select("id,proposer_id,proposed_text,status,created_at,academy_profiles!academy_article_suggestions_proposer_id_fkey(name)").eq("article_id",id).order("created_at",{ascending:false}).limit(20);
    if (suggestions.error) throw new ApiError("Não foi possível consultar as sugestões.",503);
    result.article.suggestions = (suggestions.data || []).map(row => ({id:row.id,proposerId:row.proposer_id,proposer:(row.academy_profiles as unknown as {name:string})?.name || "Colaborador",proposedText:row.proposed_text,status:row.status as "pending"|"accepted"|"rejected",createdAt:row.created_at}));
  }
  return result;
}

export async function executeCommunity(db: Database, me: Profile, command: Command) {
  if (me.audience === "client" || me.status !== "active") throw new ApiError("A biblioteca é exclusiva dos colaboradores aprovados.", 403);
  if ((command.type === "community-delete" || command.type === "community-request-update") && me.role === "student") throw new ApiError("Somente administradores e gestores podem moderar a biblioteca.", 403);
  if (command.type === "community-suggest") {
    if(command.articleId!==command.data.id)throw new ApiError("Artigo inválido.");
    const problem=communityValidationError(command.data,true);if(problem)throw new ApiError(problem);
    const content=command.data.richContent?command.data.content.trim():command.data.blocks?articlePlainText(command.data.blocks):command.data.content.trim();
    const {error}=await db.rpc("academy_article_suggest_edit",{actor:me.id,article_id:command.articleId,expected_revision:command.expectedVersion,proposal:{...command.data,content},message:command.message});
    if(error)throw new ApiError(error.message);
    return;
  }
  if (command.type === "community-review-suggestion") {
    if(command.data){if(command.articleId!==command.data.id)throw new ApiError("Artigo inválido.");const problem=communityValidationError(command.data,true);if(problem)throw new ApiError(problem);}
    const {error}=await db.rpc("academy_article_review_edit",{actor:me.id,article_id:command.articleId,suggestion_id:command.suggestionId,decision:command.decision,adjustment:command.data ?? null});
    if(error)throw new ApiError(error.message);
    return;
  }
  if (command.type === "community-save") {
    const problem = communityValidationError(command.data, command.publish);
    if (problem) throw new ApiError(problem);
    const content = command.data.richContent ? command.data.content.trim() : command.data.blocks ? articlePlainText(command.data.blocks) : command.data.content.trim();
    command = { ...command, data: { ...command.data, content, summary: content.replace(/\s+/g, " ").slice(0, 240) } };
  }
  const { error } = await db.rpc("academy_community_mutate", { actor: me.id, command });
  if (error) throw new ApiError(error.message);
}
