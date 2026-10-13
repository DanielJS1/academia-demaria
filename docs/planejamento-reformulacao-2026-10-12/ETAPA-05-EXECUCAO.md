# Etapa 05 — Desafios, comunidade, XP e histórico

Concluída em 12/10/2026. Executado somente `05-dados-desafios-comunidade-xp.md`; etapas 06–10 permanecem pendentes.

## Entrega

A API `/api/reports` agora suporta as seis visões: `overview`, `presence`, `learning`, `challenges`, `community` e `xp`. Reutiliza população ativa autorizada, filtros, contratos, paginação, limites e headers privados da etapa 04. Nenhuma interface ou análise atual de Minha Gestão foi removida.

### Desafios

Consulta tentativas oficiais por `completed_at`, com pontuação percentual, aprovação, edição/revisão e versão da regra de pontuação. Preserva uma tentativa por pessoa/edição, conforme a unicidade existente. Usa audiência registrada no snapshot ou a edição interna existente para filtrar o conteúdo; filtro de desafio externo é rejeitado antes de ler tentativas.

Snapshot bruto, alternativas corretas, respostas e explicações não são enviados. `reviewAvailable`, `correctCount` e `questionCount` distinguem revisão completa de legado. Não se reconstrói resultado usando o desafio atual. Média da equipe é média das médias individuais; participação é contagem. Taxa de participação é nula porque não há snapshot departamental de elegibilidade.

### XP

Leitura do ledger somente das pessoas autorizadas, até o instante de geração. Retorna `xp_period`, `xp_season` e `xp_history` separadamente. Soma os valores persistidos, inclusive zero após estorno; não calcula XP por quantidade de interações nem altera as regras existentes. Temporada usa o ano em São Paulo.

Cobertura parcial explícita: histórico disponível e importações não comprovam todo o passado. O período usa `created_at` do lançamento com o valor atualmente armazenado; não é um snapshot do saldo que existia naquele dia. O leitor aceita ajustes assinados, sem alterar a restrição atual de escrita do banco.

### Comunidade

- `publications`: primeira publicação comprovada por artigo/autor, sem duplicação de coautoria ou edição.
- `comments_made` / `comments_received`: IDs de comentários persistidos, por `created_at`, inclusive sem recompensa; recebidos excluem comentários do próprio autor.
- `like_made` / `like_received` e equivalentes `hype`: ativações no período, deduplicadas por usuário/artigo/tipo dentro de cada direção. On–off–on não aumenta a participação para premiação.
- `like_active_made` / `like_active_received` e equivalentes `hype`: saldo ativo **atual**, separado do histórico.

Conteúdo de comentários, nomes/e-mails de atores externos à equipe e eventos brutos não são serializados. Recebidos são autorizados pela propriedade do artigo ou pelo autor registrado no evento. Nenhum corpo, tecla, URL de navegação, IP ou tempo de estudo foi instrumentado.

Comentários permanecem com cobertura parcial porque moderação pode remover os registros históricos. Exclusão de uma conta pode retirar a identidade de atores em eventos de reação: nesse caso a deduplicação recebida é um mínimo comprovado e a cobertura também informa a limitação.

### Conclusões e visão geral

`learningMode: "activity"` / `learningDetail: "courses"` agora retorna **eventos de conclusão**, com data e versão registradas. Não apresenta progresso atual como estado histórico. Situação atual mantém os cálculos da etapa 04. No modo de eventos, estados diferentes de `completed` são rejeitados, pois início/progresso histórico não foram instrumentados.

Escopo Atribuídos considera o conjunto de atribuições atualmente elegíveis; Catálogo fica separado. Departamento e população também permanecem atuais, conforme os metadados do contrato. Nome do curso vem do cadastro disponível; versão e data vêm do evento, sem promessa de título histórico. Conclusão de versão anterior é preservada quando o curso continua no conjunto selecionado.

Visão geral usa quatro KPIs do período — pessoas com acesso, tentativas corrigidas submetidas no intervalo, participações em desafios e XP — mais presença diária e situação **atual** das atribuições. Séries e KPIs reutilizam os mesmos serviços de domínio; correções usam a semântica de `submitted_at` documentada na etapa 04.

## Inventário e migração preparada

Migração: `platform/supabase/migrations/20261013011330_report_temporal_events.sql`, criada pelo comando `supabase migration new report_temporal_events`. **Preparada e testada localmente; não aplicada ao banco publicado.**

Lacunas comprovadas no código:

1. Criação/edição de artigo não provam primeira publicação. Recompensa `publish` preservada comprova parte do legado, inclusive com amount=0/revogada.
2. `created_at` de reação não muda na reativação. Recompensas limitadas/deduplicadas não contam todo o engajamento.
3. `academy_progress.updated_at` é mutável. XP `completion` é deduplicado por pessoa/curso/evento, não por versão, e não garante um novo registro para nova conclusão.

Tabelas novas:

- `academy_report_collection`: início real da coleta, definido ao aplicar a migração; não é a data do nome do arquivo.
- `academy_report_publications`: uma primeira publicação por artigo; origem `legacy_reward`, `baseline_unknown` ou `prospective`. Baseline desconhecido tem data nula por constraint.
- `academy_report_reactions`: somente transições reais de estado, com identificadores, tipo e instante.
- `academy_report_completion_state`: estado observado por pessoa/curso/versão e identificação do baseline já concluído.
- `academy_report_completions`: uma conclusão prospectiva por pessoa/curso/versão.

Triggers registram eventos na mesma transação da escrita que materializou a publicação, transição ou conclusão. Não substituem RPCs nem concedem XP. Repetição sem mudança não gera ativação; PKs e estado observado impedem duplicação de conclusão/publicação. Advisory locks ordenados protegem a avaliação de estado por pessoa/curso/versão.

Baseline consistente é carregado sob lock. Cursos já concluídos **não** recebem evento/datagem, mesmo após reset e repetição na mesma versão. Publicações antigas sem prova preservam data desconhecida; editar não inventa primeira publicação. Legado com recompensa de publicação recebe exclusivamente a data original comprovada, não a data da migração.

Conclusão reproduz as regras existentes: aulas não quiz concluídas, provas da versão/atividade, compatibilidade legada e proficiência. Aprovação posterior e proficiência geram evento quando tornam o curso concluído. A semântica existente de proficiência entre versões foi preservada, sem alteração nas regras de XP.

Novas tabelas têm RLS e não concedem leitura/escrita aos papéis de navegador. Funções são `SECURITY INVOKER`, com execução restrita a service role. Índices cobrem pessoas/autores e intervalos das fontes novas.

## Desde quando os dados são completos

| Métrica | Cobertura |
|---|---|
| Resultado oficial de desafio | Tentativas persistidas por `completed_at`; revisão detalhada somente com snapshot completo |
| XP | Ledger disponível, valores atuais; legado/importações identificados como parciais |
| Primeira publicação | Após `academy_report_collection.collected_since`; antes, somente prova legada preservada |
| Ativação de like/hype | Prospectiva após início da coleta; saldo ativo atual continua disponível separadamente |
| Comentários | Registros sobreviventes; exclusões impedem promessa de histórico completo |
| Conclusão por versão | Primeiras conclusões observadas após coleta, excluindo baseline já concluído; período anterior é indisponível |

Intervalos que cruzam o início da coleta mostram cobertura parcial. Intervalo inteiramente anterior não vira zero em métricas exclusivamente prospectivas. Sem instalar a migração, comunidade/eventos temporais retornam erro explícito de fonte, não dados fictícios.

## Arquivos e verificações

- Novos módulos em `platform/src/lib/reports/{challenges,community,xp,history,overview}.server.ts`.
- Integração em `server.ts` e `learning.server.ts`; campos opcionais em `contracts.ts`.
- Migração acima; `events.test.ts` e extensão de `server.test.ts`.
- Typecheck aprovado.
- **117 testes em dez arquivos aprovados**: relatórios, migração de eventos, comunidade, histórico/rotas de desafios, múltipla escolha, proficiência/backend e presença.
- PostgreSQL isolado via PGlite: RPCs atuais de aprendizagem/comunidade, colaboração, reconhecimento e nova migração; primeira publicação versus edição; recompensa zero; baseline desconhecido; on–on/on–off–on; comentário sem recompensa; correção tardia; proficiência e versões; retry/XP idempotente; rollback conjunto; papéis de navegador bloqueados.
- Leituras reais em PostgreSQL isolado: 1.005 comentários, lançamentos de XP e tentativas de desafio sem corte; população adulterada recusada antes das fontes; ledger/estornos; legado sem snapshot; médias e KPIs/séries consistentes.

Não foi realizado teste de performance no banco publicado nem alteração de produção. A migração requer o esquema existente de aprendizagem e comunidade; deve ser aplicada pelo fluxo de migrações do ambiente autorizado antes de habilitar as novas fontes temporais. Sem deploy ou push. Trilhas, Discord e demais alterações locais preexistentes preservados.

Próxima etapa: `06-relatorios-interface.md`.
