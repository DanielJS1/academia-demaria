# Publicação da reformulação

Preparação em 13/10/2026, autorizada pelo proprietário no chat após o fechamento da etapa 10.

- Repositório: `DanielJS1/academia-demaria`; branch de produção: `main`.
- Vercel: projeto `academia-demaria`, ID `prj_bciyjDogXHy0bfJSGOHlihSpnif1`, equipe `daniel-js`, raiz `platform`, Node 24 e Next.js.
- Aplicação: `https://academia-demaria.vercel.app`.
- Supabase produção: `ktmymzokgxmmkleacclq`; homologação: `attnodzrjlhqydhrgqtr`.
- Build local de produção aprovado; suíte de 430 testes e 11 cenários de players já verificada na etapa 10.

## Banco aplicado

`20261013011330_report_temporal_events.sql` foi aplicada pelo mecanismo de migrações Supabase em ambos os projetos. As fontes de presença, aprendizagem, desafios, comunidade e Trilhas já existiam; não foram reaplicadas migrações antigas somente porque não constavam integralmente no histórico do projeto de produção.

Verificação posterior: cinco tabelas analíticas com RLS e sem SELECT para o papel de navegador `authenticated`, quatro triggers e nenhum evento de conclusão artificial criado para o baseline.

- Homologação: coleta iniciada em `2026-10-13T05:49:43.922665Z`, duas observações baseline.
- Produção: coleta iniciada em `2026-10-13T05:51:02.703425Z`, 55 observações baseline, zero conclusões temporais no instante da verificação.

A migração registra eventos prospectivos e preserva datas legadas desconhecidas. Não modifica concessão de XP, notas ou conclusão do produto. Não foram realizados comandos de teste com colaboradores reais em produção.

## Configuração e implantação

Variáveis principais de Supabase, origem pública, cron e Discord foram confirmadas por nome/ambiente; valores secretos não foram publicados ou copiados para este documento. O cron de Trilhas já existia na produção anterior. Canais e políticas não foram ativados pela reformulação; nenhuma chamada manual à rotina de envio será usada como teste de publicação.

A conexão MCP da Vercel recusou o escopo `daniel-js`; a CLI autenticada confirmou a conta/equipe e o projeto exato. Usar a CLI com projeto/equipe explícitos mantém o destino correto.

Uma implantação de produção sem atribuição de domínio permite verificar o build com as variáveis finais antes da promoção. A promoção deve apontar ao mesmo build validado. Implantação anterior conhecida para rollback: `dpl_6LA6voAQgBcdKBqaJYECXjoWbwcV`, `academia-demaria-uk6790jl0-daniel-js.vercel.app`.

## Arquivos fora da publicação

`.vercelignore` exclui evidências de QA, diretórios temporários, cache, credenciais locais e ferramentas de agentes. Scripts locais de refinamento de proficiência e `test-trails-live.mjs` não pertencem ao commit da reforma; alterações preexistentes foram preservadas no workspace.

## Estado

Publicação concluída em 13/10/2026 pela PR #47 (`https://github.com/DanielJS1/academia-demaria/pull/47`), integrada no commit `bdd0f0806a5522c0d39593547dc25a1eaeaf37a1`. Checks de CI, segurança, Vercel e Vimeo real aprovados antes da integração.

Build validado `dpl_BLGEZEZw8hWJQDUcztJwFTUUFa9q` promovido; a integração de main gerou a implantação automática `dpl_4RZoUFZ4LUicmpfyXCvu27X7kxQj`, READY, no mesmo código. Aplicação `/acesso` e BC pública responderam 200; relatórios e rotina de lembretes sem autenticação responderam 401. Fluxos autenticados e persistência foram validados no banco isolado de homologação.

O projeto separado de homologação também acompanha main; detalhes e roteiro em `HOMOLOGACAO-APRESENTACAO.md`.
