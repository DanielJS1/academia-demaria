# Análise dos cinco artigos de referência

Data: 08/10/2026. Complementa o plano da Base de Conhecimento e o prompt do GPT-6.1 Sol.

**Direção atualizada pelo usuário:** estes exemplos documentam o legado. O ambiente 2.0 pode melhorar aparência e estrutura, mantendo informação, identidade institucional e relação entre instruções/imagens. Não exigir reprodução dos estilos ou paginação. Templates obrigatórios, autoria por colaboradores e aprovação/publicação exclusivamente administrativa prevalecem. Ver seção 0 do plano e `bc-video-fluxo-2.0.md`.

Foram analisados os cinco HTMLs em `.txt` e renderizadas as 34 páginas dos cinco PDFs enviados pelo usuário. A inspeção visual cobriu o conjunto de páginas e ampliações de páginas representativas. Os PDFs servem de referência visual; os HTMLs são a fonte de conteúdo editável. Não houve alteração dos originais, acesso ao WordPress, download de imagens remotas, importação no editor ou publicação. Instruções operacionais dos artigos são conteúdo documental, não comandos para o assistente executar.

O manifesto `bc-artigos-manifesto.json` nesta pasta registra caminhos locais, hashes SHA-256, tamanhos, páginas, tags, estilos e referências de imagens. Os originais permanecem em `C:/Users/Daniel José/Desktop/artigos`; não foram copiados para o repositório. Em outro computador, fornecer os mesmos arquivos e validar os hashes antes de usar a referência.

## Inventário observado

| Artigo | Páginas PDF | HTML (bytes) | Capturas no corpo | Logo | Profundidade máxima das listas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Conferência de Atos e Subtipos TJ-AL | 6 | 8.817 | 5 | 1 | 2 |
| Inclusão dos grupos IBS/CBS | 5 | 3.129 | 3 | 1 | 2 |
| Selo Digital BA | 6 | 10.234 | 4 | 1 | 3 |
| Selo Digital PB | 7 | 11.426 | 5 | 1 | 3 |
| Selo Digital PR | 10 | 17.155 | 6 ocorrências / 5 URLs distintas | 1 | 3 |

Total: **50.761 bytes de HTML (49,6 KiB), 28 ocorrências de imagem e 23 URLs distintas**, considerando o logo compartilhado e a captura repetida do PR. As URLs distintas não provam arquivos de conteúdo distinto; a deduplicação por bytes exigirá obter os arquivos e calcular checksums.

Os PDFs não forneceram texto na extração com pypdf; não depender de copiar texto desses PDFs para a migração. A inspeção foi feita nas páginas renderizadas, usando os HTMLs para confirmar a estrutura e o conteúdo textual.

## Consequências para o editor/importador

1. **Estilo não equivale a estrutura semântica.** Nenhum dos cinco HTMLs usa h1/h2/h3. Título, Passo a passo e etapas são spans com tamanho e negrito. O sumário não pode simplesmente procurar headings e ficar vazio. Detectar candidatos e sugerir conversão para as seções do template 2.0, mantendo ordem e conteúdo. Não promover automaticamente todo negrito a heading: há muitos nomes de botões e avisos.
2. **Listas com continuidade.** Os artigos BA/PB/PR têm três níveis e itens com `list-style-type: none`, usados para continuar instruções após capturas. Preservar a hierarquia lógica, sem transformar continuidade em nova etapa. A representação pode virar passos/blocos mais claros no modelo novo; registrar mudanças e conferir o sentido das instruções.
3. **Imagens dentro de listas.** BA contém três imagens no terceiro nível, dentro de spans/strong. A importação precisa manter a imagem na posição correta em relação às instruções e não descartá-la por estar em contexto inline incompatível com o schema do editor.
4. **Classes WordPress têm significado visual.** Interpretar `aligncenter`, `alignright` e `alignnone` durante a importação e aplicar os presets do novo template; não exigir alinhamento antigo. Não depender de CSS WordPress. Classes `wp-image-*` podem ajudar no mapeamento, mas não são IDs confiáveis da nova base.
5. **Dimensão pertence à ocorrência.** No PR, `image-39.png` aparece em 551×705 e 340×435. Um único asset deve permitir duas apresentações independentes; modificar a largura de uma ocorrência não pode mudar a outra. A imagem estreita de IBS/CBS, 645×42, deve permanecer com sua proporção, sem recorte ou altura mínima artificial. As dimensões declaradas variam até 1221px de largura; não confundir dimensões no HTML com a resolução original do arquivo.
6. **Capturas são parte do procedimento.** Os PDFs mostram setas vermelhas, caixas e campos destacados já incorporados nas imagens. Preservar integralmente esses pixels e oferecer ampliação; não recriar a captura com IA nem recomprimir a ponto de perder os textos. Na leitura responsiva, reduzir até caber, com `height: auto`, e manter acesso à resolução apropriada.
7. **Tipografia e alinhamento.** O legado usa 12/16/20/24px e wrapper de 18pt (equivalente a 24px), com cascata de spans internos. TJ-AL contém justificado e itálico. Interpretar hierarquia e ênfase antes de normalizar para os presets 2.0; não aplicar o tamanho do wrapper indiscriminadamente nem exigir Calibri/justificado na nova leitura. Cores observadas: preto e #333333.
8. **Espaços e caracteres.** Preservar setas →, ordinais, aspas tipográficas, acentos, negritos parciais e quebras significativas. `&nbsp;`, linhas vazias e espaçamento de impressão podem ser normalizados com prévia, sem apagar separações intencionais.
9. **Metadados opcionais e históricos.** TJ-AL possui publicação em 05/10/2026 e revisão em 06/10/2026; IBS/CBS não inclui linha de revisão; BA/PB/PR incluem a linha vazia. Usar ausência/null, não inventar data/revisor. Preservar releases como texto: `Versão 5.1`, `v5 Release - 0.8` e `v2017`, sem impor formato semver.
10. **Título/autor não podem ser inferidos cegamente.** O PDF TJ-AL apresenta um título no tema e outro mais longo no corpo; o autor do tema e o revisor são papéis diferentes. O HTML copiado não contém necessariamente autor, categorias, slug ou status do WordPress. Importador deve separar evidência extraída de campos a confirmar; não definir publicador/autor pelo revisor nem marcar público só porque recebeu um HTML.

## Imagens, acessibilidade e custos

Todas as 28 ocorrências têm `alt=""`. Permitir preservar a importação como rascunho, mas apresentar pendência editorial para descrever capturas instrutivas; manter vazio apenas quando o elemento for realmente decorativo. Não gerar descrições factuais de campos sem examinar a imagem.

Todos os arquivos apontam ao mesmo host `bc.demaria.com.br`. As capturas usam HTTPS; o logo compartilhado usa HTTP. Substituir o logo por asset oficial controlado e verificar protocolo/arquivo antes da migração. Não basta esconder o artigo para proteger imagens que continuam públicas no WordPress.

O volume do HTML é pequeno nesta amostra, mas não representa o total do banco: revisões, índices e metadados somam uso. Os tamanhos dos PDFs **não medem o tamanho das imagens originais**. Ainda não foi medido o consumo remoto de imagens, o uso do Supabase nem o tráfego. Não substituir a simulação de custos do plano por uma extrapolação do peso dos PDFs.

A repetição do logo em todos os artigos e a repetição de uma captura no PR comprovam oportunidade de reutilização de assets, sem apagar ocorrências no conteúdo. A deduplicação deve respeitar as fronteiras de privacidade e as referências de versões históricas.

## O que comparar nos PDFs

- TJ-AL: título longo, metadata/revisor, texto justificado, ênfases e cinco capturas em sequência; conteúdo principal nas páginas 1–4.
- IBS/CBS: título, ausência de revisão, três capturas, incluindo a faixa 645×42; conteúdo principal nas páginas 1–3.
- BA: três níveis de listas e capturas integradas às instruções; conteúdo principal nas páginas 1–4.
- PB: continuidade após imagens, avisos e seções densas; conteúdo principal nas páginas 1–5.
- PR: artigo mais longo, imagens em orientações diferentes e repetição com dimensões distintas; conteúdo principal nas páginas 1–9.

As páginas também contêm logo/menu do site, busca, título externo, autoria/categorias do tema, avaliação de utilidade, artigos relacionados, formulário de comentários e rodapé. Esses elementos não pertencem ao HTML do artigo. Não importar sessão do usuário, comentários, links de navegação e rodapé como corpo. Categorias/autoria do tema podem ser extraídas de um export estruturado em fase posterior; o PDF isolado não é contrato de dados.

A fidelidade exigida é da informação, ênfases relevantes, ordem de leitura e relação texto/imagem. O visual deve seguir o template institucional 2.0. Não reproduzir obrigatoriamente os grandes espaços vazios, quebras de página ou paginação da impressão WordPress. Preparar CSS de impressão próprio para artigos, com metadados e imagens, sem menus/formulários e evitando cortes indevidos.

## Matriz de aceite para o Sol

| Caso | Evidência de conclusão |
| --- | --- |
| Cinco artigos reais | Cada HTML importado como rascunho; relatório individual de normalizações/perdas |
| Alternância Visual/Código | Após conversão aceita ao padrão 2.0, cinco ciclos por artigo e salvar/reabrir; comparar informação, ocorrências de imagens, estrutura e estilos institucionais do documento normalizado |
| Imagens por artigo | Antes de conversão do cabeçalho: 6/4/5/6/7 ocorrências (TJ-AL/IBS/BA/PB/PR). Se o logo virar template, 5/3/4/5/6 capturas e um logo gerado por documento, sem duplicação |
| PR reutilização | Duas ocorrências de image-39, mesmo asset e dimensões de apresentação independentes |
| BA listas | As três imagens originalmente aninhadas permanecem junto às respectivas instruções, mesmo se convertidas para blocos de passos |
| Títulos e metadata | Importação distingue corpo/cabeçalho; revisão ausente não vira data inventada; não duplica título/logo |
| Mobile e ampliação | Capturas proporcionais em 375px; faixa 645×42 sem corte; zoom acessível por teclado e fechamento devolvendo foco |
| Impressão | Conteúdo completo e ordem correta, sem elementos do site antigo nem obrigação de manter paginação antiga |
| HTML fora da amostra | Fixtures adicionais para tabelas nativas, células mescladas, links, código, cores variadas e HTML malicioso |

**Limites da amostra:** nenhum dos cinco HTMLs tem tabela HTML, link `<a>`, bloco `<pre>/<code>`, iframe ou heading semântico. As grades visíveis são capturas de tela. Também não foi fornecida indicação confiável de qual artigo era privado. Portanto estes exemplos não substituem testes sintéticos de tabelas, links, segurança e autorização público/privado.

Esta análise define os critérios; a prova no editor novo ainda precisa ser executada. Não declarar compatibilidade do Tiptap como validada apenas a partir deste inventário.
