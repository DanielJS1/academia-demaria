# 04 — Dados de presença e aprendizagem

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisito: etapa 01. Reutilize os contratos e cálculos já criados.

**Objetivo:** entregar consultas autenticadas para presença, progresso, atribuições e avaliações, prontas para a nova interface. Hoje a RPC de presença aceita 7/30, e relatórios misturam estado atual, todas as tentativas e percentuais de catálogo.

**Pontos de entrada:** /api/engagement, team-engagement.tsx, lib/engagement.ts, migração 202609210002_engagement.sql; pilot-server.ts; academy_progress, academy_attempts e academy_resources; trails-server.ts/stateFor e atribuições. Serviço novo sugerido: lib/reports/server.ts e rota /api/reports, com módulos por domínio.

**Execute:**
1. Construa leituras sem efeitos colaterais. Autentique e resolva IDs autorizados antes de buscar dados; o cliente não decide o escopo. A credencial service_role não substitui autorização. Rejeite IDs externos ao escopo e não devolva eventos, e-mails ou diagnósticos de outras equipes.
2. Implemente presença com intervalo 7/30/personalizado sobre academy_engagement_daily; mantenha API/RPC antiga compatível enquanto houver consumidores. Dias com acesso contam dias com registro, mesmo que segundos=0.
3. Tempo ativo permanece estimativa. Último acesso é o último registro conhecido em academy_presence, não o último do período histórico. Devolva collectedSince e cobertura por pessoa; dia anterior à coleta não é falta. Não altere heartbeat nem XP.
4. Para aprendizagem atual, use pares pessoa/curso de atribuições ativas, deduplicados; opção Catálogo é explicitamente separada. Calcule progresso de aulas e conclusão com avaliações, versão e proficiência. Atrasos dependem de dueDate, complete e active.
5. Exponha avaliações por pessoa/atividade/versão; padrão última tentativa corrigida no intervalo, alternativas melhor/todas rotuladas. Retorne nota oficial, estado, feedback e contagens/diagnóstico sanitizados calculados no servidor. Corrija o problema do gabarito oculto sem enviá-lo ao gestor.
6. Retorne dados tipados com mesma base para KPIs/séries/linhas, incluindo nulabilidade e cobertura. Paginar consultas ao banco acima de 1.000 registros. Limite de retorno explícito: não cortar silenciosamente; permitir refinamento do filtro.
7. Responda com Cache-Control privado/no-store e não coloque respostas gerenciais em cache compartilhado. Evite carregar o banco inteiro via readAcademy para depois descartá-lo no cliente.

**Critérios de aceite:** admin/manager/student/client; parâmetro pessoa/departamento adulterado; pendentes excluídos das métricas; 7/30/customizado, meia-noite e coleta parcial; curso em duas trilhas contado uma vez; 100% de aulas com prova pendente; múltipla escolha e crédito parcial; zero versus indisponível; mais de 1.000 registros; médias consistentes. Testar migrations/RPC em banco isolado se necessárias. Nenhuma remoção de análise de Minha Gestão nesta etapa.
