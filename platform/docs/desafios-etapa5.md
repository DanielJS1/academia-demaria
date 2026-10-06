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

Semgrep não está disponível no Python deste host; o scan do workflow permanece pendente. Leitor de tela nativo não foi validado; testes verificam semântica, descrição, foco e teclado no navegador.

## Fluxo e publicação

Desafios não têm fallback local: central, resumo, tentativa, resultado e avisos dependem do servidor e do schema Supabase. Falhas devem exibir recuperação explícita, sem simular publicação, crédito ou adesão.

Ordem, verificações de schema e reversão estão em `supabase/periodic-quizzes-rollout.md`. Produção permanece sem as três migrations novas. Não publicar o frontend dependente antes de aplicar e verificar o schema. A branch `codex/homologacao` será publicada como Preview para aprovação do usuário; integração em `main` e migrations de produção ficam para depois dessa aprovação. Consulte `homologacao.md` para o fluxo de aprovação.
