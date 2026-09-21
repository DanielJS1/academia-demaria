import type { Article, ArticleBlock } from "./model";

export const COMMUNITY_LIMITS = { publicationXp: 10, publicationsPerWeek: 2, likeXp: 1, hypeXp: 2, commentXp: 1, interactionXpPerArticle: 20, authorXpPerWeek: 40, hypesPerWeek: 3, imageCharacters: 350 * 1024, bodyCharacters: 1_500_000, imagesPerArticle: 8 } as const;

export function articlePlainText(blocks: ArticleBlock[]) {
  return blocks.filter(block => block.type !== "image").map(block => block.items?.join("\n") || block.text || "").join("\n\n").trim();
}

export function communityValidationError(article: Article, publish: boolean): string | null {
  if (article.blocks) {
    if (new Set(article.blocks.map(block => block.id)).size !== article.blocks.length) return "Os blocos do artigo devem ter identificadores únicos.";
    if (new TextEncoder().encode(JSON.stringify(article.blocks)).byteLength > COMMUNITY_LIMITS.bodyCharacters) return "O artigo ultrapassa 1,5 MB. Reduza a quantidade ou o tamanho das imagens.";
    const images = article.blocks.filter(block => block.type === "image");
    if (images.length > COMMUNITY_LIMITS.imagesPerArticle) return "Use no máximo 8 imagens por artigo.";
    for (const block of article.blocks) {
      if (block.type === "image") {
        if (!block.src || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(block.src) || block.src.length > COMMUNITY_LIMITS.imageCharacters) return "Use imagens PNG, JPEG ou WebP comprimidas em Base64 de até 350 KB.";
        if (!block.alt?.trim()) return "Descreva cada imagem para facilitar a leitura e a acessibilidade.";
      } else if (block.type === "steps" || block.type === "bullets") {
        if (!block.items?.length || block.items.some(item => !item.trim())) return "Preencha todos os itens da lista.";
      } else if (!block.text?.trim()) return "Preencha ou remova os blocos de texto vazios.";
    }
  }
  const text = article.blocks ? articlePlainText(article.blocks) : article.content.trim();
  if (text.length > 100000) return "O texto do artigo é muito longo.";
  if (publish && text.length < 80) return "Explique o procedimento com pelo menos 80 caracteres antes de publicar.";
  return null;
}
