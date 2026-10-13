# 09 — Compactar Aprender, Trilhas, Desafios e Evolução

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisito: etapa 02. Use os padrões já empregados nas etapas 03/06/08 se estiverem presentes.

**Objetivo:** atender aos pedidos pontuais do segundo vídeo mantendo essas telas reconhecíveis e funcionais.

**Pontos de entrada:** catalog.tsx, trails/my-trails.tsx, quizzes/quiz-center.tsx, quizzes/quiz-notification-control.tsx, evolution.tsx; knowledge.css (hoje também contém catálogo/evolução), cards.css, quizzes.css, trails.css, theme.css e responsive.css.

**Execute:**
1. Aprender: cabeçalho compacto; remover o ícone de livro decorativo isolado à direita. Integrar quantidade de cursos e contexto do banner “Uma jornada para cada descoberta” ao topo, reduzindo aproximadamente pela metade sua ocupação excedente em desktop. Evitar repetir a contagem em vários blocos; preservar filtros, abas, busca, favoritos, player e cards.
2. Minhas Trilhas: aplicar título compacto e ritmo vertical comum, preservando organização, progresso, prazos, estados vazios, lembretes e conexão Discord.
3. Desafios: colocar a preferência “Avisar sobre novos desafios” em bloco menor junto ao topo. Estado atual visível, botão claro, mensagem de sucesso/falha acessível. Preservar mutate quiz-notifications, adesão, cancelamento, condição de simulação e limite de uma tentativa oficial por edição.
4. Minha Evolução: compor cabeçalho e perfil lado a lado quando couber; identidade, foto, senha e contexto de temporada continuam acessíveis. Reduzir repetição visual de XP/nível entre perfil e destaque principal sem mudar cálculos, conquistas ou ranking. Empilhar em telas estreitas.
5. A redução aproximada de área não significa reduzir fontes/click targets pela metade. Evitar alturas fixas, truncamento de ações e texto ilegível. Não fazer refatoração funcional ampla nessas telas.

**Critérios de aceite:** comparar antes/depois em viewport equivalente ao vídeo; mais conteúdo útil visível sem scroll inicial excessivo; botões sem sobreposição em 390/768/1024/1440px, claro/escuro e zoom 200%; catálogo/favoritos, abertura de trilha, ativar/cancelar avisos, upload/remoção de foto e acesso à senha mantidos. Realizar verificações com contas/fixtures de teste e sem envios de notificações reais. Typecheck e testes pertinentes; não criar testes que apenas fixam o texto de cada classe CSS.
