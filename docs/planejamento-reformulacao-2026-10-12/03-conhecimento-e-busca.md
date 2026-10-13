# 03 — Conhecimento e busca federada

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisito: etapa 02. Esta etapa é independente dos novos relatórios.

**Objetivo:** pesquisa visível e compreensível em Conhecimento. Atualmente o campo fica acima de banners/abas, artigos só são buscados remotamente na Biblioteca, notas não aplicam o termo e erros podem parecer ausência de resultados.

**Pontos de entrada:** knowledge.tsx, community/article-client.ts, community-library.tsx, /api/community/search/route.ts, /api/kb/route.ts, lib/kb/server.ts/publicSearch, technical-materials.tsx, /api/technical-materials, lesson-notepad.tsx, global-search.tsx, rota de Conhecimento e knowledge.css.

**Execute:**
1. Aplique o cabeçalho compacto “Conhecimento”. Sem pesquisa, mantenha Fórum como inicial e acessos claros a Fórum, Base oficial, Assistentes, Minhas anotações e Materiais. Preserve publicação/rascunhos, edição, sugestões, interações, consulta oficial, gerenciamento editorial e link público.
2. Com pelo menos dois caracteres, mostre resultados imediatamente após o campo, termo e contagem; não deixe hero, banner e introdução do Fórum entre campo e resposta. Um caractere orienta a digitar dois. Debounce 250ms e cancelamento/controle de resposta obsoleta.
3. Implemente adaptadores reutilizáveis: Fórum pelo conteúdo completo existente, Base oficial via kb_search, Assistentes por catálogo local, Materiais por título/descrição/assunto, Anotações por texto/curso/aula no localStorage do usuário. Não envie anotações privadas ao servidor. Não anuncie pesquisa no interior de PDFs/vídeos.
4. Todos agrupa resultados por fonte, com limite de prévia, “Ver mais” e paginação da fonte. Use contagem exata quando disponível e N+ quando parcial. Resultado tem tipo/origem, título, trecho relevante ou resumo claramente identificado e destino.
5. Preserve o cenário DLL no corpo do artigo. Busca de servidor retorna apenas resultados/trechos autorizados; não transfira corpos de todos os artigos ao browser. Respeite as permissões próprias da KB e público interno/cliente.
6. Diferencie vazio, carregando e falha por fonte; permitir tentar novamente sem apagar resultados válidos das demais. Token ausente/HTTP falho não deve ser convertido silenciosamente em zero resultados.
7. Preserve links aba/busca atuais; acrescente tipo/pagina somente conforme necessário. Limpar retorna à área anterior, voltar restaura contexto, busca global transporta o termo inclusive nas notas. Materiais encontrados devem abrir o item correto; não apenas a lista genérica.

**Critérios de aceite:** DLL dentro do corpo; termo exclusivo de nota; materiais por assunto; assistente; publicação oficial pública/privada conforme papel; cliente não recebe conteúdo interno; troca de usuário não mistura notas; erro de uma fonte preserva demais; digitação rápida não mostra resposta antiga; limpeza/voltar/deep link; teclado e mobile. Testar busca real com fixtures isoladas, sem criar conteúdo em produção. Manter download dos cadernos e ações existentes.
