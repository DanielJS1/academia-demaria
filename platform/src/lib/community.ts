import type { Article, ArticleBlock } from "./model";
import { isStoredMediaUrl } from "./storage-service";

export const COMMUNITY_LIMITS = { publicationXp: 10, publicationsPerWeek: 2, likeXp: 1, hypeXp: 2, commentXp: 1, interactionXpPerArticle: 20, authorXpPerWeek: 40, hypesPerWeek: 3, imageCharacters: 350 * 1024, bodyCharacters: 1_500_000, imagesPerArticle: 8 } as const;

export function articlePlainText(blocks: ArticleBlock[]) {
  return blocks.filter(block => block.type !== "image").map(block => block.items?.join("\n") || block.text || "").join("\n\n").trim();
}

export function communityValidationError(article: Article, publish: boolean): string | null {
  if (article.richContent) {
    const serialized = JSON.stringify(article.richContent);
    if (new TextEncoder().encode(serialized).length > 1_500_000 || /data:image\/|data:application\/|blob:/i.test(serialized)) return "O artigo contém uma imagem incorporada ou excede 1,5 MB.";
    const visit = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }): boolean => {
      if (["image", "attachment"].includes(node.type || "") && (typeof node.attrs?.src === "string" || typeof node.attrs?.href === "string")) {
        const url = String(node.attrs?.src || node.attrs?.href);
        if (!isStoredMediaUrl(url, "academy-articles")) return false;
      }
      return !node.content?.some(child => !visit(child as typeof node));
    };
    if (!visit(article.richContent)) return "Imagens e anexos devem usar URLs HTTPS do storage.";
  }
  if (article.blocks) {
    if (new Set(article.blocks.map(block => block.id)).size !== article.blocks.length) return "Os blocos do artigo devem ter identificadores únicos.";
    if (new TextEncoder().encode(JSON.stringify(article.blocks)).byteLength > COMMUNITY_LIMITS.bodyCharacters) return "O artigo ultrapassa 1,5 MB. Reduza a quantidade ou o tamanho das imagens.";
    const images = article.blocks.filter(block => block.type === "image");
    if (images.length > COMMUNITY_LIMITS.imagesPerArticle) return "Use no máximo 8 imagens por artigo.";
    for (const block of article.blocks) {
      if (block.type === "image") {
        if (!block.alt?.trim()) return "Descreva cada imagem para facilitar a leitura e a acessibilidade.";
        if (!block.src || !isStoredMediaUrl(block.src, "academy-articles") || block.src.length > 2048) return "Use uma URL HTTPS do storage para cada imagem.";
      } else if (block.type === "steps" || block.type === "bullets") {
        if (!block.items?.length || block.items.some(item => !item.trim())) return "Preencha todos os itens da lista.";
      } else if (!block.text?.trim()) return "Preencha ou remova os blocos de texto vazios.";
    }
  }
  const text = article.richContent ? article.content.trim() : article.blocks ? articlePlainText(article.blocks) : article.content.trim();
  if (text.length > 100000) return "O texto do artigo é muito longo.";
  if (publish && text.length < 80) return "Explique o procedimento com pelo menos 80 caracteres antes de publicar.";
  return null;
}
