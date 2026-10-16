# Etapa 06 — Nova interface de Relatórios

Concluída em 12/10/2026, seguindo `06-relatorios-interface.md`. Alterações somente no checkout local, sem deploy, push ou aplicação de migrações ao banco publicado.

## Comportamento entregue

- Substituição do gerador de três passos por Visão geral, Presença, Aprendizagem, Desafios, Comunidade e XP. Cabeçalho compacto e componentes compartilhados da etapa 02; cores, fonte e temas existentes preservados.
- Resumo com quatro KPIs e dois gráficos. Cada tema oferece filtros apropriados, unidades, cobertura e tabela nominal com ordenação acessível e 25 linhas por página.
- Período, departamento, colaborador, filtros contextuais, indicador, visualização, ordenação, ranking e página registrados na URL. Voltar do navegador e recarregar preservam o contexto. Filtros inválidos não são convertidos silenciosamente em uma população maior.
- Selecionar pessoa abre análise individual no mesmo módulo. “Todos os colaboradores” remove apenas a pessoa; “Gerir colaborador” aponta para `/equipe?pessoa=...&acao=pdi`, cujo atendimento será concluído na etapa 08.
- Aprendizagem separa cursos e avaliações, situação atual e atividade no período, atribuídos e catálogo. Período fica desativado e explicado na situação atual. Curso, situação e política de tentativas ficam em “Mais filtros”. Diagnóstico utiliza o DTO sanitizado da etapa 04, sem respostas ou gabaritos.
- Tabela, barras e rosca conforme o indicador. Rosca limitada a status exclusivos de pares pessoa/curso ou aulas concluídas/restantes de uma pessoa em um curso. Percentuais por pessoa não viram fatias; atraso não cria categoria adicional. Progresso agregado considera quantidades de aulas.
- Gráficos de pessoas mostram até 12 maiores/menores, com aviso e tabela equivalente completa, aberta sob demanda. Barras percentuais usam 0–100; quantidades partem de zero; ajustes negativos de XP conservam sinal e referência em zero. Identidades usam IDs, inclusive pessoas com o mesmo nome.
- Carregamento, falha com nova tentativa, ausência de registros, dados parciais e métricas indisponíveis diferenciados. Requisições abortáveis e resultados vinculados à consulta, identidade e escopo impedem reutilizar dados anteriores após troca de filtros/conta. Exportações ficam desativadas enquanto não há resultado atual válido.
- CSV e impressão/PDF transitórios utilizam todos os registros do conjunto filtrado e ordenado, incluindo páginas não visíveis. CSV inclui proteção para células interpretáveis como fórmulas. PDF usa impressão do navegador, também preparada para impressão manual. O aperfeiçoamento de metadados, formatos e acabamento segue reservado à etapa 07.

## Arquivos

- `platform/src/components/team-reports.tsx`: ponto de entrada para os componentes novos.
- `platform/src/components/reports/`: página, filtros, gráficos, tabela, diagnóstico, exportações e hooks de navegação/dados.
- `platform/src/lib/reports/navigation.ts`, `presentation.ts` e `presentation.test.ts`: URL, formatos e semântica de apresentação.
- `platform/src/app/(academy)/equipe/relatorios/page.tsx`: boundary de Suspense para a navegação por parâmetros.
- `platform/src/styles/reports.css` e import em `globals.css`: estilos específicos e impressão.

O menu já distinguia `/equipe` de `/equipe/relatorios`; essa regra foi conferida e preservada. `team.tsx`, suas análises antigas e `team-report-visual.tsx` não foram removidos nesta etapa. Sua reorganização pertence à etapa 08. Nenhuma nova dependência de gráficos foi adicionada. Alterações locais de Trilhas/Discord e das etapas anteriores preservadas.

## Verificações realizadas

- `next typegen` e `pnpm typecheck`: aprovados após remoção dos arquivos temporários de QA e tipos gerados correspondentes.
- `pnpm exec vitest run src/lib/reports`: **54 testes aprovados em cinco arquivos**. Incluem seis testes novos de URL, rejeição de parâmetros inválidos/duplicados, mudança de tema com preservação de escopo, progresso ponderado, composição válida da rosca e formatação de zero/nulo/XP negativo.
- Playwright em Chromium visível, servidor Next local e APIs interceptadas com dados fictícios de 32 pessoas: seis visões, paginação 25/7, departamento/pessoa, análise individual, ação de gestão, histórico e recarga, resposta atrasada, erro/retry e troca de identidade/ambiente. Nenhum erro de JavaScript na execução final.
- Conversão tabela/barras/rosca sem refazer a consulta; percentual 0–100; conjunto equivalente completo; rosca por pessoa/curso e retorno para equipe sem indicador incompatível; cobertura parcial e XP negativo.
- Diagnóstico: abertura, conteúdo sanitizado, navegação por Tab, fechamento por Escape e foco devolvido ao acionador.
- CSV com 32 registros e documento para impressão com 32 registros, além da página visível de 25. CSS de impressão conferido com mídia `print`; não foi automatizada a caixa nativa de salvamento de PDF.
- Dez combinações de temas claro/escuro e larguras 1440, 1024, 768, 390 e 375 px, mais zoom de 200%. Capturas revisadas visualmente. Tabelas mantêm rolagem própria em dispositivos menores.
- Revisão React/Next: componentes modulares, hooks sem condições, IDs estáveis, consultas privadas abortáveis, limites de renderização e diagnóstico nativo com foco. Ajustado o comportamento do diálogo durante o ciclo de efeitos do Strict Mode.

As evidências e o script isolado ficam em `C:/Users/Daniel José/.codex/visualizations/2026/10/12/01a13253-523d-7262-89c8-7748a2f432d7/stage06/`. O bootstrap temporário de testes foi removido e o servidor iniciado para QA foi encerrado.

## Limitações e continuação

Validação de interface feita com fixtures isoladas; não representa uma consulta real ao banco publicado. Os testes de contratos e serviços passaram localmente. A migração temporal preparada na etapa 05 continua pendente de aplicação pelo fluxo autorizado; sem ela, suas fontes retornam erro explícito. Não foi executado build de produção nesta etapa.

Próxima etapa: **07 — CSV e PDF confiáveis** (`07-exportacoes.md`).
