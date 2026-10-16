# Base de Conhecimento 2.0 — implementação e homologação local

Registro da homologação local em 08/10/2026, seguido da publicação autorizada descrita abaixo. Não houve contratação, alteração de DNS ou substituição do WordPress.

## Entrega

- `/bc`: pesquisa anônima com um único campo sobre títulos, conteúdo e tags, paginação e artigos sem sumário lateral, tabelas responsivas e zoom de imagens por teclado.
- `/conhecimento/base`: leitura autenticada, incluindo publicações privadas para colaboradores internos ativos. Clientes recebem apenas publicações públicas.
- `/conhecimento/oficial`: autoria e fila editorial dentro da Academia. O Fórum DeMarianos conserva suas rotas e contratos; comentários, XP, sugestões, coautoria e materiais técnicos não foram migrados para a BC.
- `/bc/gestao`: acesso **exclusivamente local**, com contas sintéticas e PostgreSQL PGlite isolado. Desativado em produção e sem `KB_LOCAL_PILOT=1`.

Procedimento, novidade e atualização têm contrato JSON v1, seções obrigatórias, UUIDs de seções/blocos e conteúdo rico permitido. Visual, HTML e prévia compartilham esse contrato. HTML passa por `sanitize-html` e conversão no servidor; a leitura usa componentes React, sem executar HTML fornecido pelo autor. Tipografia e regiões vêm do template. Tiptap é carregado sob demanda no editor.

Rascunho, submissão, revisão imutável e publicação são entidades distintas. Cada decisão exige a versão corrente do artigo e a revisão/submissão exatas; a RPC bloqueia a linha antes de decidir. Apenas administrador interno ativo publica. Retirada invalida a submissão; devolução exige comentário; restauração cria rascunho. Salvar rascunho não altera a publicação vigente. Avisos editoriais ficam restritos ao destinatário.

Mídia usa IDs permanentes e bucket privado `academy-kb`, com validação real de PNG/JPEG/WebP, até 5 MB e 40 milhões de pixels. A API autoriza cada leitura pela publicação vigente ou pela permissão editorial. URLs assinadas de 60 segundos são consumidas pelo servidor, sem persistência no documento. Respostas de leitura/busca/mídia usam `no-store`; não há cache compartilhado. Remoção de mídia referenciada por rascunho ou revisão histórica é impedida. A biblioteca mostra miniatura, dimensões, tamanho, rascunho e revisões que a usam.

## Revisão do editor e prévias solicitadas

A barra simplificada foi substituída por grupos com ícones Lucide, indicação de formato ativo, atalhos/labels e navegação por teclado. Inclui alinhamento à esquerda/centro/direita/justificado; negrito, itálico, sublinhado, tachado, subscrito/sobrescrito; cores HEX e destaque; tamanhos institucionais 14/16/18/20/24 px; títulos 2/3/4; listas/recuos; links; imagens; avisos; código; divisória; desfazer/refazer; limpeza de formato e tabela com linhas, colunas, cabeçalho, mesclagem/divisão e remoção. Família tipográfica continua controlada pelo template. A seleção/cursor é preservada na sincronização do editor; IDs de novos blocos são atribuídos com transação mapeada do ProseMirror.

Alinhamento/cores/tamanho/destaque fazem parte do JSON validado, do renderer React, do importador HTML sanitizado e da validação SQL/RPC. Apenas propriedades de formatação enumeradas e cores HEX passam; CSS de posição, URLs em CSS e atributos arbitrários continuam rejeitados. As novas extensões Tiptap foram fixadas na versão 3.31.3, compatível com o core já instalado.

`/bc/previas` lista os cinco originais. `/bc/previa/[slug]` usa o mesmo componente de leitura dos clientes, com imagens e zoom, sem publicar os rascunhos. Seções vazias não são exibidas na leitura, mas continuam obrigatórias no editor/validação de submissão. Uma faixa discreta identifica a prévia local. A mídia dessas prévias usa endpoint local limitado às referências dos cinco IDs do mapa do piloto; nenhuma publicação privada genérica ganha acesso anônimo.

As rotas de prévia e mídia de prévia exigem ambiente de desenvolvimento, `KB_LOCAL_PILOT=1` e origem loopback. Na execução local do build com `next start`, **mesmo com a variável do piloto ligada**, `/bc/previas`, `/api/kb/preview-media/...` e `/api/kb/pilot` responderam 404. Isso foi verificado sem deploy remoto.

Playwright adicional conferiu formatação real, links, inserção/edição de tabela, cinco ciclos sobre esse documento formatado, igualdade após salvar e as cinco leituras em 375 px com todas as 23 imagens e zoom Enter/Escape. Não houve erro de JavaScript ou overflow horizontal. Evidências: `platform/reports/kb/professional-results.json` e `professional-toolbar.png`; screenshots dos artigos históricos continuam restritos à pasta ignorada `.kb-pilot/professional`.

## Evidências executadas

- `pnpm typecheck`: passou.
- `pnpm test`: **31 arquivos, 281 testes aprovados**. Inclui PostgreSQL/PGlite executando a migration real com RLS e papéis `anon`/`authenticated`; acesso por perfil, escrita direta, submissão incompleta, IDs duplicados, mídia de outro artigo, HTML malicioso, revisões imutáveis, concorrência, retirada e revogação de publicação/mídia.
- `pnpm build`: passou, incluindo rotas atuais e novas.
- Playwright: **três jornadas aprovadas**, navegador Chromium visível e APIs locais. Criação → devolução comentada → correção → reenvio → publicação; autor sem ação de aprovação; leitura anônima e telas de 375/768/1440 px sem overflow ou chamadas a `/api/academy`/`/api/live`.
- Pela API: visitante/cliente/pendente/inativo bloqueados para autoria; rascunho alheio oculto; conflito 409; template inválido e imagem falsa rejeitados; publicação permanece intacta ao salvar rascunho; tornar privado/despublicar retira leitura direta, busca, metadados do artigo e mídia para visitante/cliente; mídia histórica não pode ser excluída.
- Cinco HTMLs e PDFs originais disponíveis tiveram hashes conferidos. O texto do corpo após “Passo a passo” foi comparado integralmente, com espaços normalizados. Cada artigo passou por **cinco ciclos Visual → HTML → Visual**, salvamento e reabertura com igualdade do JSON normalizado. Zoom em viewport de 375 px por Enter/Escape devolveu foco ao botão. Pesquisa também foi enviada por Enter.
- **23 ocorrências de imagens**, com a repetição PR preservada; **22 arquivos locais**, total real de **3.527.847 bytes** (~3,36 MiB). A faixa IBS/CBS de 645×42 foi preservada. Esse peso foi medido nos arquivos importados, não inferido dos PDFs.
- PDFs: cinco primeiras páginas renderizadas e inspecionadas nesta execução; análise histórica de 34 páginas está nos documentos de referência. Não se declara comparação pixel a pixel nem nova inspeção própria de todas as 34 páginas.
- Importador reexecutado sem criar artigos ou reenviar mídia já concluída. Usa hashes, slug determinístico e checkpoints para retomada. Os cinco artigos permanecem **rascunhos privados**, sem publicação automática.

Resultados resumidos e screenshots do artigo sintético público estão em `platform/reports/kb/`. Originais, documentos convertidos, capturas dos artigos históricos, banco local e mídias ficam em `.kb-pilot/`, ignorado pelo Git. O relatório privado `.kb-pilot/import-report.json` enumera cada normalização e pendência.

## Conversão e revisão humana

Calibri, classes WordPress, spans, alinhamento e espaçamento antigos foram normalizados. Imagens dentro de listas/strong foram mantidas na ordem de leitura como blocos. Logo/cabeçalho legado virou cabeçalho institucional único; menu, busca e rodapé do tema não foram importados. Revisor e datas históricas são referências, não autoria ou auditoria atual. Revisão ausente permanece nula. Não foi inventada conclusão/resultado; essa seção e os textos alternativos vazios precisam de revisão antes de submissão. Não se comprovou a visibilidade histórica do WordPress, por isso o lote não foi publicado.

O portal reutiliza Inter, cores e logo Academia DeMaria disponíveis no repositório. Um eventual lockup institucional específico da BC pode substituir esse asset após fornecimento/aprovação da marca.

## Reproduzir localmente (PowerShell, diretório `platform`)

```powershell
pnpm install
$env:KB_LOCAL_PILOT='1'
pnpm dev
```

Em outro terminal no mesmo diretório, com os originais nos caminhos do manifesto:

```powershell
node scripts/kb-pilot-import.mjs
$env:E2E_BASE_URL='http://127.0.0.1:4174'
$env:KB_E2E_PILOT='1'
pnpm exec playwright test tests/e2e/kb-api-pilot.spec.js tests/e2e/kb-pilot.spec.js
pnpm test
pnpm typecheck
```

Pare o servidor antes de `pnpm build`, para evitar disputa dos manifests `.next` entre dev/build. Se Chromium não estiver instalado, execute `pnpm exec playwright install chromium`. O teste dos cinco originais é marcado como pendente/skipped quando esses arquivos externos não existem; isso não equivale a homologação deles em outro ambiente.

O piloto cria o esquema numa pasta nova `.kb-pilot/database`; uma instância antiga não aplica automaticamente mudanças posteriores da migration. Para reiniciar, pare o servidor, faça backup e **renomeie** a pasta `.kb-pilot` para um arquivo de homologação; uma nova execução cria outro banco. Não use o piloto em servidor compartilhado.

## Configuração externa pendente

1. Revisar e aplicar `platform/supabase/migrations/20261008125328_knowledge_base.sql` em staging autorizado. Validar PostgREST, relações retornadas por embeds, grants existentes, RLS com JWTs reais, Storage e perfis da Academia. PGlite verifica SQL/RLS local; não substitui essa homologação real de Supabase.
2. Usar as variáveis Supabase já existentes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e a credencial de serviço **somente no servidor**, usada pela autenticação existente e pelo adaptador privado de mídia. Não colocar segredo no navegador. `KB_LOCAL_PILOT` deve ficar ausente em produção.
3. Definir `KB_PUBLIC_ORIGIN` somente após aprovação/provisionamento da origem HTTPS, sem caminho, query ou credenciais. Enquanto ausente, localhost/staging ficam `noindex` e sitemap responde 404. Indexação/sitemap exigem Host exatamente igual à origem configurada; a raiz desse host reescreve para `/bc`. Autorização permanece em RLS, independentemente do host.
4. Ensaiar o sitemap no host aprovado, incluindo retirada/privacidade, e validar a indexação real após implantação autorizada. Essa configuração não foi provisionada aqui.
5. Confirmar orçamento/franquias pela ocupação e tráfego reais do projeto, crescimento, retenção de revisões e frequência de leitura. Nenhum serviço pago ou plano adicional foi contratado; não há custo adicional contratado nesta entrega. Uso futuro de Storage/egress depende do plano e tráfego existentes.

## Imagens do Fórum: migração preparada, não aplicada

`ArticleImage` agora reconhece `academy-articles` e `academy-article-images` e solicita entrega autorizada via `/api/media`; imagens assinadas usam 60 segundos. Testes cobrem assinatura, artigo alheio e cliente sem autorização. O bucket remoto atual **continua público**: não se afirma que seus URLs antigos ficaram privados.

Antes de mudar o bucket: inventariar `article_images`/referências JSON e objetos (caminho, artigo, perfil, bytes, checksum); mapear URLs diretas e assinadas legadas; copiar metadados e objetos; testar um clone privado em staging com posts existentes, coautores e clientes autorizados; identificar órfãos sem apagar automaticamente; validar o cliente preparado; só então alterar o bucket autorizado e testar URLs diretas, previews e posts antigos. Como URLs públicas do WordPress ou de buckets anteriores podem continuar acessíveis, privacidade retroativa exige tratar cada origem separadamente.

## Backup, recuperação e reversão

- Banco: exportar esquema/dados das tabelas `kb_*`, políticas, funções e vínculos da Academia antes da aplicação remota. Guardar migration e versão da aplicação juntas.
- Storage: copiar separadamente os objetos `academy-kb` e os buckets do Fórum, com inventário/checksums. Backup do banco não contém esses bytes. Guardar também originais e relatório de conversão com acesso restrito.
- Ensaio de recuperação: restaurar banco e objetos em ambiente isolado; conferir hashes, IDs/paths, permissões, cinco documentos, buscas e mídia pública/privada. Registrar duração e falhas. Nenhum ensaio de recuperação remoto foi executado.
- Local: parar dev antes de copiar `.kb-pilot/database`, `.kb-pilot/media`, mapas, originais e relatórios; restaurar uma cópia em pasta isolada antes de usar.
- Reversão: manter backup e versão anterior da aplicação; retirar as rotas/feature da BC da implantação autorizada, conservar dados/revisões/mídias e corrigir por migration aditiva. Não dropar tabelas nem apagar imagens para “desfazer”. Se uma mudança autorizada do bucket do Fórum quebrar posts, restaurar metadados/configuração anterior a partir do inventário; tornar público novamente exige avaliar a exposição antes de decidir.
- Retirada futura impede novas entregas pela API; bytes já baixados, blobs já abertos ou cópias externas não podem ser recolhidos. URLs assinadas eventualmente obtidas fora desse proxy conservam sua validade residual de até 60 segundos. Falha ao remover bytes após revogar metadados deixa órfão privado para manutenção, sem liberar leitura pública.

### Simplificação da consulta

Resumos dos cards limitados a três linhas com reticências. Removidos os sumários laterais da leitura da BC e do editor do Fórum, mantendo os títulos do conteúdo. A pesquisa pública usa apenas o termo e a página; parâmetros antigos de filtros não restringem silenciosamente os resultados. `/bc/previas` também pesquisa os cinco originais por título, conteúdo e tags, exclusivamente no piloto local.

Verificação: typecheck, 14 testes de PostgreSQL/permissões e renderização do Fórum, e navegador em 1440 e 375 px (clamp real, pesquisa por selo, alinhamento do corpo, ausência de sumário e de overflow).

## Publicação autorizada em produção — 08/10/2026

PR #30 integrado à main, commit `d712b1ebb839ef9d3f4c32cdad31e78a038cf60d`, deploy `dpl_7wupk2pEm43qr7TuwAcT7t868pEG` READY. Portal: https://academia-demaria.vercel.app/bc. Leitura interna: /conhecimento/base; autoria/revisão: /conhecimento/oficial.

Migration `20261008125328_knowledge_base` aplicada e histórico remoto alinhado ao arquivo versionado. Os cinco artigos foram publicados por revisão exata, com autorização de Daniel José, descrições contextuais de imagens e orientação de verificação baseada no conteúdo original. Os originais permanecem no relatório privado. O bucket academy-kb é privado, com 22 objetos; a leitura entrega apenas mídia autorizada. WordPress permanece disponível.

Validação: 281 testes locais, TypeScript, build do commit isolado, três jornadas Playwright da BC, CI completo/Semgrep/Vercel e gate Vimeo real em Supabase de homologação isolado passaram. Navegador de produção conferiu os cinco artigos, marcadores de listas, centralização de imagens, busca FUNARPEN no corpo, zoom mobile, ausência de snapshot da Academia na leitura pública, bloqueio do editorial anônimo, rotas de piloto 404 e navegação autenticada real pela Academia até leitura e área editorial. Sessão temporária de teste encerrada após a validação, sem envio de e-mail.

As pendências de configuração acima registram o estado anterior à autorização. A migration e publicação já foram executadas. Origem exclusiva/indexação, migração do bucket do Fórum e ensaio remoto de recuperação continuam fora desta implantação. Evidências e recibo em `.kb-pilot/production`, fora do Git.
## Migração ampliada para produção

Em 09/10/2026 (UTC), o administrador autorizou a implantação de todas as alterações de código e a migração do lote WordPress. Foram migrados 423 artigos, reutilizando os cinco links já publicados: 221 públicos para clientes, 177 publicados com acesso privado interno e 25 rascunhos por mídias/anexos pendentes. Foram preservados autoria, criação/edição de origem, revisão declarada e 343.489 visualizações históricas (um artigo sem contador conhecido). Os artigos com produto ausente identificam expressamente essa ausência, sem atribuir um software fictício.

O helper temporário de importação exige credencial de servidor e perfil administrativo ativo, publica por revisão exata usando `kb_mutate`, guarda identidade/hash de origem para retomada e é removido após a migração. As imagens ficam no bucket privado `academy-kb`; o proxy mantém autorização por artigo/publicação. Backup e checkpoints ficam em `.kb-pilot/wordpress-100/release`, fora do Git e da Vercel. Foram verificados os 423 documentos em banco isolado, retomada sem duplicação, ausência de mídia pendente em publicações e bloqueio de privados/rascunhos para visitantes.

Validação de código: 302 testes Vitest, oito testes Node dos scripts, TypeScript e build de produção. Relatórios privados de auditoria, credenciais e temporários não fazem parte da implantação.
