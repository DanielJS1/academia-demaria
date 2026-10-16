import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const envPath = existsSync(".env.local") ? ".env.local" : "platform/.env.local";
const envContent = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envContent.split("\n").filter(l => l.includes("=")).map(l => {
    const idx = l.indexOf("=");
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const adminId = "f3de5029-8c02-47d8-9f2e-968aae4e02f5"; // Daniel José (Admin)
const bucket = "academy-technical-pdfs";

const manualsToPublish = [
  {
    topic: "Selo Digital MA",
    title: "Manual Interno — Selo Digital do Maranhão (Release 2.89)",
    description: "Configuração e rotinas operacionais do Selo Digital do Maranhão no DOC-Windows.",
    filePath: "Y:\\Treinamento Interno - CQ\\009- SELO DIGITAL MA\\009-CQ-MANUAL-INTERNO-Selo_digital_MA_release_2.89.pdf",
  },
  {
    topic: "Correição Online TJTO",
    title: "Manual Interno — Módulo de Correição On-line TJTO (Release 2.69)",
    description: "Procedimentos de parametrização e remessa de dados para o módulo de correição do TJTO.",
    filePath: "Y:\\Treinamento Interno - CQ\\005-CORREICAO ONLINE-TJTO\\005-CQ-MANUAL-INTERNO-Correicao_Online_TJTO.pdf",
  },
  {
    topic: "Selo Digital AC",
    title: "Manual Interno — Selo Digital do Acre (Release 2.63)",
    description: "Instruções de configuração, uso e transmissão de atos do Selo Digital do Acre.",
    filePath: "Y:\\Treinamento Interno - CQ\\001-SELO DIGITAL AC\\001-CQ-MANUAL-INTERNO-Selo_digital_AC_release_2.63.pdf",
  },
  {
    topic: "Selo Digital AC",
    title: "Manual de Integração Extrajud TJAC (Versão 2.0.0)",
    description: "Especificação técnica oficial do Tribunal de Justiça do Acre para interoperabilidade com as serventias.",
    filePath: "Y:\\Treinamento Interno - CQ\\001-SELO DIGITAL AC\\001-TJ-MANUAL-Selo_digital_AC_Manual_de_Integracao_Extrajud_AC_versao_2.0.0.pdf",
  },
  {
    topic: "Atendimento Online (AOL)",
    title: "Manual Interno — Integração Pré-Atendimento AOL com DOC-Windows",
    description: "Fluxo de sincronização e importação de pré-atendimentos do AOL para o sistema DOC-Windows.",
    filePath: "Y:\\Treinamento Interno - CQ\\004-INTEGRACAO PRE-ATENDIMENTO COM DOC (AOL)\\004-CQ-MANUAL-INTERNO-Integracao_Pre-Atendimento_Atendimento_Online_com_DOC-Windows(AOL).pdf",
  },
  {
    topic: "Pesquisa CPF Serventia",
    title: "Escopo Homologado — Pesquisa de CPF em Banco Particular",
    description: "Resumo técnico e critérios de validação para pesquisa em banco de dados particular de CPFs da serventia.",
    filePath: "Y:\\Treinamento Interno - CQ\\015-PESQUISA CPF EM BANCO DE CPFs PARTICULAR DA SERVENTIA\\OCL597b-resumo-aprov-escopo acordado.pdf",
  },
  {
    topic: "Consulta SERPRO",
    title: "Manual Interno — Consulta SERPRO (Release 2.75)",
    description: "Parâmetros de integração e roteiro de testes para consulta de dados via SERPRO.",
    filePath: "Y:\\Treinamento Interno - CQ\\007- CONSULTA SERPRO\\007-CQ-MANUAL-INTERNO_CONSULTA SERPRO.pdf",
  },
  {
    topic: "Selo Digital PR",
    title: "Manual Interno — Alterações no Selo Digital do Paraná (Release 2.65)",
    description: "Alterações de regras e adequação de emissão do Selo Digital no Estado do Paraná.",
    filePath: "Y:\\Treinamento Interno - CQ\\002-SELO DIGITAL PR\\002-CQ-MANUAL-INTERNO-Alteracao_Selo_digital_PR_release_2.65.pdf",
  },
  {
    topic: "Selo Digital PR",
    title: "Descrição Técnica Funarpen — Selo Digital PR (Versão 10.0)",
    description: "Especificação técnica oficial da Funarpen para emissão e validação do Selo Digital no Paraná.",
    filePath: "Y:\\Treinamento Interno - CQ\\002-SELO DIGITAL PR\\002-TJ-MANUAL-Selo_digital_PR_Manual_Funarpen_Descricao_tecnica_versao_10.0.pdf",
  },
  {
    topic: "Consulta Online AOL",
    title: "Manual Interno — Consulta Online de Processos no AOL",
    description: "Rotina de consulta e acompanhamento de processos no portal Atendimento Online.",
    filePath: "Y:\\Treinamento Interno - CQ\\003-CONSULTA ONLINE PROCESSOS (AOL)\\003-CQ-MANUAL-INTERNO-Consulta_Online_de_Processo_AOL.pdf",
  },
  {
    topic: "Selo Digital PR V11",
    title: "Manual Técnico Funarpen — Selo Digital PR V11 (v22)",
    description: "Descrição técnica atualizada da versão V11 da Funarpen para escrituras e atos no Paraná.",
    filePath: "Y:\\Treinamento Interno - CQ\\018-SELO DIGITAL PR V11\\MANUAL TECNICO - V11 v22.pdf",
  },
  {
    topic: "Infraestrutura e Banco de Dados",
    title: "Procedimento Operacional — Instalação do PostgreSQL 11",
    description: "Guia de instalação e padronização do banco de dados PostgreSQL 11.13 nas serventias.",
    filePath: "Y:\\Treinamento Interno - CQ\\008- INSTALACAO POSTGRE11\\Instalacao_do_PostgresQL_11.pdf",
  },
  {
    topic: "Selo Digital PR V11-Plus",
    title: "Manual Técnico Funarpen — Selo Digital PR V11-Plus (v11.12)",
    description: "Especificação técnica do projeto-piloto V11-Plus com tabelas e formatos de atos no Paraná.",
    filePath: "Y:\\Treinamento Interno - CQ\\033-SELO DIGITAL PR - v11PLUS\\MANUAL TECNICO - V11_v12(v6).pdf",
  },
  {
    topic: "Selo Digital AM",
    title: "Manual Interno — Selo Digital do Amazonas (Release 3.12.2 / v4)",
    description: "Versão mais recente do manual de configuração e utilização do Selo Digital do Amazonas.",
    filePath: "Y:\\Treinamento Interno - CQ\\010- SELO DIGITAL AM\\010-CQ-MANUAL-Versao_4_Selo_digital_AM_release_3.12.2.pdf",
  },
];

async function main() {
  console.log(`Iniciando publicação de ${manualsToPublish.length} manuais técnicos...`);
  const report = [];

  for (const item of manualsToPublish) {
    console.log(`\nProcessando: ${item.title}`);
    if (!existsSync(item.filePath)) {
      console.error(`Arquivo não encontrado: ${item.filePath}`);
      report.push({ ...item, status: "FALHA", reason: "Arquivo não encontrado na rede" });
      continue;
    }

    const fileBytes = readFileSync(item.filePath);
    const pdfPath = `technical/pdf/${randomUUID()}.pdf`;

    // 1. Upload para o bucket privado
    console.log(`  - Enviando arquivo para storage (${(fileBytes.length / (1024 * 1024)).toFixed(2)} MB)...`);
    const uploadResult = await db.storage.from(bucket).upload(pdfPath, fileBytes, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadResult.error) {
      console.error(`  - Erro no upload:`, uploadResult.error.message);
      report.push({ ...item, status: "FALHA", reason: `Upload falhou: ${uploadResult.error.message}` });
      continue;
    }

    // 2. Inserir registro na tabela
    console.log(`  - Inserindo na tabela academy_technical_materials...`);
    const insertResult = await db.from("academy_technical_materials").insert({
      title: item.title,
      description: item.description,
      topic: item.topic,
      kind: "manual",
      pdf_path: pdfPath,
      video_url: null,
      created_by: adminId,
    }).select("id,created_at").single();

    if (insertResult.error) {
      console.error(`  - Erro no insert:`, insertResult.error.message);
      await db.storage.from(bucket).remove([pdfPath]);
      report.push({ ...item, status: "FALHA", reason: `Insert falhou: ${insertResult.error.message}` });
      continue;
    }

    const id = insertResult.data.id;
    console.log(`  - Salvo com sucesso! ID: ${id}`);

    // 3. Validação: gerar URL assinada e testar leitura
    console.log(`  - Testando abertura com URL assinada...`);
    const signed = await db.storage.from(bucket).createSignedUrl(pdfPath, 600);
    let validated = false;
    let validateError = "";

    if (signed.data?.signedUrl) {
      try {
        const resp = await fetch(signed.data.signedUrl);
        if (resp.ok) {
          const header = Buffer.from(await resp.arrayBuffer()).slice(0, 5).toString();
          if (header === "%PDF-") {
            validated = true;
            console.log(`  - Validação OK: PDF abre corretamente com status ${resp.status}`);
          } else {
            validateError = "Conteúdo baixado não possui cabeçalho %PDF-";
          }
        } else {
          validateError = `HTTP ${resp.status} ao acessar URL assinada`;
        }
      } catch (err) {
        validateError = err.message;
      }
    } else {
      validateError = signed.error?.message || "Não gerou URL assinada";
    }

    report.push({
      ...item,
      id,
      pdfPath,
      status: validated ? "PUBLICADO E VALIDADO" : "PUBLICADO COM ALERTA",
      reason: validateError || null,
      signedTest: validated ? "OK (HTTP 200, %PDF-)" : `Falha: ${validateError}`,
    });
  }

  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    "C:\\Users\\Daniel José\\.gemini\\antigravity-ide\\brain\\5f28192b-b0b0-46a0-b56a-ce4133b59c18\\scratch\\publication_report.json",
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("\n==========================================");
  console.log("Relatório final de publicação:");
  console.log(`- Total publicado com sucesso: ${report.filter(r => r.status === "PUBLICADO E VALIDADO").length}/${manualsToPublish.length}`);
  console.log("==========================================");
}

main().catch(console.error);
