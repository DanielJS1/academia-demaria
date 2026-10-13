# 01 — Contratos, escopo e métricas

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisito: nenhum. Este é o primeiro passo de implementação do planejamento já realizado; não repita uma auditoria geral sem necessidade.

**Objetivo:** definir uma única linguagem de dados para Minha Gestão e Relatórios. Hoje a interface usa managedPeople, presença usa uma RPC com população diferente, person.progress mede todo o catálogo e o diagnóstico do gestor recalcula acertos com gabaritos ocultos.

**Pontos de entrada:** team-scope.ts e seu teste, pilot-server.ts, model.ts, rewards.ts, course-activities.ts, team.tsx, team-reports.tsx, periodic-quizzes.ts, trails.ts/trails-server.ts e migrações de presença. Inspecione o snapshot e os contratos reais antes de alterar.

**Execute:**
1. Crie contratos Zod e tipos em módulos próprios, por exemplo lib/reports/contracts.ts, scope.ts e metrics.ts. Preveja ReportQuery, ReportDataset, IDs estáveis, generatedAt, período/fuso e disponibilidade/cobertura por métrica. Não use string[][] como contrato.
2. Especifique as seis visões: geral, presença, aprendizagem, desafios, comunidade, XP. Aprendizagem distingue situação atual de atividade no período. Não aplique datas a progresso acumulado como se fosse histórico.
3. Unifique a função de escopo reutilizável: internos ativos, exceto ator; admin vê a população geral; gestor vê manager_id próprio ou pessoa sem manager_id do mesmo departamento não vazio. Use trim/case da regra do servidor. Pendentes são explicitamente operacionais, fora das métricas de atividade; sem ampliar a autorização global.
4. Defina datas 7/30/personalizadas, incluindo hoje, em America/Sao_Paulo; início inclusivo e fim exclusivo do dia seguinte. Limite inicial de 366 dias e sem futuro.
5. Extraia/adapte funções puras para progresso de aulas, conclusão com avaliações/proficiência, pares atribuídos deduplicados e notas. Use completed da pessoa correta. Não alterar a semântica de conclusão do produto sem evidência.
6. Prepare cálculo sanitizado de diagnóstico no servidor, reutilizando correção de múltipla escolha e crédito parcial. Nota oficial continua sendo a persistida; gestor não recebe gabarito completo. Pendente não é zero nem erro.
7. Documente os contratos e decisões finais num arquivo de acompanhamento desta reforma. Identifique timestamps disponíveis e lacunas sem fabricar histórico.

**Critérios de aceite e testes:** isolamento de subordinado direto versus outro gestor, departamento vazio, acentos/espaços sem falsa ampliação, cliente/student recusados nos serviços gerenciais, pending separado; curso com aulas 100% e avaliação pendente não concluído; proficiência; aluno e gestor com progresso distinto; múltipla escolha em ordem diferente; questões parciais/pendentes; média por pessoa sem ponderação involuntária por tentativas; intervalo em Brasília e denominador zero. Os endpoints serão conectados nas etapas 04/05; esta etapa deve entregar contratos/helpers úteis e testados, sem substituir telas.
