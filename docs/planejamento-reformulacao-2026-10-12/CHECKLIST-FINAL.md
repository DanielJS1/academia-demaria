# Checklist final — reformulação da Academia

13/10/2026. Referência: `PLANEJAMENTO.md` e prompts 01–10. “Atendido” significa comprovado no checkout e no ambiente isolado descrito, não implantação em produção. “Parcial” identifica uma limitação de evidência ou integração externa. “Pendente” identifica trabalho ainda necessário fora desta execução.

## Pedidos rastreados aos vídeos e ao briefing

| Pedido / origem | Estado | Evidência |
|---|---|---|
| Conhecimento intuitivo, DLL e acessos coesos — 193411 00:00–01:14 | Atendido | `knowledge.tsx`, adaptadores de busca; `knowledge/search.test.ts`; QA Conhecimento da etapa 10, cinco fontes, resultados junto à busca |
| Separar gestão de análise — 193809 00:00–01:03 | Atendido | `management-page.tsx` operacional; `reports-page.tsx` analítico; percurso ficha→relatório e retorno validado |
| Compactar Aprender / retirar livro — 01:03–01:30 | Atendido | `catalog.tsx`, comparativo 1440×900 da etapa 09; cards aproximadamente 280 px mais acima |
| Compactar Minhas Trilhas — 01:30–01:45 | Atendido | `my-trails.tsx`, capturas em quatro larguras; abertura do curso e integração Discord preservadas |
| Aviso menor e mais alto em Desafios — 01:45–02:09 | Atendido | `quiz-notification-control.tsx`; ativar, cancelar e falha testados; mensagens acessíveis |
| Evolução compacta / perfil ao lado — 02:09–02:36 | Atendido | `evolution.tsx`, duas colunas quando há espaço; foto/senha e histórico preservados |
| Clareza para gestores / referência Trilhas — 02:36–03:01 | Atendido | Três sinais operacionais, lista e ficha; deep links de atribuições e escopo validados |
| Retirar retorno persistente de Relatórios — 03:01–03:22 | Atendido | Cabeçalho e menu próprios; navegação de contexto pela ficha, sem botão persistente antigo |
| Tabela, barras, rosca e filtros — 03:22–fim | Atendido | Seis visões, filtros e gráficos; rosca restrita a partições; tabelas equivalentes e paginação |
| Presença, notas, desafios, comunidade, XP e ranking — briefing | Atendido | Serviço autorizado por domínio, testes em PostgreSQL isolado, seis visões e exportações |
| Conquistas e colaboradores em Gestão — briefing | Atendido | PDI/conquista/trilhas; retry do mesmo requestId concede +100 XP uma única vez |
| Plano e execução ordenada — solicitação | Atendido | Prompts 01–10, registros de execução e este fechamento |

## Critérios dos prompts 01–09

| Critérios | Estado | Evidência concreta |
|---|---|---|
| 01.1–2 — contratos Zod, IDs, seis visões, cobertura e semântica | Atendido | `reports/contracts.ts`, `reports/reports.test.ts`; respostas validadas no cliente |
| 01.3 — escopo único, ativos internos, pendentes operacionais | Atendido | `team-scope.test.ts`, `reports/server.test.ts`, `management.test.ts`; admin e dois gestores, aluno/cliente/pendente/inativo |
| 01.4 — 7/30/custom, Brasília, limites e intervalo exclusivo | Atendido | Testes de períodos e servidor; meia-noite, futuro e intervalo de 366 dias |
| 01.5 — pessoa correta, conclusão/proficiência e atribuições deduplicadas | Atendido | `learning-rewards.test.ts`, `reports/server.test.ts`; duas trilhas não duplicam o par pessoa/curso |
| 01.6–7 — diagnóstico sanitizado e lacunas documentadas | Atendido | Questões múltiplas, parciais e pendentes nos testes; nota persistida preservada; registros 01/04/05 |
| 02.1–2 — PageHeading compacto opt-in, fontes/tokens/temas | Atendido | `page-heading.tsx`, `page-layout.css`; verificação 02 e capturas 09/10 |
| 02.3–4 — componentes compartilhados, escala e hierarquia | Atendido | MetricCard/FilterBar/AppliedFilters/DataState usados por Gestão/Relatórios; sem nova biblioteca de gráficos |
| 02.5–6 — CSS temático, estados, foco, alvos e diálogos | Atendido | Folhas por módulo, estados explícitos, foco em ficha/diagnóstico/perfil; 62 amostras de contraste em 10, mínimo 4,76:1 |
| 03.1 — Fórum inicial e acessos/ações preservados | Atendido | QA Fórum inicial; módulos de publicação, materiais e editorial mantidos; testes de comunidade/KB |
| 03.2 — resultados próximos, debounce/cancelamento | Atendido | Um caractere não consulta; termo antigo não substitui termo novo; QA etapa 10 |
| 03.3–5 — cinco fontes, notas locais, trechos e DLL no corpo | Atendido | `knowledge/search.test.ts`; cinco adaptadores; notas de um usuário não aparecem para outro no mesmo navegador |
| 03.4/6 — prévias, paginação, vazio, parcial e falha por fonte | Atendido | Prévia de três, páginas de vinte/cinco, retry somente da fonte, cinco fontes vazias na rodada final |
| 03.7 — deep link, limpar, voltar e material correto | Atendido | Histórico do navegador, limpar, URL do item correto e Escape testados |
| 04.1–3 — leitura autenticada, presença por intervalo/cobertura | Atendido | Rota real GET testada em PostgreSQL isolado; negação antes de ler eventos; zero distinto de indisponível; no-store |
| 04.4–5 — atual versus período, aulas versus conclusão, avaliações | Atendido | Fonte atual e eventos separados; 100% de aulas com prova pendente; proficiência, tentativas e diagnóstico |
| 04.6–7 — base comum, médias, paginação e leitura privada | Atendido | 1.005/10.005 tentativas, rejeição explícita de excesso; média individual; referência externa à implementação |
| 05.1–2 — desafios oficiais e XP por ledger | Atendido | Testes de desafios/rotas e relatórios; snapshots legados marcados; XP de período/temporada/histórico e estornos separados |
| 05.3–5 — interações, primeira publicação, idempotência temporal | Atendido | `reports/events.test.ts` e servidor: edição, recompensa zero, on–off–on, comentário sem recompensa, saldo atual |
| 05.6–7 — conclusão prospectiva sem retroatividade/XP extra | Atendido | Migração executada em PGlite; baseline sem data inventada, aprovação tardia/proficiência, retry e rollback |
| 06.1–2 — Relatórios independente, seis visões e resumo contido | Atendido | QA seis visões; resumo de quatro KPIs e dois gráficos; título/menu próprios |
| 06.3–4 — filtros/URL/contexto e modos de aprendizagem | Atendido | Período customizado, departamento/pessoa, limpar/voltar; opções incompatíveis normalizadas; testes apresentação/navegação |
| 06.5–6 — formatos apropriados, unidades, ranking e tabela equivalente | Atendido | Testes apresentação; troca tabela/barras/rosca; doze pessoas no gráfico, conjunto completo na tabela |
| 06.7–9 — 25 linhas, individual, diagnóstico, estados e modularização | Atendido | QA 32/1.005 linhas, ficha contextual; diagnóstico e pontos de atenção; componentes em `components/reports/` |
| 07.1–2 — CSV completo/retangular, BOM, números e nulos | Atendido | Dez CSVs da rodada integrada, leitura por parser; fórmulas protegidas nos testes de exportação |
| 07.3–5 — PDF com mesmo dataset, gráficos, marca/contexto e certificados | Atendido | Dez PDFs gerados; comparação de KPIs/séries em tela/impressão, inspeção das páginas renderizadas; certificado isolado |
| 07.6–7 — falha/limite sem exportação enganosa ou truncamento | Atendido | Erro 422 desabilita CSV/PDF; retry válido; 1.005 registros completos e banco paginado |
| 08.1–3 — Gestão operacional, sinais reais, busca/pendentes | Atendido | Três cards, lista de ativos/pendentes, atraso real e contato com cobertura; QA Gestão |
| 08.4–5 — ficha, foco, PDI, conquista e trilhas | Atendido | Foco contido/Escape/restauração; nota privada; retry +100 XP idempotente; alteração da atribuição existente |
| 08.6–8 — deep links/autorização, análises migradas e papéis preservados | Atendido | Pessoa/atribuição incompatíveis recusadas; pendentes sem ação; retornos para relatório/ficha; administração mantida |
| 09.1–2 — Aprender/Trilhas compactos e fluxos preservados | Atendido | Capturas comparativas do catálogo; busca/favorito e abertura de aula; Trilhas/Discord preservados |
| 09.3 — preferência de avisos clara, sucesso/falha/simulação | Atendido | Mutação existente mantida, estado explícito; testes de avisos e QA ativar/cancelar/falhar |
| 09.4–5 — Evolução/perfil, XP sem repetição e responsividade legível | Atendido | Perfil/título lado a lado, indicadores no destaque, sem mudar cálculos; 32 combinações de quatro telas, ambos os temas |
| Critérios visuais comuns — 1440/1024/768/390, temas e reflow | Atendido | Capturas atuais de Conhecimento/Gestão/Relatórios e quatro telas secundárias. Reflow equivalente a 200% reduzindo viewport CSS; não foi acionado zoom nativo em todos os ensaios |
| Comparativo histórico de todas as telas nas dimensões exatas dos vídeos | Parcial | Catálogo possui antes/depois 1440×900; demais telas têm capturas finais e registros anteriores. Não foi fabricado um “antes” ausente |
| Login/Storage/Discord/Vimeo/YouTube reais em staging | Parcial | Domínio, rotas e SDKs simulados/testados isoladamente; serviços externos não exercitados com credenciais reais |
| Migrações e integrações no banco publicado | Pendente | Aplicação não verificada e não autorizada nesta etapa; ver lista no registro 10 |

## Cenários de dados e segurança obrigatórios da etapa 10

| Cenário | Estado | Verificação |
|---|---|---|
| Admin, gestores A/B, aluno e cliente; request/URL adulterado | Atendido | Novo teste da rota GET, escopo e recusas antes das fontes; parâmetros pessoa/departamento/curso nos testes existentes |
| Sem gabaritos, notas locais ou texto de PDI em Relatórios | Atendido | Contratos/seleção de campos; diagnóstico sanitizado; testes de servidor/exportação e notas privadas |
| 100% de aulas com prova pendente; proficiência; curso em duas trilhas | Atendido | `reports/server.test.ts`, `learning-rewards.test.ts`, `reports/events.test.ts` |
| Múltipla escolha fora de ordem, parcial, nenhuma nota e várias tentativas | Atendido | Testes domínio/servidor e políticas última/melhor/todas; pendente não vira zero |
| Sem cobertura versus zero legítimo; meia-noite de Brasília | Atendido | Testes período/servidor; referência: 180 s / 60 = 3 min; 3 / 9 = 33,33% |
| Departamento atual com rótulo explícito | Atendido | `departmentBasis: current`, filtro pelo cadastro atual, apresentação documentada |
| Reação repetida/reativada, publicação editada, comentário sem XP | Atendido | Migração e consultas em PGlite; eventos transacionais e contagens deduplicadas |
| XP período/temporada/histórico; ajuste negativo | Atendido | Ledger isolado e exportação; referência 10 − 2 = 8 XP, lançamento externo 900 excluído |
| Conclusão prospectiva sem backfill fictício | Atendido | Baseline sem evento datado, versões/proficiência, correção tardia e rollback |
| Leitura/navegação sem mensagens; reconhecimento único por requestId | Atendido | QA Gestão observa exatamente comandos operacionais explícitos; PGlite confirma RPC idempotente |
| Mais de 25 linhas na tela e 1.000 registros no banco/exportação | Atendido | Tabela paginada de 32, exportação de 1.005; fontes PostgreSQL com 1.005 comentários/XP/desafios/tentativas |

## Resultado

A reforma atende aos pedidos de produto no checkout e os ensaios isolados não demonstraram divergência entre a referência de dados, tela e exportações. A liberação externa continua condicionada à aplicação controlada das dependências/migrações e à verificação de staging. Este checklist não declara produção pronta nem histórico anterior à coleta como completo.
