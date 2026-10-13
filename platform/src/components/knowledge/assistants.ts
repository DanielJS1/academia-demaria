import { normalize } from "@/lib/utils";
import { paginateKnowledge, searchExcerpt } from "@/lib/knowledge/search";

export const salesAssistants = [{
  title: "Assistente de Vendas", tag: "COMERCIAL",
  description: "Auxílio a consultores e colaboradores para tirar dúvidas sobre produtos e responder clientes",
  href: "https://chatgpt.com/g/g-6848257ecf708191b1934dad5ec8719f-assistente-de-vendas-demaria",
}];
export const windowsAssistants = [
  { title: "Procurações e Escrituras", href: "https://chatgpt.com/g/g-68b7aa636fc88191a6b20baf55ad5425-procuracoes-e-escrituras" },
  { title: "Preferências", href: "https://chatgpt.com/g/g-68b85c218248819192b205d84bf879bc-preferencias" },
];
export const sealAssistants = [
  { uf: "PE", state: "Pernambuco", href: "https://chatgpt.com/g/g-68a91bfa0f3c8191848220e103b92286-selo-digital-de-pe" },
  { uf: "AL", state: "Alagoas", href: "https://chatgpt.com/g/g-68a92b5ed904819187b4881f8efc9366-selo-digital-de-al" },
  { uf: "SP", state: "São Paulo", href: "https://chatgpt.com/g/g-68addbc7209c8191ab9790c3931d9f22-selo-digital-de-sp" },
  { uf: "BA", state: "Bahia", href: "https://chatgpt.com/g/g-68ade97d7b6881919b7bbb268a857440-selo-digital-de-ba" },
  { uf: "PB", state: "Paraíba", href: "https://chatgpt.com/g/g-68af66930f3c81918a284c26b4cdf264-selo-digital-de-pb" },
  { uf: "RJ", state: "Rio de Janeiro", href: "https://chatgpt.com/g/g-68d581cf1d6c81919d7664a561d7f902-selo-digital-de-rj" },
  { uf: "PI", state: "Piauí", href: "https://chatgpt.com/g/g-6931930e09ec8191b9abeae7fd8b99ab-selo-digital-do-pi" },
];

export function searchAssistants(query: string, page = 1) {
  const catalog = [
    ...salesAssistants.map(item => ({ ...item, product: item.tag })),
    ...windowsAssistants.map(item => ({ ...item, product: "DOC-Windows", description: "Assistente especializado em rotinas e configurações do DOC-Windows." })),
    ...sealAssistants.map(item => ({ title: `Selo Digital de ${item.state}`, href: item.href, product: `Selos Digitais · ${item.uf}`, description: `Orientações de selos digitais de ${item.state} (${item.uf}).` })),
  ];
  const term = normalize(query.trim());
  return paginateKnowledge(term.length < 2 ? [] : catalog.filter(item => normalize(`${item.title} ${item.description} ${item.product}`).includes(term)).map(item => ({
    id: item.href, source: "assistants" as const, title: item.title, product: item.product,
    excerpt: searchExcerpt(item.description, query), snippetKind: "metadata" as const, href: item.href, external: true,
  })), page);
}
