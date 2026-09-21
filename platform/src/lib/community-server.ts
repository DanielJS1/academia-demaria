import { articlePlainText, communityValidationError } from "./community";
import type { Article, ArticleComment } from "./model";
import type { Command } from "./pilot-contract";
import { ApiError, type database, type Profile } from "./pilot-server";

type Database = ReturnType<typeof database>;
export async function readCommunity(db: Database, me: Profile) {
  if (me.audience === "client") return { articles: [] as Article[], articleDrafts: [] as Article[] };
  const { data, error } = await db.rpc("academy_community_read", { actor: me.id });
  if (error) throw new ApiError("Não foi possível consultar a biblioteca. Confira a migração da comunidade.", 503);
  return data as { articles: Article[]; articleDrafts: Article[] };
}

export async function readCommunityArticle(db: Database, me: Profile, id: string, edit: boolean) {
  if (me.audience === "client" || me.status !== "active") throw new ApiError("A biblioteca é exclusiva dos colaboradores aprovados.", 403);
  const { data, error } = await db.rpc("academy_community_read", { actor: me.id, article_id: id, edit });
  if (error) throw new ApiError(error.message, error.message.includes("não encontrado") ? 404 : 403);
  return data as { article: Article; comments: ArticleComment[] };
}

export async function executeCommunity(db: Database, me: Profile, command: Command) {
  if (me.audience === "client" || me.status !== "active") throw new ApiError("A biblioteca é exclusiva dos colaboradores aprovados.", 403);
  if ((command.type === "community-delete" || command.type === "community-request-update") && me.role === "student") throw new ApiError("Somente administradores e gestores podem moderar a biblioteca.", 403);
  if (command.type === "community-save") {
    const problem = communityValidationError(command.data, command.publish);
    if (problem) throw new ApiError(problem);
    const content = command.data.blocks ? articlePlainText(command.data.blocks) : command.data.content.trim();
    command = { ...command, data: { ...command.data, content, summary: content.replace(/\s+/g, " ").slice(0, 240) } };
  }
  const { error } = await db.rpc("academy_community_mutate", { actor: me.id, command });
  if (error) throw new ApiError(error.message);
}
