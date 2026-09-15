# DOC-Academy — piloto interno

Aplicação Next.js, React e TypeScript com Supabase Auth e PostgreSQL. O exemplar antigo permanece em ../.legacy.

## Ativação

Siga [ATIVAR-PILOTO.md](ATIVAR-PILOTO.md) para configurar a Vercel, aplicar a migração e criar o primeiro administrador. O banco começa vazio. O aplicativo não usa os dados locais da demonstração.

## Desenvolvimento

Instale as dependências com pnpm install. Configure .env.local usando .env.example, sem versionar chaves, e execute pnpm dev. Acesse http://127.0.0.1:4174. Em compartilhamentos Windows, execute uma cópia local do projeto para evitar problemas com os links de dependências.

## Verificação

pnpm test executa testes de regras, isolamento de respostas e comandos PostgreSQL via PGlite. pnpm typecheck verifica TypeScript; pnpm build gera a aplicação. A homologação com contas e vídeos reais exige a configuração do projeto Supabase.

## Arquitetura

- src/components/academy-provider.tsx: sessão e comandos de atualização, sem persistência de cursos em localStorage.
- src/lib/pilot-contract.ts: comandos validados; a API não aceita sobrescrever o estado inteiro.
- src/app/api/academy/route.ts: autenticação obrigatória e respostas sem cache.
- src/lib/pilot-server.ts: autorização, ocultação de gabaritos, relatórios por gestor e acesso ao Supabase.
- supabase/migrations: tabelas com RLS e sem acesso direto de anon/authenticated; comandos transacionais disponíveis somente ao servidor.
- src/components/vimeo-lesson.tsx: acompanhamento dos trechos reproduzidos pelo Vimeo.

O servidor verifica a identidade via Supabase Auth em cada requisição e consulta o perfil ativo no banco. As notas, snapshots de questões e XP são registrados em transações. Tokens de sessão são gerenciados pelo SDK no navegador; senhas de usuários são gerenciadas pelo Supabase Auth. A chave service_role/secret fica exclusivamente no servidor.

## Ainda fora do piloto

IA/RAG, certificados oficiais, upload de arquivos, fechamento de temporadas e ambiente de clientes. Estabelecer rotina operacional de backups, restauração e monitoramento antes da ampliação.
