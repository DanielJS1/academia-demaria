# Auditoria de segurança pré-produção — 30/09/2026

Escopo: código deste repositório e migrações versionadas. Esta revisão não teve acesso ao projeto Supabase de produção nem às configurações do domínio/provedor de hospedagem. **O lançamento ainda depende dos itens em aberto abaixo.**

| # | Requisito | Resultado | Evidência / ação pendente |
|---|---|---|---|
| 1 | Chaves privadas só no servidor | Conforme no código | `SUPABASE_SERVICE_ROLE_KEY` só é lida em módulos/rotinas de servidor. Confirmar escopo das variáveis no provedor de hospedagem e rotacionar qualquer chave previamente exposta. |
| 2 | `.env*` protegido | Conforme | `.gitignore` ignora `.env` e `.env.*` em qualquer diretório; `.env.example` é um template público sem credenciais. `git ls-files '*env*'` não listou arquivos de segredo. |
| 3 | Frontend com anon key | Conforme | `src/lib/supabase-browser.ts` usa somente URL pública e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| 4 | RLS e políticas por usuário | Arquitetura de acesso fechado; requisito literal pendente | As 24 tabelas `academy_*` têm RLS habilitado e nenhum privilégio direto de SELECT/INSERT/UPDATE/DELETE para `anon` ou `authenticated` no projeto conectado, verificado em 30/09/2026. A falta de políticas é intencional neste desenho: o servidor usa `service_role`, que ignora RLS. Adicionar políticas apenas para remover o aviso não melhora a segurança. Para cumprir o requisito literal, é necessária uma migração arquitetural para acesso com contexto do usuário, políticas por operação e testes de autorização. |
| 5 | Criptografia em repouso | Não verificável | Confirmar criptografia do banco, backups e Storage na configuração/contrato do Supabase. Para dados de alta sensibilidade, definir criptografia de aplicação e gestão de chaves. |
| 6 | SQL/RPC parametrizados | Conforme no código revisado | Consultas usam PostgREST e `rpc` com argumentos estruturados; não foi identificada concatenação de input em SQL no TypeScript. Revisar funções PL/pgSQL futuras para SQL dinâmico. |
| 7 | Auth server-side com `@supabase/ssr` | Parcial | `authenticate()` valida o bearer token no servidor com `auth.getUser(token)`, mas não usa `@supabase/ssr` nem sessão em cookies. Migrar o fluxo de login, refresh e API antes de marcar este requisito como concluído. |
| 8 | Cookies HttpOnly/Secure/SameSite | Não conforme | O cliente atual usa sessão Supabase no navegador, acessível ao JavaScript. Implementar sessão controlada pelo servidor com cookies `HttpOnly`, `Secure`, `SameSite=Lax/Strict` e proteção CSRF nas mutações. A abordagem padrão de browser client do `@supabase/ssr` por si só não garante `HttpOnly`. |
| 9 | Hashing de senhas | Conforme no código | Cadastro chama Supabase Auth `admin.createUser`; login chama Supabase Auth. Confirmar política de senha e MFA no painel de Auth. |
| 10 | RBAC em endpoints/ações | Parcial | Os endpoints chamam `authenticate()` e há verificações por papel e audiência nos comandos; não há Server Actions. Auditar cada ação privilegiada e cada função RPC no banco, já que `service_role` ignora RLS. |
| 11 | Mass assignment | Melhorado; revisão restante | Contrato de comandos passou a usar `z.strictObject`; cadastro e notas agora usam `.strict()`. Os schemas de domínio aninhados e demais payloads devem ser examinados em cada caminho de escrita. |
| 12 | Fallback local do provider | Conforme | O estado inicial de `AcademyProvider` contém apenas coleções vazias; não foi encontrado seed/mock de outros usuários no bundle desse fluxo. |
| 13 | Respostas enxutas | Melhorado; revisão restante | Leituras centrais de `pilot-server.ts` passaram a selecionar colunas explícitas. A resposta `/api/academy` ainda contém o estado necessário ao cliente; revisar campos administrativos e o escopo de pessoas para cada papel. |
| 14 | Validação backend com Zod | Parcial | Comandos, cadastro, notas e rotas de quiz/engajamento usam `safeParse`; há entradas de query string e multipart com checagens manuais. Padronizar schemas e limites em todas as rotas. |
| 15 | Uploads seguros | Parcial | Rotas limitam bytes e validam assinaturas básicas de PDF/imagem; buckets versionados definem tamanho e MIME. `service_role` ignora políticas de Storage, e a inspeção de SQL/XLSX é superficial. Validar conteúdo real com parser/antivírus quando aplicável e revisar permissões/buckets reais. |
| 16 | Rate limiting distribuído | Não conforme | Cadastro usa `Map` por processo e IP derivado de cabeçalho, inadequado em ambiente distribuído. Login é direto pelo Supabase Auth; `/api/academy` não possui limite. Configurar limites no Supabase Auth e rate limit centralizado/WAF para cadastro e APIs críticas. |
| 17 | Proteção contra bots | Preparado; configuração pendente | Cadastro valida Turnstile no servidor quando `TURNSTILE_SECRET_KEY` está presente. Em produção, cadastro falha fechado se a chave secreta faltar. Configurar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` reais e testar o widget; cobrir também recuperação/login se necessário. |
| 18 | Security headers | Implementado com ressalva | `next.config.ts` define CSP, HSTS, X-Frame-Options e X-Content-Type-Options. A CSP usa `unsafe-inline` por compatibilidade com a renderização atual; substituir por nonce/hash após teste funcional da aplicação. Validar CSP efetiva com Vimeo, YouTube, Storage e Turnstile. |
| 19 | HTTP → HTTPS | Não verificável | HSTS e `upgrade-insecure-requests` foram adicionados, mas o redirecionamento na borda deve ser configurado e testado no domínio de produção. |
| 20 | Dependências | Conforme na data da revisão | `npm audit --json` retornou 0 vulnerabilidades para dependências instaladas. Reexecutar em CI e antes de cada release. |

## Correções aplicadas nesta revisão

- Cadastro: validação estrita, limite real de corpo e verificação Turnstile no servidor.
- Contrato de comandos: objetos estritos, rejeitando propriedades extras.
- Leituras centrais: seleção explícita de colunas.
- Anexos privados de artigos: URLs assinadas exigem arquivo próprio ou referência em artigo visível ao usuário.
- Headers HTTP de segurança configurados.

## Gate de lançamento

Prioridade máxima: concluir os itens 7, 8, 16 e 19; configurar/testar o Turnstile (17); comprovar 5 e 15 no projeto Supabase; validar a CSP em navegador (18). O item 4 exige decidir entre manter o acesso fechado pela API com revisão completa de autorização e migrar para políticas RLS por usuário. Não tratar os 24 avisos informativos `rls_enabled_no_policy` como autorização para abrir as tabelas.

## Parecer sobre os 24 avisos do Supabase Security Advisor

Em 30/09/2026, o Advisor retornou 24 ocorrências `rls_enabled_no_policy`, todas com nível **INFO**. A consulta de privilégios ao projeto conectado confirmou, nas 24 tabelas, RLS ativo, zero políticas e ausência de privilégios diretos de SELECT, INSERT, UPDATE e DELETE para `anon` e `authenticated`. Isso é um esquema fechado para os clientes; os acessos passam pela API com `service_role`. Os avisos descrevem corretamente a ausência de políticas, mas não demonstram exposição dos dados. Manter essa configuração até que uma migração de autorização por usuário esteja projetada e testada.

Na mesma execução, o Advisor também mostrou dois avisos `function_search_path_mutable` e um de proteção contra senhas vazadas desativada. Esses itens são distintos dos 24 avisos enviados e devem ser tratados separadamente.
