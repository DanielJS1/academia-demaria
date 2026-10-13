# 02 — Padrão visual e componentes compartilhados

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisito: etapa 01 concluída como base de vocabulário; não depende dos endpoints futuros.

**Objetivo:** construir as peças compartilhadas da reforma para que Conhecimento, Minha Gestão, Relatórios e telas secundárias usem a mesma hierarquia.

**Pontos de entrada:** shared.tsx, components/ui/button.tsx e badge.tsx, components.json, theme.css, responsive.css, knowledge.css, team.css, trails.css, quizzes.css. Minhas Trilhas e Trilhas e avisos são referências de organização; o projeto não tem uma biblioteca completa de componentes UI instalada.

**Execute:**
1. Acrescente variante compacta opt-in de PageHeading mantendo compatibilidade com os usos atuais: alinhamento à esquerda, h1 28px desktop/24px mobile, descrição 14–16px, ações à direita e empilhamento quando necessário.
2. Reutilize Inter, Lucide, Button, Badge, Progress, EmptyState, SectionHeading e tokens de cor dos temas. Confira a cascata de responsive.css: ela não deve reduzir os textos da variante a 10–11px.
3. Prepare componentes pequenos que as próximas etapas realmente consumirão: MetricCard, FilterBar/AppliedFilters e padrão de estado de dados, seguindo a estrutura existente. Para painel/modal, use componente acessível existente ou consulte o catálogo shadcn antes de adicionar o mínimo; não instale um preset nem redesenhe o sistema todo.
4. Padronize escala 4/8/12/16/24/32; padding de cards 16–20px; corpo 16px, tabelas 14px e metadados 12–13px. Cards com rótulo curto, número e uma linha de contexto; sem grandes ilustrações decorativas.
5. Coloque estilos em folha temática existente ou page-layout.css, com globals.css apenas importando quando necessário. Evite overrides específicos espalhados e alturas fixas que cortem títulos.
6. Inclua foco visível, alvos adequados ao toque, títulos acessíveis para diálogos e conteúdo independente de hover. Implemente estados de carregamento, vazio, falha e dado parcial sem mostrar números fictícios.

**Critérios de aceite:** variante aplicável sem mudar globalmente páginas fora do escopo; estilos nos dois temas; títulos longos não sobrepõem ações; reflow em 390/768/1024/1440px e zoom 200%; contraste verificado. Não compacte agora as quatro telas secundárias, reservadas à etapa 09. Evite testes que só repetem markup; use typecheck e inspeção visual proporcional. Registre a API e exemplos mínimos dos componentes para as etapas seguintes.
