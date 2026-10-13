# 06 — Nova interface de Relatórios

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisitos: etapas 02, 04 e 05, com endpoints operantes em ambiente de teste.

**Objetivo:** substituir o gerador de três passos por Relatórios intuitivo, com seis visões e análise individual. As análises antigas devem ter destino funcional antes de saírem de Minha Gestão.

**Pontos de entrada:** team-reports.tsx, team-report-visual.tsx, team.tsx (análises por curso, avaliações e modal), team.css, app-shell.tsx, rota /equipe/relatorios e novos contratos/serviços.

**Execute:**
1. Cabeçalho “Relatórios”, descrição curta e ações de exportação existentes compatíveis. Remova “Voltar para minha gestão” e eyebrow “MINHA GESTÃO · RELATÓRIOS”. Menu mantém Relatórios ativo independentemente.
2. Visões: Visão geral, Presença, Aprendizagem, Desafios, Comunidade e XP. Default geral/30 dias/equipe ativa autorizada. No máximo quatro KPIs e dois módulos visuais no resumo. Não criar um mural com todos os gráficos.
3. Filtros de período/departamento/pessoa e contextuais de curso/desafio/status. Departamento único vira contexto. Mostrar filtros aplicados e limpar. Troca de tema remove filtros incompatíveis; valores inválidos não expandem acesso. Preservar estado em URL e voltar do navegador.
4. Aprendizagem tem Situação atual e Atividade no período; na primeira, data fica inativa e explicada. Separe cursos atribuídos de catálogo e progresso de aulas de conclusão. Reutilize as análises de curso/avaliação e diagnóstico sanitizado da etapa 04.
5. Ofereça tabela, barras e rosca por indicador. Rosca somente em partes de um total exclusivo: status de pares pessoa/curso ou aulas feitas/restantes em um curso. Não usar para notas médias, datas, rankings ou somar percentuais individuais. Atraso sobrepõe status e não vira uma fatia adicional.
6. Gráficos com unidades, rótulos, tabela equivalente e acesso por teclado; barras percentuais 0–100 e quantitativas iniciando em zero. Até 12 pessoas no gráfico com aviso/seleção maiores-menores; conjunto completo na tabela. Use IDs, não nome/e-mail como chave.
7. Tabela com 25 linhas, ordenação acessível e colunas do tema. Selecionar pessoa abre análise individual no mesmo módulo; limpar pessoa restaura equipe. Ação “Gerir colaborador” aponta a /equipe?pessoa=...&acao=..., validada na etapa 08.
8. Renderize carregamento, sem registros, falha e cobertura parcial corretamente. Dados privados não devem surgir de placeholder ou cache anterior ao trocar usuário.
9. Modularize em components/reports/ sem reescrever team.tsx inteiro. Não adicione biblioteca de gráficos pesada se recursos existentes forem suficientes; justifique eventual dependência.

**Critérios de aceite:** filtros alteram KPIs/gráfico/tabela coerentemente; conversão tabela/barras/rosca mantém métrica; relatório individual preserva contexto; seis fontes cobertas; diagnóstico antigo acessível; nenhuma rosca enganosa; mobile/temas/teclado. A etapa 07 aperfeiçoará exportações, mas não deixe os botões exportarem dados antigos ou incorretos durante a transição.
