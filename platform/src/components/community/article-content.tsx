import { Fragment, createElement, type ReactNode } from "react";
import type { Article, ArticleBlock } from "@/lib/model";

// Render a small formatting vocabulary as React elements. User HTML is always text.
export function InlineArticleText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*([^*\n]+)\*\*|_([^_\n]+)_|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(cursor, match.index));
    const key = match.index;
    if (match[2]) parts.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={key}>{match[4]}</code>);
    else parts.push(<a key={key} href={match[6]} target="_blank" rel="noopener noreferrer">{match[5]}</a>);
    cursor = match.index + match[0].length;
  }
  parts.push(text.slice(cursor));
  return <>{parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</>;
}

export function blocksPlainText(blocks: ArticleBlock[]) {
  return blocks.map(block => block.type === "image" ? (block.caption || "") : block.items?.join("\n") || block.text || "").join("\n\n");
}

type RichNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: RichNode[] };
function secureUrl(value: unknown) { return typeof value === "string" && /^https:\/\//i.test(value) ? value : ""; }
function renderRich(node: RichNode, key: number): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "horizontalRule") return <hr key={key} />;
  const children = node.content?.map(renderRich) || [];
  if (node.type === "text") {
    return (node.marks || []).reduce<ReactNode>((child, mark) => {
      if (mark.type === "link") { const href = secureUrl(mark.attrs?.href); return href ? <a href={href} target="_blank" rel="noopener noreferrer">{child}</a> : child; }
      const tag = ({ bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" } as Record<string, string>)[mark.type];
      return tag ? createElement(tag, {}, child) : child;
    }, node.text || "");
  }
  if (node.type === "image") { const src = secureUrl(node.attrs?.src); return src ? <figure key={key}><img src={src} alt={String(node.attrs?.alt || "")} loading="lazy" decoding="async" /></figure> : null; }
  if (node.type === "attachment") { const href = secureUrl(node.attrs?.href); return href ? <div className="community-attachment" key={key}><a href={href} download target="_blank" rel="noopener noreferrer">↓ {String(node.attrs?.name || "Baixar arquivo")}</a></div> : null; }
  const tag = ({ doc: "div", paragraph: "p", heading: `h${[1,2,3].includes(Number(node.attrs?.level)) ? node.attrs?.level : 2}`, bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "aside", codeBlock: "pre", table: "table", tableRow: "tr", tableHeader: "th", tableCell: "td" } as Record<string, string>)[node.type || ""];
  if (!tag) return null;
  return createElement(tag, { key, ...(node.type === "blockquote" ? { className: "community-callout" } : {}) }, node.type === "codeBlock" ? <code>{children}</code> : children);
}

export function ArticleContent({ article }: { article: Pick<Article, "content" | "blocks" | "richContent"> }) {
  if (article.richContent) return <div className="community-prose">{renderRich(article.richContent as RichNode, 0)}</div>;
  if (!article.blocks?.length) return <div className="community-prose"><p>{article.content}</p></div>;
  return (
    <div className="community-prose">
      {article.blocks.map(block => {
        if (block.type === "image") {
          if (!secureUrl(block.src)) return null;
          return <figure key={block.id}><img src={block.src} alt={block.alt || ""} loading="lazy" decoding="async" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
        }
        if (block.type === "steps" || block.type === "bullets") {
          const List = block.type === "steps" ? "ol" : "ul";
          return <List key={block.id}>{block.items?.map((item, index) => <li key={index}><InlineArticleText text={item} /></li>)}</List>;
        }
        if (block.type === "heading") return <h2 key={block.id}><InlineArticleText text={block.text || ""} /></h2>;
        if (block.type === "callout") return <aside className="community-callout" key={block.id}><InlineArticleText text={block.text || ""} /></aside>;
        return <p key={block.id}><InlineArticleText text={block.text || ""} /></p>;
      })}
    </div>
  );
}

export function CommunityXpRules() {
  return <details className="community-xp-rules"><summary>Como o conhecimento gera XP</summary><ul><li>Publicação: 10 XP, para até 2 novos posts por semana.</li><li>Curtida: 1 XP · Hype: 2 XP · Comentário: 1 XP ao autor.</li><li>Cada colega conta uma vez por tipo de interação. Interações próprias e repetições não geram XP.</li><li>Interações rendem até 20 XP por artigo durante toda a vida do post. O total da biblioteca é limitado a 40 XP por autor por semana.</li><li>Editar ou republicar não recompensa novamente. Cursos e avaliações continuam sendo o principal caminho de evolução.</li></ul></details>;
}
