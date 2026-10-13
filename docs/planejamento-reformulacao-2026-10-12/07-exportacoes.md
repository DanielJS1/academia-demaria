# 07 — CSV e PDF confiáveis

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisito: etapa 06. Esta etapa fecha exportação antes de retirar análises antigas.

**Objetivo:** garantir que o gestor exporte exatamente os dados que filtrou, com apresentação legível e sem perder linhas.

**Pontos de entrada:** team-reports.tsx ou novos components/reports, csvCell em lib/utils.ts, CSS de impressão em team.css e demais folhas relacionadas, tests/e2e/management-reports.spec.ts e impressão de certificados existente.

**Execute:**
1. Gere CSV a partir de registros tipados do ReportDataset carregado, com todos os registros filtrados, sem limite de paginação ou top do gráfico. Reutilize csvCell, UTF-8 com BOM e delimitador compatível com Excel em português.
2. Inclua contexto sem tornar o CSV uma planilha inconsistente: cabeçalhos estáveis e colunas de metadados pertinentes (período, data de geração, fuso/cobertura), ou formato igualmente retangular documentado. Preserve números interpretáveis e distingua vazio de zero.
3. Mantenha “Salvar em PDF” abrindo impressão do navegador, com ajuda curta explícita. Não prometa download direto. Prepare área de impressão contendo marca, título, filtros, generatedAt, fuso, indicadores/gráficos válidos e tabela completa.
4. Use o mesmo dataset e timestamp da visualização. Caso atualizar os dados seja necessário, atualizar também a tela antes de exportar; não exportar silenciosamente uma versão diferente.
5. Ajuste orientação e quebras para cada tema; repetir cabeçalho da tabela, evitar linhas cortadas e textos ilegíveis. Excluir menu, botões e formulários. Não exportar texto de PDI nem gabaritos.
6. Métrica indisponível permanece identificada; não gerar arquivo vazio com aparência de sucesso. Falha no dataset necessário desabilita exportação daquele relatório e apresenta motivo.
7. Preserve limites explícitos da consulta sem truncamento; ao ultrapassar, pedir refinamento com contagem/motivo. Ausência de paginação do banco não pode eliminar linhas acima de 1.000.

**Critérios de aceite:** CSV e PDF com filtros por departamento/pessoa/data, sem vazamento; >20/25 linhas, nomes com acentos e valores com vírgulas/aspas/quebras; células iniciadas com =,+,-,@ tratadas por csvCell; nulos versus zeros; séries e totais iguais à tela; impressão das seis visões em A4 e de relatório longo; certificado continua imprimindo sozinho quando seu modal está ativo. Gere arquivos de teste, renderize/inspecione visualmente os PDFs e entregue evidências. Não considere PDF correto apenas porque o arquivo possui bytes.
