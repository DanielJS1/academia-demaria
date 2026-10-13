# Etapa 10 — validação integrada e fechamento

13/10/2026. Executada após a etapa 09, no checkout local, sem deploy, push ou alterações em banco externo. Alterações locais anteriores, inclusive Trilhas/Discord e avisos de conclusão dos players, preservadas.

O resultado rastreável está em [CHECKLIST-FINAL.md](./CHECKLIST-FINAL.md): pedidos dos vídeos/briefing, critérios dos nove prompts e cenários de dados com estado **atendido/parcial/pendente**. A implementação atende ao escopo de produto nos testes isolados. A aplicação de migrações e a homologação com serviços reais continuam pendentes para uma futura liberação externa.

## Correções encontradas na validação

1. **Foto/senha:** os overlays antigos não continham o foco de teclado nem restauravam o acionador. Adicionado `components/layout/use-modal-focus.ts`, consumido por ambos os diálogos. Tab/Shift+Tab ficam no painel, Escape fecha e o foco retorna ao botão. Upload/remoção da fixture continuam funcionais; nenhuma senha real alterada.
2. **E2E de Relatórios:** o seletor genérico contava também as duas linhas da tabela de pontos de atenção, aparentando 27 em vez de 25. O teste agora identifica a tabela por `aria-labelledby=report-table-title`; acrescentada a análise de avaliações à regressão existente. Não foi alterada a paginação do produto.
3. **Players existentes:** iframe e aviso de conclusão compartilhavam a chave React da aula. O aviso recebe `completion:<lessonId>` em Vimeo e YouTube, preservando o reset por aula e sem alterar progresso/XP. O script isolado de players passou a deduplicar React/React DOM e pré-otimizar dependências no Vite, evitando duas instâncias de React e recarga durante o ensaio. Erros de console/runtime agora fazem o teste falhar.
4. **Cobertura:** três testes adicionais em `reports/server.test.ts`: segundo gestor; referência de métricas por aritmética/SQL independente; rota GET real para admin, gestores A/B, colaborador e cliente, incluindo recusa de pessoa adulterada e resposta privada/no-store.

## Dados de referência independentes

Fonte PostgreSQL isolada: pessoa A tem dois dias com acesso (0 s e 120 s), pessoa B um dia (60 s). São seis dias observáveis para A e três para B. Um usuário de outra equipe tem 86.400 s e não entra no conjunto do gestor A.

| Indicador | Cálculo independente | Resultado do serviço/tela |
|---|---|---|
| Pessoas com acesso | A e B | 2 |
| Dias com acesso | 2 + 1, incluindo o dia de zero segundos | 3 |
| Tempo ativo estimado | (0 + 120 + 60) / 60 | 3 min |
| Frequência agregada | 3 / (6 + 3) × 100 | 33,33% |
| XP do período | 10 − 2; 900 de outra equipe excluído | 8 XP |

O teste grava os datasets reais produzidos pelo serviço em `reference-datasets.json`. O ensaio de interface adapta somente identidade de transporte/filtros à sessão simulada; os valores/linhas vêm do serviço testado. Conferidos os KPIs, as duas pessoas, o CSV e o PDF em tela. O parser independente de CSV confirma 10 + (−2) = 8; a extração do PDF confirma os dois nomes e o total. Não foi usado o gerador de fixtures visuais como oráculo de cálculo de domínio.

## Verificações executadas

- `pnpm exec next typegen` e `pnpm typecheck`, inclusive após remover a rota temporária.
- `pnpm test`: **430 testes aprovados em 48 arquivos**, cobrindo domínio, rotas, permissões, migrações e consultas PostgreSQL isoladas. Rodada final registrada em `output/integrated-stage10/vitest-final.log`. Um arquivo opcional de revisão WordPress continua ignorado pela condição preexistente; não representa um teste executado/aprovado.
- `pnpm exec vitest run src/lib/reports/server.test.ts`: 20 testes aprovados, incluindo as três novas verificações.
- `pnpm test:players`: **11 cenários aprovados**, zero erros de console/runtime na rodada final. Salvamento periódico, falha/retry, retomada, permanência mínima no vídeo, avanço ao final, administrador, prévia sem escrita e revisão de trechos. SDKs simulados, sem streaming externo.
- Playwright adaptado ao ambiente isolado, reutilizando as verificações de `management-reports.spec.ts`, scripts/fixtures 03/07/08/09 e `report-fixtures.mjs`.
- **Conhecimento:** Fórum inicial, um caractere sem consulta, cinco fontes, prévias/paginação, DLL no corpo pelos testes de domínio, erro parcial/retry, digitação rápida, voltar, material correto por deep link, Escape, troca de usuário sem misturar notas, todas as fontes vazias e limpar. Sem erros JavaScript na rodada final.
- **Relatórios:** seis visões, avaliações/pontos de atenção, tabela/barras/rosca, pessoa/departamento/período customizado, erro de limite com exportação desabilitada, retry, 32 linhas paginadas e **1.005 linhas exportadas**. Fontes no banco acima de 1.000 verificadas pelos testes de servidor, sem confundir esse ensaio com o dataset simulado de UI.
- **Gestão:** lista→ficha→PDI/conquista/trilhas→relatório, contextos de ida/volta, pessoa/atribuição adulterada, pendentes sem ação, requestId repetido e exatamente +100 XP, foco/Escape/retorno. Leitura/navegação não emite comandos de mensagens.
- **Telas secundárias:** 32 combinações de quatro telas × quatro larguras × dois temas; busca/favorito, abertura de aula, avisos e foto/senha. Checagem adicional de contenção do foco e retorno ao botão da senha após a correção.
- **Visual/acessibilidade:** Conhecimento, Gestão e referência de Relatórios em 1440/1024/768/390 px, ambos os temas; gráficos/tabela equivalentes e controles por teclado. 62 amostras de texto em Conhecimento/Gestão/Relatórios com contraste mínimo **4,76:1**. Isso é uma auditoria direcionada, não certificação WCAG integral.
- Reflow equivalente a 200% por viewport CSS reduzido à metade em Relatórios e telas secundárias; Conhecimento também teve ensaio de zoom CSS. Não foi acionado zoom nativo em todas as combinações nem testada toda combinação de tecnologia assistiva.
- **Exportação:** dez CSVs e dez PDFs de teste. Todas as páginas renderizadas com Poppler e verificadas por parser/extração; inspeção visual de contato, primeira/meio/última página do relatório longo e PDF de referência. Relatório de 1.005 linhas contém 32 páginas e chega a “Pessoa 1005”; certificado imprime isolado.

## Arquivos alterados nesta etapa

- `platform/src/components/layout/use-modal-focus.ts`
- `platform/src/components/profile-photo-modal.tsx`
- `platform/src/components/password-change-modal.tsx`
- `platform/src/components/vimeo-lesson.tsx` e `youtube-lesson.tsx` — somente distinção da chave do aviso nesta etapa.
- `platform/scripts/test-video-players.mjs`
- `platform/src/lib/reports/server.test.ts`
- `platform/tests/e2e/management-reports.spec.ts`
- `CHECKLIST-FINAL.md`, este registro e o status em `README.md`.

## Evidências e reprodução

Em `output/integrated-stage10/`: scripts Playwright, fixture de bootstrap, `reference-datasets.json`, CSV da fonte, `reference-ui-validation.json`, `accessibility.json`, log final Vitest, pastas `knowledge/`, `management/`, `secondary/` e `pdf/`. Os comparativos anteriores permanecem em `output/secondary-stage09/`; não foram fabricadas capturas históricas de telas sem um “antes” preservado.

Para repetir a validação de domínio, execute os comandos acima em `platform/`. Para gerar a referência, use `REPORT_QA_OUTPUT` apontando a um diretório de evidências antes de executar `reports/server.test.ts`.

Para repetir os scripts de navegador, restaure **temporariamente e somente localmente** `bootstrap-fixture.txt` em `platform/src/app/stage10-preview-local/page.tsx`, inicie `pnpm dev` e execute os scripts pelo runner `node run.js <caminho-do-script>` a partir de `.agents/skills/playwright-skill`. As APIs são interceptadas e os serviços externos bloqueados. O script de Conhecimento escreve as oito imagens em `C:/tmp/stage03-*.png`; nesta execução foram copiadas para a pasta de evidências. Para renderizar/exportar PDFs, use o runtime Python/Poppler e o script de inspeção arquivado. Remova a rota temporária e regenere os tipos ao terminar.

A execução original do spec de staging com credenciais não foi feita. Seu fluxo foi adaptado às fixtures locais, e o arquivo original passou pelo typecheck. Não foram realizadas operações em contas reais para validar notificações, uploads, senha ou publicação.

## Migrações e integrações para uma liberação posterior

Não foi inspecionado nem alterado o histórico de migrações do banco publicado. Aplicar apenas o que estiver ausente, pelo fluxo de migrações do ambiente autorizado, respeitando a ordem existente; não repetir indiscriminadamente migrações já instaladas.

| Dependência | Situação / efeito |
|---|---|
| `20261013011330_report_temporal_events.sql` | Nova migração da reforma preparada e testada em PGlite; aplicação externa pendente. A data real da aplicação inicia a coleta prospectiva |
| `202609210002_engagement.sql` | Presença/diários e início da coleta; pré-requisito existente a verificar no destino |
| `20261009213438_learning_trails_and_alerts.sql` | Atribuições/prazos/política usados pelos relatórios e Gestão; pré-requisito a verificar |
| `202609240001_manager_recognition.sql`, `202609240007_recognition_idempotency.sql` | Conquista +100 XP e retry idempotente; verificar instalação |
| Aprendizagem, múltipla escolha/proficiência, comunidade e desafios existentes | Preservar sequência completa do repositório; atenção a `20261006182007_periodic_quiz_history_rewards.sql` e `20261006193250_periodic_quiz_notifications.sql` |
| `20261010012411_discord_learning_bot.sql` e configuração Discord | Integração preexistente preservada; validar somente em ambiente de teste sem destinatários reais |
| Supabase Auth/Storage e credenciais server-side | Homologar login, RLS, permissões, upload e senha em staging; nenhum segredo exposto no browser ou nesta documentação |
| Email/cron/Discord | Mantidos conforme `.env.example`; não foram configurados, ativados ou usados para envios nesta etapa |

Sem a fonte/migração necessária, a interface deve continuar mostrando indisponibilidade, não métricas fictícias. Sem evidência legada, publicações/conclusões antigas têm data desconhecida; reações no período são prospectivas; comentários deletados e importações limitam a cobertura. Tempo ativo permanece **estimado**, departamento permanece o cadastro **atual** e XP não é recalculado por interações.

## Fechamento

Validação local concluída, com correções e evidências reproduzíveis. Nenhum pedido de interface dos vídeos ficou identificado como não implementado. As ressalvas reais de histórico, comparativo visual histórico e serviços externos estão explícitas no checklist. A próxima ação possível é homologação/implantação controlada em ambiente autorizado, fora desta etapa; nenhuma publicação foi realizada.
