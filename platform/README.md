# DOC-Academy — primeira entrega

Frontend navegável em Next.js, React, TypeScript e Tailwind. Interface em português, modos claro/escuro e layout responsivo. Esta entrega é uma demonstração local com dados fictícios, persistidos apenas neste navegador.

## Iniciar no Windows

Execute `INICIAR-ACADEMY.cmd` na raiz e abra http://127.0.0.1:4174. Mantenha o terminal aberto. O iniciador requer Node.js e pnpm; neste computador também reconhece o runtime do Codex. A primeira execução precisa de internet para instalar dependências.

O código permanece na pasta compartilhada. Dependências e execução ficam em `%LOCALAPPDATA%\DeMaria\DOC-Academy\preview-verified`, evitando problemas de links simbólicos na rede. O iniciador copia alterações ao abrir; reinicie para refletir mudanças feitas no compartilhamento. O exemplar anterior permanece disponível em `INICIAR.cmd`, porta 4173.

## Funcional nesta demonstração

- Dashboard, catálogo pesquisável, favoritos, aulas sequenciais e links Vimeo.
- Avaliações com respostas objetivas e abertas, correção manual, feedback e regras de nova tentativa por curso.
- XP de aprovação sem duplicidade; experiência histórica e classificação anual demonstrativa.
- Administração de cursos, pessoas, setores, produtos e artigos; rascunhos separados da publicação.
- Prévia de cursos sem conceder XP, relatório filtrado da equipe e exportação CSV.
- Busca textual na base de conhecimento; consulta com IA identificada como futura.

## Limites e próxima fase

Não há autenticação, banco compartilhado, autorização no servidor, envio de e-mail, upload de arquivos, RAG ou certificados válidos. Os perfis e filtros locais demonstram os fluxos, não constituem controle de acesso. Não inserir informações confidenciais. Vídeos reais devem ser cadastrados pelo administrador; os exemplos não contêm manuais oficiais de produtos.

Para uso interno real, implementar autenticação, banco com permissões por organização e gestor, auditoria, backups, convites, armazenamento e testes de acesso. Depois integrar a IA com fontes versionadas e avaliar a qualidade das respostas. Clientes ficam para fase posterior. Regras e metas numéricas de temporadas ainda dependem de homologação.

## Organização e verificação

`src/app`: rotas. `src/components`: telas. `src/lib/model.ts`: validação e regras. `seed.ts`: exemplos. `academy-provider.tsx`: persistência local. Documentação de produto e arquitetura em `../docs/planejamento-2026-09-14`.

Na pasta local de execução: `pnpm test`, `pnpm typecheck` e `pnpm build`. O build não publica o site. Alterações locais de estudo podem ser apagadas ao limpar os dados do navegador; não são backup nem registros oficiais.

