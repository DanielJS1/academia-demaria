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
});
