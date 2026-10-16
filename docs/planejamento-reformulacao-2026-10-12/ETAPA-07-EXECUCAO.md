# Etapa 07 — CSV e PDF confiáveis

Concluída em 12/10/2026, seguindo `07-exportacoes.md` e a orientação adicional do usuário: **a visualização rica dos relatórios em tela é a experiência principal**. Gráficos, filtros, análise individual e tabelas continuam no módulo da etapa 06. As exportações complementam essa experiência e usam seus dados atuais.

## Entrega

- CSV gerado a partir do `ReportDataset` carregado e do conjunto completo ordenado, com proteção contra exportar uma página, duplicatas ou registros incompatíveis. Não usa o recorte de 12 pessoas do gráfico.
- UTF-8 com BOM, delimitador `;`, aspas escapadas e suporte a acentos, vírgulas, ponto e vírgula e quebras de linha dentro de células. Reutiliza `csvCell`; textos iniciados por `=`, `+`, `-` ou `@`, inclusive após espaços, recebem proteção contra fórmulas. Valores numéricos negativos tipados permanecem números.
- CSV retangular: uma linha de cabeçalhos e uma linha por registro. Metadados são repetidos em colunas, sem títulos/rodapés fora da tabela. Inclui visão, subvisão, modo, escopo, política de tentativas, período efetivamente aplicado, geração em ISO, fuso, população, filtros, indicador, formato, ranking, ordenação, contagens e cobertura das fontes em JSON.
- Colunas de dados usam IDs estáveis, como `name`, `department`, `score` e `xp_period`. Cada métrica tem valor numérico sem agrupamento/sufixo, unidade, disponibilidade, semântica, indicação de estimativa e motivo. Decimal usa vírgula; percentual `70` com unidade `percent` corresponde a 70%, conforme a tela. A precisão original do número é preservada; a tela mantém seu arredondamento de apresentação.
- Nulo fica vazio no CSV e acompanhado de disponibilidade/motivo; zero continua `0`. Na impressão, nulo permanece “—” com explicação. O nome do arquivo considera a data de geração em Brasília.
- “Salvar em PDF” abre a impressão do navegador. Ajuda curta informa explicitamente a opção “Salvar como PDF”; não promete download direto.
- Documento de impressão modular com marca, título, filtros e escolhas de aprendizagem, geração/fuso, KPIs, mesmos gráficos da tela, cobertura e tabela completa. Reutiliza `ReportChart`, incluindo suas unidades, ranking e restrições de rosca; escolhas gráficas não provocam nova consulta.
- A4 em retrato para até seis colunas e paisagem para tabelas mais largas; cabeçalho repetido, linhas preservadas, gráficos mantidos inteiros, numeração de páginas e cores legíveis sobre papel branco. Menu, busca, botões, formulários, rodapé da aplicação e link de pular conteúdo ficam fora da impressão.
- Exportações bloqueadas durante carregamento, falha, ausência de registros ou visualização incompatível. Erros de geração de CSV aparecem na tela. Não são incluídos PDI, respostas ou gabaritos.
- Limites de consulta e paginação do banco das etapas 04/05 preservados. Erro 422 pede refinamento e mantém as exportações bloqueadas. Não foi introduzido truncamento de dados.
- Quando existe `.cert-modal-overlay`, o relatório fica fora da impressão e seu preparador de impressão não assume o lugar do certificado.

## Arquivos desta etapa

- `platform/src/lib/reports/export.ts` e `export.test.ts`.
- `platform/src/components/reports/report-print-document.tsx`.
- Ajustes em `report-exports.tsx`, `report-chart.tsx` e ligação em `reports-page.tsx`.
- `platform/src/styles/reports.css`: ajuda discreta e estilos exclusivos de impressão.
- `platform/src/lib/utils.ts`: `csvCell` diferencia textos potencialmente interpretáveis como fórmula de números tipados.
- `platform/tests/e2e/management-reports.spec.ts`: atualização do teste antigo de quatro relatórios/gerador para as seis visões atuais; fixtures em `report-fixtures.mjs`.

Não foram removidas análises de Minha Gestão nem alteradas regras de XP, autenticação ou acesso. Alterações locais de Trilhas/Discord e das etapas anteriores preservadas.

## Verificações realizadas

- `next typegen` e `pnpm typecheck`: aprovados após remoção do bootstrap temporário e dos tipos correspondentes.
- `pnpm exec vitest run src/lib/reports`: **61 testes aprovados em seis arquivos**, incluindo sete testes novos de exportação. Cobrem retângulo CSV, BOM, escaping, fórmulas, negativos, decimal, nulo/zero, mais de 1.000 registros, conjuntos incompletos/duplicados e metadados do recorte.
- Playwright em Chromium visível, servidor Next local e APIs interceptadas: **nove CSVs e nove PDFs**. Seis visões, avaliações, filtros por departamento/pessoa/período personalizado, relatório com 1.005 registros, falha 422 e impressão exclusiva de certificado. KPIs e títulos dos gráficos comparados com a tela; timestamp do CSV igual ao dataset. Exportar não aumentou o número de consultas. Nenhum erro de JavaScript na execução final.
- Verificação independente com Python `csv`/`pypdf`: todos os CSVs retangulares, 32 registros nos temas, um no recorte individual e 1.005 no relatório longo. Negativos e notas indisponíveis conferidos. PDFs com marca, contexto, última pessoa e todas as linhas esperadas; orientação A4 conferida; certificado isolado em uma página.
- PDFs renderizados com Poppler e inspecionados visualmente, incluindo folhas de contato das visões e de todas as 32 páginas do relatório longo. Conferidos títulos, gráficos, rosca, XP negativo, cabeçalhos repetidos, cobertura, paginação e ausência de controles da aplicação. A extração de texto confirmou as 1.005 identidades nominais do relatório longo, sem omissões.
- Cabeçalho de exportação conferido em tela de 390 px. As exportações continuam sendo ações secundárias ao conteúdo visual do relatório.

O teste de staging atualizado não foi executado com login real; a execução local usou autenticação fictícia e o mesmo helper de fixtures. Não foi feito build de produção ou consulta real ao banco publicado. A migração temporal da etapa 05 continua pendente de aplicação pelo fluxo autorizado.

## Evidências

Artefatos de teste com pessoas fictícias em `output/pdf/stage07/`:

| Arquivo | Páginas / conteúdo |
|---|---|
| `overview.pdf` | 2; resumo, dois gráficos e tabela de 32 pessoas |
| `presence.pdf` | 3; presença e tabela completa |
| `learning.pdf` | 3; cursos, rosca válida e tabela completa |
| `assessments.pdf` | 4; notas oficiais e pendências, sem gabaritos |
| `challenges.pdf` | 4; desafios, gráfico e legado identificado |
| `community.pdf` | 3; publicação/interações e cobertura parcial |
| `xp.pdf` | 2; XP com ajuste negativo |
| `long-1005.pdf` | 32; todas as 1.005 pessoas, inclusive a última |
| `certificate-only.pdf` | 1; isolamento com fixture da estrutura/classes do certificado existente |

CSVs correspondentes, `filtered-person.csv`, `validation.json`, `pdf-contact-sheet.png`, `long-contact-sheet.png`, captura mobile e scripts de verificação ficam no mesmo diretório. A fixture de bootstrap foi preservada como texto para reproduzir o QA; não permanece como rota do aplicativo. O servidor iniciado para os testes foi encerrado.

Próxima etapa: **08 — Minha Gestão e ficha operacional** (`08-minha-gestao.md`).
