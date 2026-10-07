# Desafios — rollout das etapas 1 a 4

## Contratos para a etapa 3

Schemas e tipos: `src/lib/periodic-quizzes.ts`. As rotas exigem sessão autenticada, usam o perfil real e retornam `Cache-Control: no-store, private`.

| Endpoint | Contrato |
| --- | --- |
| `GET /api/quizzes` | `{ available, completed }`. Disponíveis contêm metadados, `revision`, `questionCount`, `requiredCorrect`; nenhuma pergunta ou gabarito. Concluídos contêm somente resultados do usuário, sem a lista de revisão. |
| `GET /api/quizzes/:id` | `{ quiz, result }`. Antes da tentativa, perguntas públicas e `result: null`; depois, perguntas do snapshot e resultado com revisão própria. Para legado não reconstruível, `quiz: null`, `reviewAvailable: false`, contadores/corte/prêmio/revisão nulos e resultado original preservado. |
| `POST /api/quizzes/:id/submit` | `{ answers, expectedRevision }`. Resultado persistido com `xpGranted` histórico, `newlyGrantedXp` desta requisição, `replayed`, contagens, corte, prêmio, revisão e versão da regra. Reenvio válido recupera a tentativa; nunca troca respostas nem repete XP. |
| `GET /api/quizzes/manage` | Administração interna; inclui `revision`, `has_attempts` e perguntas completas. |
| `POST /api/quizzes/manage` | Draft compartilhado. Atualização exige `id`, `expectedRevision` e IDs de perguntas preservados. Após resposta, perguntas/gabarito/público ficam bloqueados; metadados/corte/prêmio valem para novas tentativas. |
| `PATCH /api/quizzes/manage` | `{ id, active, expectedRevision }`. |
| `DELETE /api/quizzes/manage` | `{ id, expectedRevision }`; exclusão lógica mantém histórico. |

O endpoint `/active` permanece compatível. A etapa 3 integrou central, contagem e banner ao resumo compartilhado de `/api/quizzes`; o runner usa detalhe por ID para recuperar resultados encerrados. Central, tipografia/foco e verificação visual estão descritos em `docs/desafios-etapa3.md`. A etapa 4 implementou preferência persistida e avisos no sino; contratos, backfill de publicação e verificação estão em `docs/desafios-etapa4.md`.

`QUIZ_REVISION_CONFLICT` (409) exige atualização explícita. O administrador conserva o draft até optar por recarregar. O aluno precisa atualizar e conferir as regras antes de enviar novamente. Clientes antigos sem revisão recebem esse conflito na primeira tentativa, mas podem recuperar uma tentativa já registrada.

Regra 2: aprovado recebe exatamente o prêmio; reprovado recebe `min(2 * acertos, prêmio)`. Prêmio zero não gera evento. Corte usa a razão exata de acertos, sem arredondar antes de decidir aprovação. Uma tentativa por usuário/ID e evento único `quiz:<id>`. Nova edição é novo draft com novo ID/slug, sem tentativas ou XP copiados.

## Migrations preparadas

1. `20261006181438_fix_periodic_quiz_save.sql`: correção incremental da referência inválida, preservando o bloqueio da etapa 1.
2. `20261006182007_periodic_quiz_history_rewards.sql`: revisão, snapshots, backfill validado, regra 2, leitura/resumo e RPCs com revisão.
3. `20261006193250_periodic_quiz_notifications.sql`: preferência específica, marco de publicação, trigger compartilhado e consulta leve de avisos.

As três foram criadas pela CLI Supabase 2.119.0 e validadas em PGlite. Nenhuma foi aplicada ao projeto remoto nesta entrega. O histórico remoto conhecido está incompleto: conferir os objetos e reconciliar o histórico antes do rollout; não reaplicar as migrations antigas indiscriminadamente.

A etapa 4 conserva `academy_mutate` e as RPCs de desafios: um trigger trata publicação em salvar/ativar/excluir. O backfill considera edições antigas cuja disponibilidade já começou como anteriores à nova adesão, inclusive drafts/pausadas, pois não existe histórico de ativação. Não dispara backlog; drafts antigos que precisem anúncio novo devem virar nova edição. Após publicação, público fica bloqueado também sem respostas (`QUIZ_AUDIENCE_LOCKED`, 409). Preferências novas começam desligadas.

Aplicar o schema antes do código dependente. A etapa 2 substitui as assinaturas de submit/ativação/exclusão, mantendo parâmetros de revisão opcionais na RPC para clientes antigos receberem conflito explícito. Notifica o PostgREST para atualizar o cache de schema. As tabelas continuam com RLS e sem acesso direto de anon/authenticated; funções são SECURITY INVOKER com execução apenas para service_role.

O backfill bloqueia temporariamente escrita nas três tabelas de desafios para obter um conjunto consistente. Revalida quantidade, identidade das respostas, opções/gabarito, nota, aprovação e prêmio da regra antiga. Não modifica notas, aprovação, XP registrado ou ledger. Incompatibilidades geram aviso agregado e `snapshot_status='unavailable'`; não atribuir XP retroativo nem preencher histórico por suposição.

Antes de publicar, verificar em ambiente isolado com dados representativos e revisar o relatório após aplicar a migration:

```sql
select scoring_version, snapshot_status, count(*)
from public.academy_quiz_attempts
group by scoring_version, snapshot_status;
```

Guardar os totais de tentativas, score/pass/XP e ledger antes/depois para comprovar preservação. A investigação anterior identificou quatro tentativas compatíveis; a migration revalida os dados presentes no momento da aplicação.

## Verificação e gates

Testes focados: `periodic-quizzes`, `quiz-admin-route`, `periodic-quiz-history`, `periodic-quiz-routes`, `periodic-quiz-studio`, `quiz-notifications`, `quiz-notifications-route` (89 testes). Typecheck: `pnpm typecheck` em `platform/`.

Cobertura inclui backfill compatível/incompatível, matriz 0–5/cortes 60/70, extremos 0/100, prêmio zero/teto, reenvio diferente, recuperação de resposta, histórico após corte/pausa/expiração/exclusão, IDs/reordenação, nova edição, rollback do XP, conflito de revisão, público/perfil/dono, gabarito protegido e privilégios.

**Concorrência validada na etapa 5:** PostgreSQL 17.11 isolado com conexões distintas: dois submits diferentes preservam tentativa/evento únicos; save anterior rejeita submit antigo; submit anterior bloqueia mudança estrutural; saves simultâneos preservam revisão/IDs. Script: `scripts/check-periodic-quiz-concurrency.mjs`, exige banco local vazio `quiz_*` e variáveis `QUIZ_PG_PORT`, `QUIZ_PG_DATABASE`, `QUIZ_PG_USER`, opcional `QUIZ_PSQL_PATH`. Não aponta para produção.

Também passaram, em sessões distintas, adesão simultânea sem avanço de `since` e escrita concorrente de bookmarks/lidos/preferência sem perda das colunas independentes.

Também ficam pendentes a aplicação remota das migrations, publicação do código e verificação visual autenticada no ambiente de destino. Commit/push conjunto das etapas ainda não foi executado.

## Pré-condições e sequência final

1. Provisionar Supabase isolado, sem copiar dados pessoais. Como o histórico remoto é incompleto, conferir objetos existentes antes de aplicar baseline; não executar `db push` cegamente no projeto principal. Criar perfis/contas dedicados, com administrador, aluno, gestor e cliente.
2. Validar migrations e E2E reais nesse ambiente, incluindo chamadas HTTP autenticadas. Os testes com respostas controladas não substituem essa integração.
3. Antes do rollout, guardar a saída de `periodic-quizzes-schema-check.sql`, backup e versão da aplicação em execução. Conferir catálogo/definições, além do histórico de migrations; o código antigo contém a referência inválida já diagnosticada.
4. Com os gates aprovados, aplicar somente as migrations incrementais novas, nesta ordem: `20261006181438_fix_periodic_quiz_save.sql`, `20261006182007_periodic_quiz_history_rewards.sql`, `20261006193250_periodic_quiz_notifications.sql`. A migration de histórico bloqueia brevemente as tabelas; considerar janela sem tentativas em andamento.
5. Reexecutar o SQL de verificação. Fingerprints/totais de tentativas e ledger devem coincidir; nenhuma nota, aprovação ou XP antigo deve mudar. Conferir oito RPCs finais, assinaturas, ausência da referência inválida, `SECURITY INVOKER`, grants apenas para servidor e RLS. Relatório de backfill pode conter snapshots indisponíveis; não corrigir resultados antigos por suposição.
6. Publicar aplicação compatível com o schema, conferir sessão/lista/avisos sem criar tentativa na conta pessoal e disponibilizar link para o usuário. Arquivar evidências sanitizadas; não publicar credenciais, payloads de respostas ou traces autenticados.

## Reversão sem perda de histórico ou XP

Preservar todas as tabelas, snapshots, revisões, preferências e ledger. Não remover migrations, recalcular XP nem apagar tentativas para voltar a um build anterior. A aplicação antiga envia operações sem revisão esperada: após a etapa 2 elas recebem conflito, portanto retornar ao build antigo não restaura plenamente a escrita dos desafios. Em falha, manter essas escritas indisponíveis até republicar um build compatível; os demais módulos podem continuar. Preparar correção da aplicação ou usar o último build já compatível. Reversão de schema exige plano específico e validação isolada; não executar SQL destrutivo como rollback automático.
