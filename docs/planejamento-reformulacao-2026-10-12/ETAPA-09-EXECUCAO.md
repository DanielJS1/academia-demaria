# Etapa 09 — Aprender, Trilhas, Desafios e Evolução

Executada em 13/10/2026, somente no checkout local, preservando as alterações anteriores de Trilhas/Discord e das etapas 01–08.

## Entrega

- **Aprender:** `PageHeading` compacto, sem livro decorativo isolado. Contexto “Uma jornada para cada descoberta” e quantidade de cursos no topo; banner separado removido. Filtros lado a lado quando há espaço e empilhados em telas estreitas. Contagens das abas e dos resultados continuam funcionais, pois representam seus respectivos recortes.
- **Minhas Trilhas:** cabeçalho compacto e espaçamento de 24 px sem acumular margens. Organização, cursos, progresso, prazos e integração Discord preservados.
- **Desafios:** cabeçalho compacto; preferência de avisos em bloco menor com estado explícito, botão de 44 px e mensagens existentes de sucesso/erro. O comando `quiz-notifications` e a restrição durante simulação permanecem iguais.
- **Minha Evolução:** título/temporada e perfil em duas colunas a partir de 1200 px; empilhamento abaixo disso. Identidade, foto e senha permanecem acessíveis. Retirados os dois indicadores duplicados de XP/nível do perfil; o destaque da trajetória continua exibindo os mesmos cálculos. Histórico de conquistas e paginação do ranking preexistentes preservados.

## Arquivos desta etapa

- `platform/src/components/catalog.tsx`
- `platform/src/components/trails/my-trails.tsx`
- `platform/src/components/quizzes/quiz-center.tsx`
- `platform/src/components/quizzes/quiz-notification-control.tsx`
- `platform/src/components/evolution.tsx`
- `platform/src/styles/secondary-pages.css` — estilos limitados às quatro telas.
- `platform/src/app/globals.css` — importação da folha temática.
- Este registro e o status em `README.md`.

## Verificação

- `pnpm exec next typegen` e `pnpm typecheck`.
- **70 testes aprovados em cinco arquivos:** `quiz-notifications.test.ts`, `quiz-notifications-route.test.ts`, `periodic-quiz-routes.test.ts`, `learning-rewards.test.ts` e `trails.test.ts`. Cobrem preferências/avisos, tentativas de desafios, recompensas e regras de trilhas.
- Playwright com Chromium visível e fixtures isoladas: **32 combinações** de quatro telas × quatro larguras (390/768/1024/1440 px) × claro/escuro. Sem rolagem horizontal. Reflow equivalente a 200% verificado reduzindo à metade o viewport CSS em cada combinação; não é uma alegação de acionamento do zoom nativo do navegador.
- Fluxos no navegador: pesquisa com/sem resultados, abas do catálogo, salvar favorito, abertura de curso pela trilha, habilitar/cancelar avisos e falha preservando a preferência, upload e remoção de avatar, abertura do diálogo de senha. Sem erros JavaScript na rodada aprovada.
- Comparação do catálogo em **1440 × 900 px**: captura anterior e posterior com a mesma fixture. Cabeçalho/banner de aproximadamente 229 px para 112 px; primeiros cards de aproximadamente y=754 para y=474, cerca de **280 px mais acima**. A comparação anterior registrada é do catálogo; as outras telas possuem capturas finais em todas as combinações.
- Inspeção visual das capturas e revisão React: componentes/variantes existentes, sem novos efeitos, requisições, dependências ou mudanças de regras de dados.

Evidências em `output/secondary-stage09/`: screenshots, `validation.json`, script Playwright e fixture de bootstrap. A rota temporária de bootstrap foi removida ao finalizar.

## Limites

As APIs foram interceptadas com fixtures; serviços externos bloqueados. Nenhuma notificação real enviada. Upload simulado valida o fluxo de interface e o comando de avatar, sem testar armazenamento remoto; o diálogo de senha foi aberto sem trocar senha real. Navegação à sala de aula verificada, sem reproduzir vídeo externo. Não houve deploy, push ou migração de banco nesta etapa.

Próxima etapa prevista: **10 — Validação integrada e fechamento**, ainda não executada.
