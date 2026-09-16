# Plano: Supabase no servidor DeMaria e frontend na Vercel

Status: planejamento futuro, sem mudança de infraestrutura neste momento.
Decisão registrada em 16/09/2026 a pedido de Daniel, após alinhamento com Fred.

## Direção

Continuar desenvolvimento e homologação no Supabase gerenciado. Depois, migrar os serviços Supabase utilizados para infraestrutura DeMaria, preservando o frontend Next.js e o endereço na Vercel. Usar a distribuição oficial self-hosted, normalmente composta por vários containers Docker Compose, com volumes persistentes.

O backend atual tem duas partes: Supabase (PostgreSQL, Auth e funções SQL) e rotas API do Next.js executadas na Vercel. Migrar apenas Supabase mantém essas rotas na Vercel. Se Fred desejar todo o backend no servidor, separar também essas rotas em um serviço próprio é uma segunda etapa de arquitetura, não apenas uma exportação do banco.

## Conectividade e operação

- A API na Vercel e, na arquitetura atual, os navegadores que usam Supabase Auth precisam alcançar os endpoints Supabase. Um IP acessível apenas pela rede interna não atende sozinho a esse desenho. Definir com Fred domínio HTTPS e acesso controlado ou conectividade privada compatível com todos esses clientes.
- PostgreSQL e painéis administrativos não precisam ficar abertos ao público. Definir proxy, certificados, firewall, segredos e permissões.
- DeMaria assume backups, testes de restauração, monitoramento, atualizações, armazenamento persistente e disponibilidade. Reiniciar/recriar containers não pode apagar dados.
- Dimensionar após medir banco, arquivos, concorrência e serviços efetivamente usados. Self-hosting pode reduzir fatura externa, mas traz custos operacionais.

## Preparação durante o desenvolvimento

- Manter migrações SQL, políticas, funções e documentação no Git.
- Manter URLs/chaves em variáveis de ambiente; não versionar segredos, dumps ou arquivos privados.
- Evitar URLs do provedor fixadas nos conteúdos; guardar identificadores/caminhos de arquivos quando possível.
- Inventariar Auth, tabelas, extensões, funções, arquivos, SMTP e futuras integrações da base de conhecimento.
- Realizar uma migração de ensaio antes do fechamento do projeto para identificar incompatibilidades cedo.

## Sequência de migração

1. Fred provisiona ambiente isolado de homologação, versões compatíveis de PostgreSQL/Auth e serviços necessários.
2. Exportar schema, dados, roles e dados de autenticação pelo procedimento oficial. Restaurar e conferir contagens, vínculos, funções e permissões.
3. Copiar arquivos do Storage separadamente, caso já utilizado. Configurar SMTP, URLs de redirecionamento, chaves/JWT e provedores de login.
4. Testar login e recuperação de senha, aprovação/reprovação/exclusão, cursos sem avaliação, progresso Vimeo, correções, XP sem duplicidade, setores e conteúdo privado. Validar latência Vercel-servidor.
5. Programar janela de migração: suspender gravações, fazer cópia final, validar restauração, alterar variáveis da Vercel e fazer novo deploy. Planejar novo login dos usuários após troca das chaves.
6. Manter origem preservada por período acordado. Antes de aceitar gravações no destino, definir rollback; depois disso, conciliar os dados novos antes de retornar, evitando perda de progresso.

Contas podem ser preservadas com migração correta de Auth, mas sessões e configurações não são simplesmente transportadas. Não prometer uma migração sem novo login ou sem ensaio.

## Pontos para alinhar com Fred

- Migrar apenas os serviços Supabase ou também as rotas API Next.js?
- Quais recursos de servidor, volumes, backups e domínio estarão disponíveis?
- Como Vercel e navegadores alcançarão Auth/API?
- Quem ficará responsável pela operação e qual será a janela de migração?

## Referências oficiais

- https://supabase.com/docs/guides/self-hosting/docker
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
