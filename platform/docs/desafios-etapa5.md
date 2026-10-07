# Revisão integrada dos desafios — 06/10/2026

## Correções da revisão

- Requisições do provider verificam identidade antes e depois de obter sessão e antes de processar respostas de erro. Uma resposta antiga não limpa o estado da conta seguinte.
- Runner remonta por usuário/desafio, confere identidade da sessão e bloqueia alternativas durante envio ou conflito de revisão.
- Fixture de `pilot-server` passou a responder ao contrato específico dos avisos.
- Verificador de migrations corrigiu nome antigo, percorre as 28 migrations e confere as definições/grants finais das RPCs dos desafios. Preserva os testes originais de vídeo na fronteira anterior à migration de recuperação, que alterou essa regra.

## Validação executada

- `pnpm test`: 23 arquivos, 220 testes aprovados.
- `pnpm typecheck`: aprovado.
- `pnpm build`: aprovado após as correções de sessão.
- `node scripts/check-security-migrations.mjs`: cadeia completa e permissões finais aprovadas em PGlite.
- `scripts/check-periodic-quiz-concurrency.mjs`: seis cenários aprovados em PostgreSQL 17.11 local, com processos/conexões distintos. Banco temporário independente; nenhuma conexão com banco DeMaria ou Supabase de produção.
- Playwright com Auth/API controlados: nove fluxos da central/runner e oito de avisos aprovados. Capturas em `desafios-etapa5` no diretório de artefatos da conversa; 375/768/1440px, claro/escuro, zoom 200%, teclado, histórico/reload e sessão.

Concorrência: dois payloads simultâneos produzem uma tentativa/evento e replay; save anterior rejeita submit desatualizado sem XP parcial; submit anterior bloqueia mudança estrutural; dois saves preservam vencedor, revisão e IDs; adesão simultânea mantém `since`; alterações concorrentes de bookmark/lido e preferência preservam colunas independentes.

## Integração em homologação

Supabase separado `attnodzrjlhqydhrgqtr` provisionado na organização DanielJS, com as 28 migrations, quatro contas dedicadas e dados fictícios. Os sete E2E passaram contra Auth/API/banco reais: isolamento de públicos, PDF privado, anotações, XP único, relatórios, desafios e retomada do Vimeo. Foram executados em grupos; o teste de desafios passou após corrigir uma espera prematura pelo controle de avisos. O Vimeo falhou inicialmente por ausência de resposta do player externo na reabertura e passou na repetição, sem alteração da aplicação.

Semgrep SAST e secrets scan aprovados no GitHub Actions (`37543741836`). Build final de homologação aprovado localmente e na Vercel; login administrativo e central conferidos no deployment Preview. Leitor de tela nativo não foi validado; testes verificam semântica, descrição, foco e teclado no navegador.

No mesmo CI, typecheck e os 220 testes de domínio passaram; seis E2E passaram, incluindo desafios. O gate de qualidade ficou vermelho porque o iframe Vimeo não respondeu a `getDuration` no runner GitHub, inclusive no retry (retorno de timeout `-1`). A captura do runner confirmou uma página do Vimeo restringindo a conexão: “We couldn't verify the security of your connection.” O teste passou localmente contra o mesmo Supabase isolado. Não foi removido nem convertido em sucesso artificial. Validar esse gate em runner com conexão aceita pelo Vimeo antes da aprovação de produção; não contornar o bloqueio do provedor.

Correção posterior: fixtures de adesão usam instante explicitamente anterior à publicação, evitando igualdade no relógio de PGlite; regressão confirma exclusão quando os timestamps são iguais. O CI valida o transporte do player por contrato mantendo SDK/Auth/API/banco reais; a integração Vimeo externa permanece em `live`, com status separado obrigatório para o SHA exato. Consulte `tests/e2e/README.md` e `scripts/verify-vimeo-live.mjs`.

## Fluxo e publicação

Desafios não têm fallback local: central, resumo, tentativa, resultado e avisos dependem do servidor e do schema Supabase. Falhas devem exibir recuperação explícita, sem simular publicação, crédito ou adesão.

Ordem, verificações de schema e reversão estão em `supabase/periodic-quizzes-rollout.md`. Produção permanece sem as três migrations novas. Não publicar o frontend dependente antes de aplicar e verificar o schema. A branch `codex/homologacao` será publicada como Preview para aprovação do usuário; integração em `main` e migrations de produção ficam para depois dessa aprovação. Consulte `homologacao.md` para o fluxo de aprovação.
