# Etapa 4 — Preferência e avisos de desafios

## Persistência e contratos

- Migration incremental criada pela CLI: `20261006193250_periodic_quiz_notifications.sql`.
- `academy_preferences.quiz_notifications_enabled` começa `false`; `quiz_notifications_since` começa nulo.
- Comando estrito `{ type: "quiz-notifications", enabled: boolean }`, encaminhado por `executeCommand` à RPC específica. Ator vem da sessão; campos de ator/data enviados pelo cliente são rejeitados.
- A RPC valida perfil ativo e altera somente essas duas colunas. Opt-in repetido conserva a adesão; cancelar limpa a adesão; reativar usa o relógio do servidor e não recupera backlog.
- O escritor existente de bookmarks/lidos continua intacto e altera somente suas colunas. Os dois UPSERTs conservam os campos do outro escritor.
- `state.quizNotifications` contém `{ enabled, since }`. `GET /api/quizzes/notifications` retorna apenas `{ userId, quizNotifications, readNotices, notifications }`, com sessão e `no-store, private`.
- Carregamento inicial e endpoint leve usam `readQuizNotifications` e a mesma RPC. Nenhuma pergunta, resposta ou gabarito é consultado para construir avisos.

## Publicação

`announcement_at` é mantido por um trigger pequeno, compartilhado pelas RPCs existentes de salvar, ativar e excluir. Preserva as correções SQL, revisão, locks e snapshots das etapas anteriores.

Nas novas edições, primeira ativação registra `max(now(), available_from)`. Antes de atingir o horário, reagendar ajusta o anúncio e desativar/excluir o cancela. Depois de atingir o horário, a data permanece: pausar, reativar ou editar título/corte não cria outro anúncio. Público publicado fica bloqueado com conflito `QUIZ_AUDIENCE_LOCKED`; administração oferece nova edição e desabilita o campo de público.

**Backfill conservador:** o schema antigo não possui histórico de ativação. Todas as edições preexistentes com `available_from` já atingido recebem um marco anterior à nova adesão, inclusive pausadas e drafts antigos. Assim, reativar uma edição antiga não dispara avisos em massa. Para publicar um desses drafts com anúncio novo ou trocar seu público, usar **Criar nova edição**. Edições futuras ativas conservam o agendamento; futuras inativas continuam sem anúncio. O marco de backfill não é uma reconstrução da data histórica exata de publicação.

Avisos exigem opt-in, anúncio posterior à adesão e já liberado, disponibilidade atual, público real e ausência de tentativa oficial própria. Pausa, conclusão, expiração ou exclusão removem o aviso na próxima consulta. ID estável `quiz-published:<quizId>`; `readNotices` continua sendo a única fonte de leitura. Avisos são calculados, sem inbox durável, agendador, e-mail ou push.

## Interface e atualização

- Central tem **Avisar sobre novos desafios**, inclusive vazia, com habilitar/cancelar, carregamento, confirmação e erro mantendo a última preferência confirmada.
- Sino mescla desafios com sugestões existentes por ID; consultas leves substituem somente os avisos de desafios.
- Ao abrir o sino, mudar de rota, retornar à aba ou focar a janela, os avisos são consultados novamente. A sincronização completa que o provider já fazia por rota/foco permanece.
- Optantes com página visível consultam o endpoint leve a cada 60 segundos. Esse polling não recarrega perguntas nem AcademyState.
- Aba oculta, desmontagem, troca de conta e simulação cancelam timer/requisição. AbortController, geração da consulta e identidade real impedem resposta antiga de outra sessão. Falha conserva último estado válido.
- Respostas completas mais antigas preservam avisos/preferência recentemente confirmados e ainda incorporam outras fontes de avisos.
- Simulação não altera identidade nem preferência; esconde controle e avisos pessoais e suspende a consulta leve.

## Verificação

Executados em `platform/`:

```text
pnpm typecheck
pnpm test src/lib/quiz-notifications.test.ts src/lib/quiz-notifications-route.test.ts src/lib/periodic-quiz-history.test.ts src/lib/periodic-quizzes.test.ts src/lib/quiz-admin-route.test.ts src/lib/periodic-quiz-routes.test.ts src/lib/periodic-quiz-studio.test.ts
```

89 testes passam (17 novos). O histórico da etapa 2 também carrega a migration da etapa 4 para comprovar preservação dos contratos. PGlite testa A/B, públicos, perfil inativo, idempotência/reativação, ambos os escritores de preferências, agendamento pelo relógio do banco, cancelamento/reagendamento, público publicado, estabilidade ao editar/reativar, nova edição, leitura, remoção por conclusão/expiração/exclusão, RLS e grants. A consulta HTTP usa ator autenticado e não devolve campos extras; erros não viram sucesso vazio.

8 fluxos no Chromium visível, com sessão e APIs de teste: preferência após reload/erro, sino com sugestão e desafio/lido, polling 60s leve, pausa/retorno de aba, falha preservando estado, simulação, 375px claro/escuro e teclado, cliente real e resposta pendente após troca de identidade via evento de autenticação. Relatório, script e capturas estão em:

`C:/Users/Daniel José/.codex/visualizations/2026/10/06/01a111e0-402c-7a63-9a03-a04c2bd94048/desafios-etapa4/`

## Pendências de publicação

- Migration preparada e validada em banco isolado; nenhuma aplicação no Supabase de produção.
- Reconciliar histórico remoto incompleto, aplicar schema incremental antes do código e verificar no destino autenticado.
- PGlite executa as chamadas concorrentes em uma conexão. Confirmar concorrência em PostgreSQL isolado com sessões separadas, incluindo os gates de save/submit da etapa 2 e opt-in/bookmark/lido da etapa 4.
- Revisar edições legadas classificadas pelo backfill; drafts antigos que precisem anúncio novo devem ser duplicados antes da publicação.
- Commit/push conjunto das etapas permanece pendente. Próxima etapa não iniciada.
