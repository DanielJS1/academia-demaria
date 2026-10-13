# Etapa 01 — contratos e escopo entregues

Implementada em 12/10/2026. Escopo: contratos e helpers de relatórios, com adaptação mínima dos consumidores de escopo. Não foram criados endpoints, telas reformuladas ou migrações nesta etapa.

## Arquivos e APIs

| Arquivo | Entrega |
|---|---|
| `platform/src/lib/reports/contracts.ts` | `reportQuerySchema`, `resolveReportQuery`, `reportDatasetSchema`, `reportRowSchema`, `reportMetricSchema`, `metricCoverageSchema` e `assessmentDiagnosticSchema`; tipos correspondentes |
| `platform/src/lib/reports/periods.ts` | Calendário válido, períodos 7/30/personalizado, limites em Brasília, `resolveReportPeriod`, `isInReportPeriod`, `observableCalendarDays` |
| `platform/src/lib/reports/scope.ts` | `assertReportActor`, `isManagedPerson`, `selectManagedPeople`, `assertManagedPerson`, `scopeProfile`; populações ativa/pendente/operacional |
| `platform/src/lib/reports/metrics.ts` | `learningRecordsFromAcademy`, `courseLearningMetrics`, `assignedCoursePairs`, `assignedCompletion`, `selectGradedAttempts`, `assessmentAverages`, `percentage` |
| `platform/src/lib/reports/diagnostics.server.ts` | `assessmentDiagnostic`: cálculo sobre snapshot persistido, resposta restrita a IDs, resultados por questão, contagens e nota oficial |
| `platform/src/lib/reports/reports.test.ts` | Cenários de domínio, autorização, contratos, datas e diagnóstico sanitizado |
| `platform/src/lib/team-scope.ts` e seu teste | Delegação ao escopo comum; padrão somente ativos, população operacional explícita |
| `platform/src/lib/trails.ts` | `canManagePerson` delega ao mesmo predicado, com exclusão do próprio ator |
| `platform/src/lib/rewards.ts` | Assinatura de `isCourseComplete` aceita somente completed/attempts; corpo e regras de XP preservados |
| `platform/src/components/team.tsx` | Uma alteração funcional de chamada: solicita população operacional para preservar o filtro de pendentes existente |

Os arquivos de Trilhas/Discord e demais mudanças locais preexistentes foram preservados. O botão de Trilhas que já estava no diff de Team não foi criado por esta etapa.

## Decisões finais do contrato

- Valores internos das seis visões: `overview`, `presence`, `learning`, `challenges`, `community`, `xp`. Rótulos em português pertencem à apresentação.
- Aprendizagem distingue `learningMode: current | activity` e `learningDetail: courses | assessments`. Padrão current/courses. A query pode guardar uma preferência de período, mas `resolveReportQuery` devolve `period: null` para situação atual. O dataset rejeita metadados temporais que finjam recortar o estado atual.
- Filtros de curso/aprendizagem e política/status de tentativas só são aceitos na visão/subvisão pertinente. Filtro de desafio exige challenges. Campos desconhecidos são rejeitados.
- População analítica sempre ativa. Pendentes só são selecionados explicitamente em consultas operacionais. Aluno, cliente ou ator inativo são recusados pelos helpers de serviço; comparação de departamento usa trim/lowercase e preserva acentos. Nenhum acesso indireto é inferido.
- `ScopeActor` de um serviço deve vir do perfil autenticado, com status e público. Os adaptadores legados de UI permitem status ausente por compatibilidade; não devem ser usados para autenticar requests. Use `assertReportActor` e `assertManagedPerson` no backend futuro.
- Intervalos usam datas de calendário e America/Sao_Paulo, incluindo hoje; timestamp inicial inclusivo e primeiro instante do dia seguinte exclusivo. Máximo 366 dias, sem futuro. Também foram testados limites históricos de horário de verão sem supor 24 horas por dia.
- Frequência utiliza dias corridos observáveis. Cobertura desconhecida retorna null; início da coleta e criação do perfil não comprovam data de aprovação/ativação. Quando uma fonte falhar, o consumidor deve marcar indisponibilidade, não chamar os cálculos com um dataset vazio como se fosse um resultado zero.
- Dataset tem IDs, linhas discriminadas por tipo, KPIs, séries e cobertura; rejeita linhas/séries fora da população declarada, registros duplicados, visão incompatível e período divergente da query. Essa validação estrutural complementa a autorização, não a substitui.
- Métricas indisponíveis usam `value: null` e motivo. Percentual com denominador zero é null, zero com denominador válido continua zero. Limite de 10.000 linhas rejeita excesso; não trunca. `meta.complete` indica conjunto sem truncamento, enquanto disponibilidade de fontes é declarada separadamente em coverage.
- Progresso de aulas é distinto de curso concluído. O helper usa completedByUser da pessoa, não state.completed do gestor. `learningRecordsFromAcademy` requer actorId explícito para adaptar o formato legado.
- Conclusão delega à regra atual de domínio (aulas e avaliações/proficiência). A regra legada de aprovação por proficiência não exige a mesma versão no helper existente; esta etapa a preserva. A etapa de dados deve explicitar esse comportamento em vez de mudá-lo silenciosamente.
- Pares atribuídos são deduplicados por pessoa/curso/versão corrente; somente atribuições ativas, pessoas autorizadas e cursos internos disponíveis. Cursos livres não entram na taxa atribuída. Sem atribuições, percentual é null.
- Política de notas padrão latest: última tentativa com nota/status corrigido por pessoa/curso/atividade/versão. best e all são alternativas explícitas. Filtrar intervalo antes de selecionar. Média do time é média das médias individuais; não ponderar uma pessoa pelo número de tentativas. Zero é nota válida, pendência/ausência de nota não.
- Diagnóstico usa `isChoiceAnswerCorrect` para múltipla escolha, mantém parcial separado e não recalcula a nota oficial. Tentativa pendente tem todas as questões identificadas como pendentes, sem simular erros. Gabarito oculto ou campos legados de correção ausentes ficam indisponíveis. Não devolve texto de respostas nem gabaritos.

## Integração reservada às etapas 04/05

O módulo `diagnostics.server.ts` prepara cálculo puro para o servidor, mas não é um endpoint e não executa autorização por conta própria. Seu caller deve autenticar, conferir escopo e passar o snapshot bruto antes da remoção do gabarito. Nenhuma tela o importa. A resposta é validada pelo contrato estrito. Ao conectar a API, mantenha a fronteira server-only e nunca envie o input para o cliente.

As RPCs atuais de presença e os cálculos legados de `readAcademy` não foram substituídos; a migração dessas leituras e seus consumidores pertence à etapa 04. O diagnóstico atual de Team/TeamReports ainda será substituído pela resposta autorizada. Não considerar corrigido em produção somente porque o helper agora existe.

### Timestamps confirmados e lacunas

| Fonte | Disponível | Limitação |
|---|---|---|
| academy_presence | last_access_at | Último registro conhecido, não histórico de login por intervalo |
| academy_engagement_daily/config | day, active_seconds, collected_since | Dias/tempo estimados; sem dados anteriores à coleta |
| academy_progress | updated_at, done, versão | updated_at não é prova imutável de conclusão |
| academy_attempts | submitted_at, nota, snapshot | Filtro do helper usa envio. Não há data de correção confirmada; nome correto é “tentativas corrigidas enviadas no período”, não “corrigidas durante o período” |
| academy_quiz_attempts | completed_at e snapshots nas migrações recentes | Integração gerencial e cobertura legada na etapa 05 |
| academy_xp | created_at e season | Eventos do estado atual são pessoais; leitura da equipe ainda necessária |
| Comunidade | criação de artigo/comentário/reação e eventos de recompensa | Criação/edição não equivalem à primeira publicação; timestamp de reação não cobre reativação; rewards não conta todas as interações |
| Atribuições | created_at e due_date | Estado atual/prioridades confiáveis conforme regras existentes, sem inventar conclusão temporal |

Não foi realizado backfill, registro de novos eventos ou reconstrução de histórico nesta etapa.

## Verificação executada

Em `platform/`:

```text
pnpm exec tsc --noEmit
Resultado: passou.

pnpm exec vitest run src/lib/reports/reports.test.ts src/lib/team-scope.test.ts src/lib/trails.test.ts src/lib/course-activities.test.ts src/lib/learning-rewards.test.ts
Resultado: 5 arquivos passaram; 68 testes passaram.
```

As verificações cobrem contratos, isolamento de equipes, perfis proibidos, pendentes, calendário/fuso/limites, cobertura desconhecida, progresso por pessoa, avaliação pendente, proficiência, pares deduplicados, médias, múltipla escolha e crédito parcial. Também incluem testes existentes de Trilhas, atividades e recompensas, com banco PGlite isolado nas verificações já existentes. Não foi usada base de produção.

Sem alteração visual, não foi executado navegador/E2E nesta etapa. A próxima etapa autorizável é **02 — padrão visual compartilhado**; as rotas analíticas continuam previstas para 04/05.
