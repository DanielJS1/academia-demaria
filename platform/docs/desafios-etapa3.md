# Etapa 3 — central e questionário

## Fluxos e arquivos

- `src/app/desafios/page.tsx` e `components/quizzes/quiz-center.tsx`: disponíveis/concluídos, contagem, prazo, perguntas, corte, prêmio e resultado oficial. Estados de carregamento, vazio, todos concluídos, falha e nova tentativa de consulta.
- `components/quizzes/quiz-summary-provider.tsx`: uma consulta compartilhada a `GET /api/quizzes`, usada pela central, contagem e destaque. Cancela requisições antigas; atualiza ao mudar de rota/retornar à aba; remove itens cujo prazo chega ao fim enquanto a tela fica aberta. Não carrega perguntas para cards. A audiência é determinada pelo servidor, nunca pela simulação.
- `app-shell.tsx`: Desafios após Aprender nos menus interno/cliente, expandido/recolhido/mobile. Ativo também nas páginas de resultado.
- `dashboard.tsx`, `client-dashboard.tsx`, `quizzes/quiz-dashboard-access.tsx`: acesso permanente **Ver todos os desafios**, inclusive sem destaque.
- `hero-carousel.tsx`: usa somente pendentes da consulta compartilhada; prioriza destaque, depois semanal e demais disponíveis. Sem consulta própria a `/active`.
- `quizzes/quiz-runner.tsx`: detalhe e revisão persistida da etapa 2; Voltar leva à central. Enunciado somente leitura com 18–22px e entrelinha 1.5, RichText e imagens. O foco fica no identificador compacto Questão N de M, descrito pelo título/enunciado; radios e botões continuam nativos. Atalhos 1–6/A–F só atuam com foco no identificador ou alternativas e respeitam a quantidade real.
- `styles/quizzes.css`: central e questionário com os tokens existentes, sem truncar enunciados. `styles/navigation.css`: ajuste de overflow limitado às telas de desafios para manter a topbar sticky; antes, o body com overflow hidden/auto retinha o sticky fora da rolagem real. Confirmado em 375px: topbar em 0–60px e foco em ~96px após scroll.

Simulação suspende consulta e tentativa pessoais e oferece encerrá-la. Nenhuma identidade de cartório é enviada à API. Clientes reais continuam com acesso aos desafios do seu público. Resultados recuperados mostram XP **registrado**, sem anúncio de novo crédito. O corte exibido no resultado vem do snapshot. Respostas em andamento não persistem após reload; a saída explícita mantém confirmação quando há respostas.

## Verificação

`pnpm typecheck` e 72 testes Vitest focados das etapas 1/2 passaram. A verificação Playwright usa Chromium visível, servidor local, sessão de teste e respostas interceptadas para desafios/estado da conta; não grava tentativas/XP no Supabase remoto. Nove fluxos passaram, com verificações adicionais de falha de rede real (request abort), banner pendente e captura da ampliação em contexto dedicado.

Fluxos verificados no navegador: zero/um/vários, carregamento, erro/retry, contagem e cards sem GET de perguntas, expiração da disponibilidade, acesso permanente sem banner, menu recolhido/mobile, teclado e setas nativas, atalhos sem captura externa, descrição acessível/foco, saída cancelada/confirmada, avanço/volta, XP simbólico, saldo após reload, resultado/revisão após prazo, todos concluídos, simulação e público cliente. Capturas em 375/768/1440px, claro/escuro e layout equivalente a ampliação 200% (viewport CSS 720px, deviceScaleFactor 2). Nenhuma rolagem horizontal nesses casos.

Artefatos desta execução ficam em:
`C:/Users/Daniel José/.codex/visualizations/2026/10/06/01a111e0-402c-7a63-9a03-a04c2bd94048/desafios-etapa3/`.
Consultar `verificacao.json`, `rede-verificacao.json`, `banner-verificacao.json`, `zoom-verificacao.json` e as capturas `central-*` / `question-*`. O contexto de ampliação confirmou largura CSS 720px, devicePixelRatio 2, topbar em 0–60px, foco em 96px e ausência de overflow horizontal. O script de reprodução fica no mesmo diretório como `verificacao-playwright.cjs`, com fixtures, sem credenciais reais.

Limitações: não houve execução com leitor de tela nativo nem validação autenticada contra schema remoto publicado. A CSP atual bloqueia o eval do bundle webpack em desenvolvimento; o contexto de teste usou bypassCSP local, sem alterar headers/CSP do projeto. A ampliação é emulada no layout, não pelo controle de zoom nativo. As regras de banco e saldo real foram testadas separadamente em PGlite na etapa 2; concorrência com sessões PostgreSQL separadas continua pendente.

## Próximos gates

Preferência persistida de avisos/sino continua explicitamente para a **etapa 4**; não foi incluído botão que simule salvar. Publicação depende das duas migrations anteriores, aplicadas antes do código consumidor, e do roteiro em `supabase/periodic-quizzes-rollout.md`. Nenhuma etapa seguinte, publicação remota ou commit/push foi executada nesta entrega.
