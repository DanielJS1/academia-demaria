# Etapa 03 — Conhecimento e busca

Concluída em 12/10/2026. Escopo: `03-conhecimento-e-busca.md`; etapas 04–10 não executadas.

## Entrega

- Cabeçalho compacto e acessos a Fórum, Base oficial, Assistentes, Minhas anotações e Materiais. Fórum continua como área inicial interna. Removida a introdução grande entre busca e resultados.
- Busca com dois caracteres, debounce de 250 ms, cancelamento e identificação de respostas por termo, página, usuário e audiência. Resultados imediatamente abaixo do campo.
- Cinco adaptadores: corpo completo dos artigos publicados do Fórum no servidor; `kb_search` existente; catálogo local de assistentes; metadados de materiais; anotações privadas do usuário neste navegador. As anotações não são enviadas ao servidor.
- Todos apresenta três prévias por fonte; seleção de fonte apresenta páginas de vinte resultados. Contagens exatas quando disponíveis; `N+` identifica busca parcial. Trechos e resumos têm identificação explícita; destaque do termo utiliza texto React, sem HTML recebido.
- Carregamento, ausência e erro independentes por fonte; nova tentativa preserva as demais respostas. Falta de sessão/HTTP falho não é convertida em resultado vazio.
- Parâmetros anteriores `aba`/`busca` preservados, com `tipo`/`pagina` e destino específico de material. Histórico nativo restaura fonte/página; limpar mantém a área. Busca global transporta o termo de anotações e Fórum.
- Materiais encontrados abrem o item selecionado usando o fluxo existente de URL autorizada. Download dos cadernos e publicação, edição, rascunhos, sugestões, interações e CRUD de materiais permanecem nos componentes existentes.

## Arquivos

- `platform/src/components/knowledge.tsx` e `platform/src/app/(academy)/conhecimento/page.tsx`: composição e parâmetros.
- `platform/src/components/knowledge/{assistants,search-client,search-results,use-knowledge-navigation,use-knowledge-source}`: catálogo, adaptadores, apresentação e estado.
- `platform/src/lib/knowledge/{search,forum-search.server,material-search.server,search.test}.ts`: contratos, trechos, paginação, consultas e testes.
- APIs `community/search` e `technical-materials`, cliente de artigos, biblioteca comunitária, materiais técnicos, bloco de anotações, busca global e `platform/src/styles/knowledge.css`.
- `platform/src/lib/technical-material.test.ts`: mock ajustado à consulta paginada.

## Verificações executadas

- `pnpm exec tsc --noEmit`: aprovado.
- Vitest: **47 testes, quatro arquivos, aprovados** — `knowledge/search.test.ts`, `community.test.ts`, `technical-material.test.ts`, `kb/permissions.test.ts`.
- Fixtures de consulta verificam DLL apenas no corpo, artigos além do primeiro lote, exclusão de rascunhos/tombstones, material por assunto após 1.000 registros, snippets sem corpos/caminhos de armazenamento, cliente bloqueado antes da consulta e falha HTTP identificada. Testes existentes da KB verificam suas permissões no banco isolado.
- Playwright com sessão e respostas simuladas, sem credenciais reais: Fórum inicial; um caractere sem consulta; cinco fontes; três prévias; erro parcial/retry apenas da fonte; páginas 1/2; Voltar; digitação rápida; anotações reais no localStorage da fixture; troca de usuário no mesmo navegador sem misturar notas.
- Abertura do material pela rota real `/conhecimento?aba=materiais&material=...`, solicitação da URL do item correto e fechamento por Escape. Filtros por teclado e zoom CSS de 200% conferidos.
- Oito combinações de tema claro/escuro e largura 1440/768/390/375 px, sem overflow horizontal. Capturas desktop claro e celular escuro inspecionadas visualmente. Nenhum erro JavaScript no ensaio final.
- Tela temporária de prévia removida ao encerrar os ensaios.

## Limites e decisões

- O bloqueio atual do `AcademyProvider` à área de Conhecimento para clientes foi preservado. Os adaptadores também restringem Fórum/Materiais; KB continua usando suas regras existentes, sem elevar acesso via service role.
- PDFs e vídeos são pesquisados somente por metadados. Anotações existem somente neste navegador. Uma fonte indisponível não permite declarar uma contagem total completa.
- Fórum e materiais consultam os registros em lotes no servidor e paginam a resposta; nenhum corpo integral coletivo é enviado ao browser. O custo dessa varredura cresce com o acervo; indexação no banco permanece uma melhoria futura, sem migração nesta etapa.
- Os ensaios de interface usam fixtures, não o conteúdo nem a sessão do banco publicado. O fluxo de CRUD/download foi preservado por leitura do código e testes pertinentes; não foram executadas publicações ou exclusões reais para validá-lo.
- Sem deploy, push ou migração aplicada. Alterações locais preexistentes preservadas.

Capturas e script de QA: `C:/Users/Daniel José/.codex/visualizations/2026/10/12/01a13253-523d-7262-89c8-7748a2f432d7/stage03/`.
