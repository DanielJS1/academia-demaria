import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleContent } from "./article-content";

describe("leitura de artigos ricos", () => {
  it("renderiza quebras de linha, imagem e código sem derrubar a página", () => {
    const html = renderToStaticMarkup(<ArticleContent article={{
      content: "Texto\nSQL", blocks: undefined,
      richContent: { type: "doc", content: [
        { type: "paragraph", content: [{ type: "text", text: "Texto" }, { type: "hardBreak" }, { type: "text", text: "continuação" }] },
        { type: "image", attrs: { src: "https://example.com/image.png", alt: "Diagrama" } },
        { type: "codeBlock", content: [{ type: "text", text: "SELECT 1;" }] },
        { type: "horizontalRule" },
      ] },
    }} />);
    expect(html).toContain("<br/>");
    expect(html).toContain("SELECT 1;");
    expect(html).toContain("Copiar");
    expect(html).toContain("Baixar");
    expect(html).toContain("<hr/>");
    expect(html).toContain("alt=\"Diagrama\"");
  });
  it("mostra listas de verificação na leitura publicada", () => {
    const html = renderToStaticMarkup(<ArticleContent article={{
      content: "Confirme a configuração", blocks: undefined,
      richContent: { type: "doc", content: [{ type: "taskList", content: [
        { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Conferir acesso" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Validar resultado" }] }] },
      ] }] },
    }} />);
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain("Conferir acesso");
    expect(html).toContain("Validar resultado");
  });
});
