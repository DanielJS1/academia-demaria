export interface CartorioModuleItem {
  code: string;
  family: string;
  name: string;
  key: string; // e.g. "WIN:C"
}

export interface ModuleFamily {
  code: string;
  name: string;
  description: string;
  modules: { code: string; name: string }[];
}

export const BRAZILIAN_UFS = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

export type BrazilianUF = typeof BRAZILIAN_UFS[number]["uf"];

export const MODULE_FAMILIES: ModuleFamily[] = [
  {
    code: "AAN",
    name: "Família AAN",
    description: "Módulos de Acervos de Escrituras e Procurações",
    modules: [
      { code: "1", name: "ACERVO DE ESCR/PROC" },
      { code: "2", name: "ACERVO PROC" },
      { code: "3", name: "ACERVO ESCR" },
    ],
  },
  {
    code: "AOL",
    name: "Família AOL",
    description: "Atendimento e Serviços Online do Cartório",
    modules: [
      { code: "C", name: "CASAMENTO" },
      { code: "D", name: "PEDIDOS DE CERTIDAO" },
      { code: "F", name: "FIRMAS PRE-CADASTRO" },
      { code: "N", name: "NASCIMENTO" },
      { code: "O", name: "OBITO" },
      { code: "P", name: "CONSULTA DE PROCESSOS" },
      { code: "T", name: "PORTAL TRANSPARENCIA" },
      { code: "V", name: "VALIDADOR DE DOCUMENTOS" },
      { code: "Y", name: "ATOS NOTARIAIS" },
      { code: "a", name: "AUTOATENDIMENTO" },
      { code: "d", name: "PEDIDO DE CERTIDAO PLUS" },
      { code: "f", name: "FIRMAS CONSULTA" },
      { code: "y", name: "ATENDIMENTO ONLINE" },
    ],
  },
  {
    code: "DES",
    name: "Família DES",
    description: "Habilitações e Interfaces Especiais",
    modules: [
      { code: "i", name: "HABILITACAO DOC-WEB:UI" },
    ],
  },
  {
    code: "ESP",
    name: "Família ESP",
    description: "Serviços Especiais, Inteligência e Mobilidade",
    modules: [
      { code: "0", name: "CASHBACK" },
      { code: "M", name: "PROJETOS ESPECIAIS" },
      { code: "P", name: "DESCONTO PONTUALIDADE ULT 12 MESES" },
      { code: "b", name: "DOC-BOT.IA" },
      { code: "k", name: "BACKUP EM NUVEM" },
      { code: "m", name: "DOC-MOBILE" },
      { code: "q", name: "DOC-FILA" },
      { code: "s", name: "DOC-MULTISCAN" },
      { code: "u", name: "FINANCEIRO - PARCELA EXPRESS" },
      { code: "z", name: "RECONHECIMENTO DE VOZ" },
    ],
  },
  {
    code: "POL",
    name: "Família POL",
    description: "Publicações Oficiais e Editais",
    modules: [
      { code: "X", name: "PUBLICACAO DE EDITAIS" },
    ],
  },
  {
    code: "WEB",
    name: "Família WEB",
    description: "Soluções em Nuvem e Navegador DOC-Web",
    modules: [
      { code: "C", name: "CASAMENTO" },
      { code: "E", name: "LIVRO E" },
      { code: "F", name: "REC FIRMAS/AUTENTICACOES" },
      { code: "G", name: "GERENCIADOR DE DOCUMENTOS" },
      { code: "I", name: "HABILITACAO DOC-WEB:UI" },
      { code: "K", name: "BACKUP EM NUVEM" },
      { code: "N", name: "NASCIMENTO" },
      { code: "O", name: "OBITO" },
      { code: "P", name: "PROCURACOES PLUS" },
      { code: "S", name: "CONTR SELAGEM" },
      { code: "U", name: "FINANCEIRO" },
      { code: "W", name: "DOC-WEB" },
    ],
  },
  {
    code: "WIN",
    name: "Família WIN",
    description: "Sistemas Desktop DOC-Windows e Rotinas Notariais/Registrais",
    modules: [
      { code: "A", name: "COMUNICACOES INTRANET ARPEN" },
      { code: "B", name: "DOC-BOT.IA" },
      { code: "C", name: "CASAMENTO" },
      { code: "E", name: "LIVRO E" },
      { code: "F", name: "REC FIRMAS/AUTENTICACOES" },
      { code: "H", name: "PROTESTOS - CARTORIO" },
      { code: "I", name: "UI-CLIENT" },
      { code: "K", name: "BACKUP NA NUVEM" },
      { code: "L", name: "LIVROS COMERCIAIS" },
      { code: "M", name: "MULTISCAN" },
      { code: "N", name: "NASCIMENTO" },
      { code: "O", name: "OBITO" },
      { code: "P", name: "PROCURACOES PLUS" },
      { code: "Q", name: "FILA DE ATENDIMENTO" },
      { code: "R", name: "ESCRITURAS PLUS" },
      { code: "S", name: "CONTR SELAGEM" },
      { code: "T", name: "EDITOR TEXTOS" },
      { code: "U", name: "FINANCEIRO" },
      { code: "V", name: "AVERBACOES" },
      { code: "e", name: "LIVRO E - UNIAO ESTAVEL" },
      { code: "h", name: "PROTESTOS - DISTRIBUIDOR" },
      { code: "m", name: "INTEGRACAO COM MILLA CERTIDOES" },
      { code: "p", name: "PROCURACOES" },
      { code: "r", name: "ESCRITURAS" },
      { code: "u", name: "FINANCEIRO PLUS" },
      { code: "w", name: "DOC-WINDOWS" },
    ],
  },
];

// Dicionário plano para lookup rápido por chave "FAMILY:CODE"
export const ALL_MODULES_MAP: Record<string, CartorioModuleItem> = {};

MODULE_FAMILIES.forEach(fam => {
  fam.modules.forEach(mod => {
    const key = `${fam.code}:${mod.code}`;
    ALL_MODULES_MAP[key] = {
      code: mod.code,
      family: fam.code,
      name: mod.name,
      key,
    };
  });
});

export function getModuleInfo(moduleKey: string): CartorioModuleItem | undefined {
  return ALL_MODULES_MAP[moduleKey];
}

export function formatModuleName(moduleKey: string): string {
  const item = ALL_MODULES_MAP[moduleKey];
  if (!item) return moduleKey;
  return `[${item.family}] ${item.code} — ${item.name}`;
}

export function isSelagemModule(moduleKey: string): boolean {
  return moduleKey === "WIN:S" || moduleKey === "WEB:S";
}
