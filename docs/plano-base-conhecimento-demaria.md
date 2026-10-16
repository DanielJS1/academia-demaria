# Base de Conhecimento DeMaria e Fórum DeMarianos

Planejamento em 08/10/2026, com revisão independente do GPT-6 Astra. Esta entrega documenta a proposta; não implementa nem publica a aplicação.

## 0. Direção consolidada após esclarecimento do usuário

Criar uma **Base de Conhecimento DeMaria 2.0**, com padrão institucional e fluxo editorial controlado. HTMLs, PDFs e vídeo mostram como a equipe trabalha hoje; não são especificação para uma cópia visual integral do WordPress. É permitido melhorar composição, tipografia, espaçamentos, organização e interação, preservando a informação e a identidade DeMaria.

**Colaboradores internos aprovados criam artigos e enviam para revisão. Somente administradores aprovam e publicam.** Templates institucionais são obrigatórios e validados no servidor. Um template não pode ser apenas um botão que insere texto livre facilmente removível. Esta orientação substitui a proposta inicial de restringir autoria a administradores, usar HTML livre como fonte canônica e exigir manutenção da aparência antiga.

A revisão do Astra foi atualizada para essa direção. A análise do vídeo está em `docs/references/bc-video-fluxo-2.0.md`.

## 1. Produto e limites

| Ambiente | Finalidade | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| Fórum DeMarianos | Biblioteca atual: pílulas, dicas, scripts, soluções rápidas e discussão | Colaboradores internos aprovados | Preservar permissões comunitárias atuais |
| Base de Conhecimento na Academia | Procedimentos oficiais, novidades, releases e documentação de produtos | Internos: públicos e privados; clientes: somente públicos publicados | Colaboradores internos aprovados criam/submetem; administradores revisam/publicam |
| Portal público DeMaria | Pesquisar e consultar a documentação oficial pública | Visitantes sem login | Edição exclusivamente na Academia |

Público/privado é **visibilidade**, independente de categoria, produto e estado editorial. Todo novo artigo nasce como rascunho privado. Salvar não significa publicar.

Manter Anotações, Consulta assistida e Materiais técnicos. Renomear a Biblioteca sem perder links antigos, conteúdo, comentários, sugestões, coautoria, reações ou XP. Não transformar automaticamente posts do Fórum em artigos oficiais. A BC oficial não herda gamificação.

Fora do primeiro lançamento: chatbot/RAG, integração automática com Gemini, migração integral do WordPress, edição simultânea em tempo real, sistema de atendimento e fórum com tópicos aninhados. O fluxo de gerar HTML no Gemini e colar no editor permanece contemplado.

## 2. Evidências do repositório

- `platform/src/components/knowledge.tsx`: área atual reúne Biblioteca, Consulta assistida, Anotações e Materiais técnicos; existem alterações locais nesse arquivo e em seus estilos.
- `platform/src/components/editors/rich-article-editor.tsx`: Tiptap já instalado, com imagens, tabelas, listas, tarefas e anexos. Não há suporte completo às fontes, tamanhos, cores e alinhamentos do template WordPress.
- `platform/src/components/community/article-content.tsx`: renderização controlada de JSON; adicionar apenas um botão Código não garante fidelidade HTML.
- `platform/src/lib/model.ts`: artigos atuais possuem dados comunitários; a BC deve ter contratos próprios e tipados.
- `platform/src/app/layout.tsx`: todas as páginas herdam AcademyProvider, QuizSummaryProvider, LiveProvider, AppShell e `noindex`. Portal público precisa de layout independente.
- `platform/src/lib/storage-provider.ts`, `storage-service.ts` e `/api/media`: existe um ponto de integração reaproveitável, mas os contratos atuais usam URLs e pressupostos do Fórum.
- `platform/supabase/migrations/202609240005_private_article_files.sql`: imagens em `academy-article-images` são configuradas como públicas; anexos em bucket privado. Isso foi constatado no código versionado, não no banco de produção.
- A documentação de arquitetura não cobre todas as funcionalidades comunitárias atuais; verificar código e migrations antes de decidir alterações.

Não reverter alterações locais existentes. Registrar a situação inicial e trabalhar em diffs cirúrgicos. Este planejamento não mediu armazenamento, tráfego, planos contratados nem permissões reais dos buckets em produção.

## 3. Experiência e identidade

### Portal público

Cabeçalho com logo oficial DeMaria, fundo claro, turquesa institucional e cinzas; pesquisa como elemento principal. Evitar impor a paleta genérica sugerida por ferramentas: a marca fornecida prevalece. A consulta local da skill UI/UX recomendou um padrão de documentação com busca destacada, navegação simples e artigos relacionados, adequado ao objetivo.

Página inicial com pesquisa, produtos/categorias e artigos recentes. Resultados em lista legível com título, resumo, produto, categoria e data de revisão. Filtros refletidos na URL, paginação, busca sem acentos, termos técnicos e versões. Começar por busca PostgreSQL; não exigir serviço pago de busca.

Leitura com breadcrumbs, título, resumo, software/release, publicação/revisão, sumário por seções, imagens ampliáveis, artigos relacionados e link compartilhável. Manter as instruções legíveis em telas pequenas. Recursos como avaliação de utilidade e artigos populares podem vir depois, com métricas reais.

O nome editorial do revisor solicitado no padrão deve ser configurado conscientemente para exibição pública; não retornar e-mail, UUID ou perfil interno. A revisão editorial completa permanece privada.

### Editor na Academia

Área central ampla com abas **Visual**, **Código HTML** e **Prévia**. Criar artigo começa pela escolha de um modelo institucional aprovado. O editor oferece seções guiadas, estilos de texto permitidos pelo modelo, negrito, itálico, listas, tabelas, links, avisos, imagens, desfazer/refazer e limpar formatação. Família/tamanho/cor usam presets institucionais quando permitidos; não oferecer CSS arbitrário. Painel lateral com produto/release, categorias, tags, visibilidade proposta, estado, histórico e ações adequadas ao papel do usuário.

Para autores: **Salvar rascunho**, **Enviar para revisão** e **Retirar da revisão para editar**. Para administradores: **Devolver para ajustes**, **Aprovar e publicar**, **Atualizar publicação**, **Arquivar/Despublicar**. Mostrar salvamento e conflito de versão; impedir saída acidental com alterações pendentes. Não basta esconder o botão de publicação: validar o papel administrativo na API e no banco.

Área do autor com Meus artigos, Rascunhos, Em revisão e Ajustes solicitados. Fila administrativa com autor, produto, data de envio, status e visibilidade proposta; prévia da versão enviada, comparação com a versão publicada quando existir e histórico de decisões. Devolução exige comentário claro; disponibilizar notificações dentro da Academia para envio/decisão, sem exigir integração de e-mail.

## 4. Template e compatibilidade HTML

Padrão **legado de referência**, não obrigação visual do ambiente 2.0: Calibri; título 24px; metadados 12px; corpo 16px; seção Passo a passo 20px; etapas em negrito 16px; texto #333333, títulos #000000; logo DeMaria à direita. A nova composição deve priorizar hierarquia, legibilidade e marca, podendo adotar a tipografia institucional existente. Se usar Calibri, incluir fallback; uma webfont só pode ser distribuída com licença adequada.

Representação semântica do conteúdo legado para importação (não é contrato de apresentação do template novo):

```html
<article class="demaria-article" style="font-family:Calibri,Arial,sans-serif;color:#333333;font-size:16px">
  <header>
    <h1 style="font-size:24px;color:#000000">Título do artigo</h1>
    <!-- Logo oficial por asset local/HTTPS, com dimensão e texto alternativo adequados. -->
    <p style="font-size:12px">Data da publicação: dd/mm/aaaa</p>
    <p style="font-size:12px">Data da última revisão: dd/mm/aaaa (Nome editorial do revisor)</p>
    <p>Software a que se aplica este artigo: DOC-Windows</p>
    <p><strong>Implementado na versão/release:</strong> v2017</p>
    <p>Resumo descritivo do objetivo deste artigo.</p>
  </header>
  <section>
    <h2 style="font-size:20px;color:#000000">Passo a passo</h2>
    <h3 style="font-size:16px;color:#000000">1º Passo — Texto do capítulo</h3>
    <ul><li>Escrito 1</li><li>Escrito 2</li></ul>
    <h3 style="font-size:16px;color:#000000">2º Passo — Texto do capítulo</h3>
    <ul><li>Escrito 1</li><li>Escrito 2</li></ul>
    <h3 style="font-size:16px;color:#000000">3º Passo — Texto do capítulo</h3>
    <ul><li>Escrito 1</li><li>Escrito 2</li></ul>
  </section>
  <p>Resumo final.</p>
</article>
```

### Template institucional obrigatório

Cada documento identifica `templateId` e `templateVersion`. Começar com um catálogo pequeno de modelos aprovados: procedimento, novidade e atualização/release, com campos obrigatórios adequados a cada tipo. Não é necessário um construtor visual genérico de templates no MVP; as definições podem ser versionadas em configuração e só alteradas por administração/manutenção autorizada.

No modelo de procedimento: cabeçalho/metadados, objetivo, pré-requisitos quando aplicáveis, passos e verificação do resultado/conclusão. No de novidade/release: objetivo/resumo, produto/versão, o que mudou, impacto e orientação de uso. Autores podem adicionar/reordenar passos e inserir blocos de texto, imagem, aviso, tabela e código dentro das regiões permitidas. Logo, estilos globais, marca e regiões obrigatórias pertencem ao template, não ao corpo livre.

Rascunhos podem estar incompletos; enviar à revisão e publicar exigem validação da estrutura, campos e mídia. Placeholder do tipo “Escrito 1” não vale como seção preenchida. A aba HTML e chamadas diretas de API não podem remover o template, alterar campos de auditoria ou contornar a autorização de publicação. HTML fora do padrão é normalizado com prévia/relatório; conteúdo não mapeado permanece disponível para revisão, sem descarte silencioso.

Uma nova versão estrutural do template não muda silenciosamente artigos publicados: aplicá-la gera novo rascunho/revisão. Guardar a versão usada na submissão e publicação. Ajustes visuais compatíveis do tema podem ser comuns, mantendo regressão visual e histórico da configuração.

O importador deve aceitar a estrutura aninhada original e mapear conteúdo ao modelo escolhido. Título, datas, software, release e revisor são campos estruturados; o template os projeta na leitura e na exportação. Na importação de documento completo, detectar esses campos, apresentar sua correspondência para revisão e evitar cabeçalhos duplicados. Datas históricas importadas não se confundem com a data técnica de criação no novo sistema.

**Escolha inicial:** reaproveitar o Tiptap para o conteúdo rico dentro das seções institucionais. A documentação confirma que conteúdo fora do esquema pode ser descartado; portanto, testar preservação da informação durante a normalização, sem exigir equivalência visual com WordPress. [Tiptap: schema](https://tiptap.dev/docs/editor/core-concepts/schema).

Usar **documento estruturado JSON validado como fonte canônica**, contendo seções/blocos com IDs estáveis, `schemaVersion`, `templateId` e `templateVersion`; o conteúdo rico de cada região pode usar o schema Tiptap. Não se trata de encapsular um bloco HTML irrestrito em JSON. HTML de leitura/exportação e texto de busca são derivados. A aba Código edita a representação HTML do conteúdo e a converte de volta ao mesmo documento validado; não mantém uma segunda fonte independente. Preservar o original importado em revisão privada para comparação/recuperação.

Prova técnica: importar os cinco artigos reais fornecidos em 08/10/2026, inventariados em `docs/references/bc-artigos-manifesto.json`, para o template 2.0. Comparar informação, ordem das instruções, ênfases úteis e relação texto/imagem; registrar a normalização de fonte, alinhamento, espaçamento e seções. Após aceitar a conversão inicial, executar cinco alternâncias Visual → HTML → Visual, salvar/reabrir e comparar com o documento normalizado. Listas profundas e imagens aninhadas podem virar blocos de passos mais claros, desde que preservem a relação semântica e não percam conteúdo. Imagem reutilizada conserva ocorrências independentes. Complementar tabelas, links, código e segurança com fixtures sintéticas. Os PDFs são referências históricas; não são snapshots obrigatórios do visual 2.0.

Se Tiptap não satisfizer a prova de conteúdo estruturado e importação, registrar a limitação e avaliar alternativas. Não trocar de editor apenas para reproduzir spans/estilos antigos. TinyMCE pode ser avaliado, mas também deverá respeitar os templates e requer verificação de licença/custos antes de adoção. [Licenciamento TinyMCE](https://www.tiny.cloud/docs/tinymce/latest/license-key/).

Sanitizar no servidor e antes de qualquer prévia: lista permitida de tags, atributos, propriedades CSS e protocolos; remover scripts, eventos inline, CSS executável/externo e embeds não autorizados. Não usar regex como sanitizador. O HTML do Gemini e do WordPress é conteúdo importado, nunca código confiável.

## 5. Arquitetura e dados

Manter o mesmo repositório e, inicialmente, o mesmo projeto Supabase, com tabelas/serviços próprios para a BC. Não é necessário pagar um segundo banco só por haver dois sites.

Modelos propostos: `kb_articles` (identidade/slug), `kb_drafts`, `kb_revisions`, `kb_submissions`, `kb_review_events`, `kb_publications`, `kb_media`, `kb_revision_media`, definições/versionamento de templates, categorias e relacionamentos. Os nomes podem se adaptar às convenções existentes. Publicações apontam para revisões imutáveis; a visibilidade efetiva fica na publicação, distinta da visibilidade proposta pelo autor.

Fluxo editorial: **Rascunho → Em revisão → Aprovado e publicado**, com retorno **Em revisão → Ajustes solicitados → Rascunho → Nova submissão**. Cada envio cria snapshot imutável de conteúdo, metadados, template, visibilidade proposta e mídias. Para manter o MVP simples, a submissão não pode ser editada: o autor pode retirá-la para corrigir e reenviar, invalidando a pendência anterior. Autor edita apenas seus rascunhos; administração tem acesso editorial autorizado. Alterar autoria/permissões não é operação livre do autor.

Administradores aprovam/publicam exatamente a revisão exibida e identificada por ID/versão. Fazer isso em uma ação transacional evita um estado aprovado que seja modificado antes de publicar. Se a UI separar aprovação e publicação, qualquer alteração invalida a aprovação anterior. Devolver exige comentário e registra responsável/data; se o administrador editar, registrar nova revisão e publicar a versão final explicitamente revisada. Usar controle otimista também entre retirada, revisão e publicação.

Salvar, enviar ou devolver uma atualização não muda a versão já publicada. Publicar valida papel administrativo, revisão/snapshot atual, template, documento e referências de mídia; troca o apontador de publicação em transação. O administrador confirma a visibilidade. Restaurar histórico cria novo rascunho. Despublicar é ação administrativa distinta.

Mídia externa ao banco exige preparação e compensação: só apontar publicação para assets prontos; falha deixa a versão antiga íntegra e uploads pendentes para limpeza posterior. Exclusão respeita referências de outras publicações e revisões.

APIs específicas e paginadas para gestão, submissão, revisão, busca e leitura. Não carregar corpos e históricos no snapshot de `AcademyProvider`. Validar com Zod o documento estruturado, o template e os comandos; não replicar `z.any()` irrestrito. A validação do HTML de entrada converge para o mesmo contrato.

RLS e autorização no servidor: visitante e cliente só leem publicações públicas; colaborador interno aprovado também lê privadas e cria/edita/submete seus próprios rascunhos. Autor consulta suas devoluções/histórico editorial; administração revisa os artigos e é a única autorizada a aprovar, publicar, alterar visibilidade efetiva e despublicar. Negar publicação e atribuição de privilégios ao autor também em chamadas diretas/RPC. Conta pendente, bloqueada ou sessão inválida não recebe material interno. Funções de busca, contagens, sugestões e categorias aplicam os mesmos filtros; não vazar nem títulos privados.

Separar raiz mínima e layouts `(academy)` / `(public)`, preservando URLs atuais. Portal acessível localmente em `/bc`; no host público, reescrever `/` e links de artigos para esse segmento. Resolver o domínio por configuração validada, não por qualquer Host recebido. Não usar diferenças de host como única barreira de autorização. A raiz pública não monta providers internos, não busca o snapshot da Academia e não herda seu `noindex`.

Usar o guia de route groups instalado em `platform/node_modules/next/dist/docs/` antes de alterar layouts. Uma aplicação pública separada só se justifica por isolamento operacional demonstrado; não introduzir duplicação de lógica editorial.

Busca por título/resumo/texto/tags/produto, peso maior no título, português e acentos normalizados, com atenção a códigos como DOC-Windows e versões. Índices devem ser validados com casos reais. Resposta pública contém apenas os campos editoriais necessários.

## 6. Imagens e alternativas de hospedagem

**Sim, uma imagem pode estar em outro provedor e aparecer no artigo pelo endereço.** O HTML não precisa carregar os bytes dentro do banco. Evitar base64: guardar arquivo em object storage e referência no conteúdo.

| Opção | Vantagem | Limitação / uso sugerido |
| --- | --- | --- |
| Supabase Storage | Integração e autenticação já presentes | Franquias compartilhadas com os demais arquivos da Academia; mais simples no piloto |
| Cloudflare R2 | Boa economia de mídia e transferência | Outro serviço, credenciais e camada de entrega; boa alternativa para acervo público grande |
| URLs HTTPS do WordPress | Reaproveita imagens existentes sem upload inicial | Depende de manter o WordPress e links; conteúdo acessível por URL pública não é privado |

Recomendação: medir o projeto atual; usar Supabase no piloto se houver margem e preparar um adaptador para trocar o provedor. Para migração de centenas de artigos, avaliar R2 antes de pagar Supabase apenas por imagens. Não implementar dois provedores completos sem necessidade; manter contrato de mídia independente.

Cadastro de mídia: ID, provider, bucket/chave, nome, MIME, bytes, largura/altura, checksum, proprietário e referências por versão. No corpo, referências estáveis por ID; URLs assinadas são geradas na leitura, nunca salvas definitivamente no HTML. Exportação resolve URLs conforme audiência e não torna mídia privada pública automaticamente.

Biblioteca de mídia integrada ao editor: upload e colagem de capturas, busca, miniaturas, dimensões/tamanho, descrição alternativa e onde o arquivo é utilizado. Permitir nomes iguais com chaves internas únicas. Reutilização deve respeitar a autorização dos artigos e dos rascunhos; não listar mídias privadas de rascunhos alheios para todo autor. Trocar imagem em uma revisão não pode sobrescrever o asset usado na versão publicada. Antes de remover, verificar referências e impedir quebra de conteúdo publicado.

Uploads novos e imagens privadas ficam em bucket privado. Para públicos, a implementação inicial deve usar endpoint que confira a publicação atual antes de entregar/assinar o arquivo; URLs curtas têm uma janela de validade documentada. Entrega pública por CDN/cópias públicas é otimização posterior, com política explícita de retirada. Uma URL pública externa em um artigo privado não oferece confidencialidade; material sensível deve ser importado para storage privado.

Revisar também o bucket atual do Fórum: inventariar referências, copiar/proteger mídia, adaptar leitor, testar e só então retirar acesso público antigo. Não alternar uma configuração às cegas e quebrar os posts. Buckets públicos permitem leitura a quem conhece o endereço. [Modelo de acesso do Supabase Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Uploads com validação do conteúdo real e limites de bytes/dimensões; orientação inicial de até 5 MB por imagem, ajustada ao limite do caminho de upload do host. Otimizar PNG/WebP preservando textos das capturas, sem promessa de tamanho fixo. Gerar versão de leitura, usar lazy loading e reservar dimensões; ampliar para inspecionar detalhes. Deduplicar dentro de fronteiras de acesso, não compartilhar IDs entre privado/público sem política.

Importação remota apenas por hosts autorizados, HTTPS verificado, tamanho/tempo limitados, bloqueio de endereços internos e revalidação de redirecionamentos. O logo antigo em HTTP precisa ser substituído por asset oficial local ou HTTPS verificado, não reescrito cegamente.

## 7. Custos e dimensionamento

Valores consultados em 08/10/2026, em USD, sem câmbio, tributos, add-ons ou excedentes. Não representam uma cotação da conta atual.

| Serviço | Base / franquia relevante |
| --- | --- |
| Supabase Free | US$ 0; arquivos 1 GB; banco 500 MB; saída 5 GB sem cache + 5 GB em cache |
| Supabase Pro | A partir de US$ 25/mês; arquivos 100 GB; disco de banco 8 GB; saída 250 GB sem cache + 250 GB em cache |
| R2 Standard | 10 GB-mês gratuitos; 1 milhão de operações A e 10 milhões B/mês; saída para internet sem cobrança |

As franquias de saída Supabase são separadas, não um saldo intercambiável. Pro: arquivos adicionais US$ 0,0213/GB-mês; saída adicional US$ 0,09/GB sem cache e US$ 0,03/GB em cache. O valor base pressupõe compute coberto pelos créditos incluídos; projetos/computação adicionais podem aumentar a conta. [Preços Supabase](https://supabase.com/pricing).

R2 Standard excedente: armazenamento US$ 0,015/GB-mês; operações A US$ 4,50/milhão, B US$ 0,36/milhão. Por exemplo, 20 GB mantidos por um mês resultam em cerca de US$ 0,15 de armazenamento após franquia, antes de operações e outros serviços. Worker, transformação de imagens e camada de entrega não estão automaticamente incluídos nessa conta. [Preços R2](https://developers.cloudflare.com/r2/pricing/).

Simulações, não medição: oito imagens de 250 KB por artigo representam aproximadamente 2 MB. Cem artigos: 200 MB; 451 artigos (quantidade vista no print): 902 MB; mil artigos: 2 GB. Originais, miniaturas, revisões, PDFs, avatares e demais dados somam consumo. Os 451 itens incluem estados diferentes e não equivalem a 451 artigos públicos.

Atualização com o vídeo recebido: a biblioteca mostra exemplos de 115 KB, 159 KB e 971 KB (detalhes e instantes em `docs/references/bc-video-fluxo-2.0.md`). Esses valores confirmam variação considerável, mas não definem média nem volume total. A simulação de 250 KB permanece hipotética. Não houve download/medição independente das imagens nem consulta ao uso do Supabase.

Cinco mil leituras completas mensais de páginas com 2 MB de imagens transferem aproximadamente 10 GB, antes de outros conteúdos e do efeito do cache. A transferência pode atingir o limite antes do armazenamento.

Não recomendar upgrade sem inventário. Alertas operacionais propostos em 70% e 85% das franquias; projetar crescimento. Para produção crítica, Pro também oferece backups diários de banco e evita pausa por inatividade; o Free pode pausar após uma semana sem atividade. Backups do banco não incluem os arquivos de Storage: planejar cópia de mídia e ensaio de recuperação separadamente. [Preços](https://supabase.com/pricing) e [backups](https://supabase.com/docs/guides/platform/backups).

Vercel é um custo separado: Hobby destina-se a uso pessoal não comercial; orçamento empresarial deve considerar Pro, atualmente US$ 20/mês de plataforma, com um assento de deploy e crédito de uso de US$ 20. Não é uma cobrança por leitor ou por colaborador da Academia. Se a equipe já assina Pro, não assumir nova mensalidade integral só pelo portal. Excedentes e assentos adicionais podem cobrar. [Hobby](https://vercel.com/docs/plans/hobby), [Pro](https://vercel.com/docs/plans/pro-plan).

Cenários-base, sujeitos às franquias: Vercel Pro + Supabase Free = US$ 20/mês; Vercel Pro + Supabase Pro = US$ 45/mês. R2 pode acrescentar US$ 0 dentro de suas franquias, mas a camada de entrega precisa entrar no orçamento. Não há contratação autorizada por este planejamento.

## 8. Endereço público

Preservar como preferência `bc.demaria.vercel.app`. A equipe Vercel informa suporte ao formato `<sub>.<team-name>.vercel.app`; portanto o endereço depende de a equipe adequada possuir o slug `demaria` e da configuração ser aceita. Isso não foi verificado na conta. [Resposta da equipe Vercel](https://community.vercel.com/t/third-level-subdomain-on-vercel-app/7756/2).

Alternativa: `bc-demaria.vercel.app`, sujeita à disponibilidade. Endereços padrão são atribuídos por ordem de chegada. [Domínios Vercel](https://vercel.com/docs/domains/working-with-domains).

No futuro, o domínio já usado `bc.demaria.com.br` pode apontar ao novo portal após homologação, preservando a marca e redirecionando artigos. Não alterar DNS ou substituir o WordPress nesta etapa. Links canônicos, sitemap e metadados devem usar o host efetivamente aprovado, nunca um endereço ainda não provisionado.

## 9. Publicação, privacidade e retirada

Começar sem cache compartilhado para conteúdos cuja visibilidade possa mudar. Autorizar em toda leitura relevante. Depois de medir uso, adicionar cache público com invalidação explícita e testada.

Ao retirar ou tornar privado: revogar publicação, impedir acesso público por slug/ID, remover resultados/snippets/contagens e sitemap, invalidar metadados/caches e encerrar entrega pública das mídias exclusivas daquela publicação. Não apagar arquivos ainda usados por outro artigo autorizado. Rascunhos e histórico nunca entram em respostas públicas.

Teste deve registrar a janela de validade de URLs assinadas e efeitos de caches externos. Nada consegue recuperar cópias já baixadas por visitantes. `noindex` não é controle de acesso.

## 10. Etapas e critérios de conclusão

1. **Inventário e prova do editor:** registrar baseline, medir volume disponível quando houver acesso, definir templates e converter os exemplos; desenhar busca, leitura, autoria e fila de revisão com marca DeMaria. Critério: conteúdo preservado, normalização explícita no padrão 2.0 e alternância Visual/HTML estável.
2. **Fundação:** modelos, migrações locais, RLS, APIs, revisão otimista, media IDs e layouts separados. Critério: matriz de acesso testada, portal anônimo sem dados internos.
3. **Autoria, revisão e publicação:** seções guiadas, código, prévia, templates obrigatórios, imagens, rascunhos, submissões imutáveis, devoluções comentadas, histórico e publicação administrativa. Critério: autor não publica nem contorna template; admin publica a revisão aprovada; rascunho/devolução não modificam o publicado.
4. **Fórum e BC interna/pública:** renomear mantendo compatibilidade; busca paginada, filtros, leitura responsiva, sumário, zoom e metadados. Critério: público e privado aparecem apenas para audiências corretas.
5. **Migração piloto:** importar pequeno lote representativo, mapear URLs/mídias, emitir relatório de perdas, pendências e links quebrados; idempotência e reversão. Critério: artigos comparados com WordPress. Migração integral é trabalho posterior, após validação.
6. **Homologação e preparação de lançamento:** testes, orçamento medido, backups, domínio/configuração e evidências. Contratação, migração remota, deploy e troca de DNS são decisões posteriores ao pedido atual de planejamento.

Testes funcionais e de segurança: visitante, cliente autenticado, autor interno aprovado, pendente/bloqueado e administrador; autoria de rascunho alheio; autor tentando aprovar/publicar por API/RPC; remover seções obrigatórias/forjar template via HTML ou payload; publicar revisão diferente da aprovada; conflito entre retirada e aprovação; devolução/nova submissão; acesso privado por página/API/busca/mídia; importação maliciosa; arquivos inválidos; rascunho vs publicado; retirada; órfãos; referências compartilhadas; comportamento com serviço indisponível sem fallback de dados internos para o público.

Testes de interface: teclado/foco, labels, contraste, zoom, 375/768/1440 px, tabela larga, captura grande e editor com documento longo. Regressão de login, cursos, Fórum/XP, coautoria, anotações e materiais técnicos. Rodar `pnpm typecheck`, testes relevantes e build; Playwright para jornadas reais. Declarar qualquer verificação externa bloqueada, sem simular sucesso.

## 11. Skills por fase

| Skill | Uso concreto |
| --- | --- |
| `ui-ux-pro-max` | Pesquisa, leitura, editor, hierarquia e identidade |
| `supabase:supabase` | Auth, RLS, storage e migrações |
| `supabase:supabase-postgres-best-practices` | Índices, busca e paginação |
| `vercel-react-best-practices` | Layouts, renderização e carregamento sob demanda do editor |
| `best-practices` | Sanitização HTML, uploads e importação externa |
| `accessibility` | Navegação por teclado, editor, contraste e imagens |
| `playwright-skill` | Jornadas de edição/publicação e regressão no navegador |
| `web-design-guidelines` | Revisão final de interface |
| `vercel:domains`, `vercel:deployments-cicd` | Endereço e implantação, apenas na etapa correspondente |
| `shadcn` | Somente se necessário alterar/adicionar componentes desse sistema |

Skills não substituem testes nem asseguram perfeição por si. Não usar Sites para recriar este projeto Next.js existente. Não usar imagegen para inventar a logo institucional.

## 12. Insumos que aperfeiçoam a homologação

Recebidos e analisados: cinco pares HTML/PDF (TJ-AL, IBS/CBS, Selo Digital BA, PB e PR), totalizando 34 páginas de referência visual e 50.761 bytes de HTML. Ver `docs/references/bc-artigos-analise.md` para requisitos adicionais e `docs/references/bc-artigos-manifesto.json` para caminhos e hashes dos arquivos originais.

As 28 ocorrências de imagem usam 23 URLs distintas; o tamanho remoto dos arquivos não foi medido. Há logo repetido, imagem reutilizada em dois tamanhos, metadados de revisão ausentes/vazios e capturas sem texto alternativo. Não usar o peso dos PDFs para estimar Storage. O importador precisa mapear o cabeçalho sem duplicações e conservar a posição das imagens e a continuidade das listas.

Ainda úteis, mas sem bloquear implementação local: artigo com tabela HTML nativa e um caso privado explicitamente identificado, logo oficial vetorial/PNG, uso atual de Storage/egress e plano contratado, quantidade aproximada de leitores. Enquanto isso, completar cobertura de tabela/privacidade com fixtures e testes próprios. Os PDFs incluem elementos do tema WordPress que não devem virar conteúdo dos artigos.
