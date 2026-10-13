# 08 — Minha Gestão e ficha operacional

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisitos: etapas 06 e 07 concluídas, com equivalência das análises migradas verificada.

**Objetivo:** transformar Minha Gestão no lugar claro para gerir colaboradores, acompanhar PDI, conceder conquistas e administrar trilhas/avisos.

**Pontos de entrada:** team.tsx, team.css, team-scope.ts, novos componentes de UI/relatórios, pilot-contract.ts, pilot-server.ts, RPC academy_grant_recognition, componentes trails/manage-trails.tsx, assignments.tsx e lib/trails-server.ts.

**Execute:**
1. Use cabeçalho compacto “Minha gestão”, ação principal “Trilhas e avisos” e acesso secundário “Ver relatórios”. Resuma departamento/escopo sem banner volumoso.
2. Mostre três cards operacionais: Equipe, Com atrasos e Precisam de contato. Ativos por padrão; pendentes em visão separada. Atraso = atribuição ativa incompleta com dueDate passada; contato = política de inatividade/baixa frequência já existente com cobertura suficiente. Cards abrem filtros. Não usar progresso <30% como risco nem somar categorias sobrepostas.
3. Lista operacional: pessoa/setor, situação de acompanhamento, último acesso conhecido e “Gerir”. Busca por nome/e-mail, filtro de departamento quando útil, filtros operacionais e paginação. Remova densidade analítica desnecessária.
4. Extraia ficha para components/management/: identificação e seções Acompanhamento, Conquistas e Trilhas. PDI/histórico e formulários separados por intenção. Use diálogo/painel acessível, foco contido, Escape e retorno de foco.
5. Conquista mantém título, justificativa, +100 XP e requestId idempotente. PDI mantém visibilidade atual e não ganha ação de enviar mensagem. Trilhas usa os comandos/fluxos existentes; não duplique editor, política ou serviço de alertas.
6. Suporte /equipe?pessoa=<id>&acao=pdi|conquista|trilhas. Valide escopo antes de abrir e trate pessoa inexistente/inativa. Relatórios individual e ação operacional navegam entre si com contexto. Amplie deep link para atribuições existentes sem ampliar permissão.
7. Migre/remova de Gestão médias, gráficos comparativos, seletor de presença, abas de desempenho por curso, avaliações e linha do tempo analítica somente após confirmar o destino em Relatórios. Preserve os históricos operacionais de PDI/conquistas.
8. Mantenha aprovação/exclusão/cadastro de pessoas e correções administrativas nos destinos atuais. “Gerir colaboradores” não autoriza mudança de papéis.

**Critérios de aceite:** gestor encontra uma pessoa e concede conquista sem entrar em análises; PDI continua acessível apenas a autorizados; request repetido não duplica XP; ausência de histórico não vira inatividade; atraso usa prazo real; links de relatório abrem ficha correta; pendente não recebe ação inválida; nenhuma análise existente desapareceu; telas/temas/teclado e mobile. Abrir relatório ou listar colaboradores não pode disparar novas mensagens ou mudar preferências.
