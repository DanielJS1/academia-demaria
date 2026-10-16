# Etapa 04 — Dados de presença e aprendizagem

Concluída em 12/10/2026. Executado somente `04-dados-presenca-aprendizagem.md`; etapas 05–10 permanecem pendentes.

## Entrega

Novo serviço `readReport` e endpoint **GET `/api/reports?query=<JSON codificado na URL>`**. `query` segue `reportQuerySchema`. A resposta segue `reportDatasetSchema`, com população autorizada, cobertura, linhas, KPIs e séries provenientes da mesma base carregada.

Exemplos dos objetos enviados no parâmetro `query`:

```json
{"view":"presence","period":{"kind":"last7"}}
```

```json
{"view":"presence","period":{"kind":"custom","startDate":"2026-10-01","endDate":"2026-10-10"}}
```

```json
{"view":"learning","learningMode":"current","learningDetail":"courses","learningScope":"assigned"}
```

```json
{"view":"learning","learningDetail":"assessments","period":{"kind":"last30"},"attemptPolicy":"latest"}
```

Enviar o Bearer da sessão. Filtros opcionais incluem `personId`, `department`, `courseId`, `status` e ordenação por ID de métrica. A API aceita um único parâmetro `query`, limitado a 4.096 caracteres; parâmetros extras/duplicados são rejeitados.

## Autorização e leitura

- Autenticação confere o usuário e perfil persistido. Nova opção `createMissingProfile: false` impede criação automática de perfil neste serviço; comportamento padrão dos consumidores existentes preservado. Falha ao ler perfil não gera cadastro.
- Somente admin/manager internos e ativos. População somente ativa, interna, excluindo o próprio gestor. Regras da etapa 01 preservadas: subordinação direta ou departamento trim/lower quando não há gestor explícito; sem equivalência automática de acentos.
- Identidades autorizadas são resolvidas antes das fontes analíticas. Pessoa/departamento fora do conjunto é rejeitado. Consultas de progresso, atribuições, tentativas e presença recebem os IDs autorizados; e-mails não integram nem a consulta de população nem o DTO.
- Sem `readAcademy`, `trailContext`, geração de avisos ou comandos de escrita. O service role permanece no servidor e não substitui a autorização.
- Respostas de sucesso e erro usam `Cache-Control: private, no-store` e `Vary: Authorization`.

## Presença

- Intervalos 7/30/customizado, de 1 a 366 dias, em `America/Sao_Paulo`. Datas futuras e intervalos inválidos rejeitados.
- Dias com acesso contam registros diários, inclusive com zero segundos. Minutos são soma dos segundos / 60, marcados `estimated: true`.
- `lastAccessAt` é o último registro conhecido de `academy_presence`, independentemente do período.
- `collectedSince` aparece nos metadados e linhas. Cobertura individual considera início do intervalo, da coleta e criação do perfil. Datas anteriores à coleta/criação não viram faltas; início desconhecido ou período inteiramente anterior produz métricas nulas, com motivo.
- Frequência individual usa dias observáveis; consolidado usa dias com acesso / dias-pessoa observáveis. Série diária sem população observável retorna `null`, não zero. Criação não comprova aprovação, e o dia atual pode estar em andamento.
- API/RPC antiga, heartbeat e XP preservados.

## Aprendizagem

- Cursos: padrão `current` / `assigned`. Pares pessoa/curso/versão deduplicados nas atribuições ativas. Catálogo é uma opção explicitamente distinta. Sem atribuições, contagem zero e taxa nula; nenhuma obrigação é inventada.
- Progresso utiliza aulas não quiz da versão corrente e estado da pessoa correta. Conclusão utiliza `isCourseComplete`, preservando provas e proficiência. 100% de aulas com prova pendente aparece `awaiting_assessment`.
- Atrasos exigem atribuição ativa, incompleta e prazo anterior ao dia atual. Contagens de atribuições e pessoas são distintas. Catálogo não produz contagem de atraso; a métrica é não aplicável e retorna nula.
- Avaliações: padrão `activity` / `catalog` / `latest`; alternativas `best` e `all`. `current` pode ser solicitado explicitamente para consulta sem intervalo. O período recorta **`submitted_at`**; notas/estado/feedback refletem a correção atualmente registrada, não um histórico de quando cada correção ocorreu.
- Seleção corrigida por pessoa/atividade/versão; pendentes permanecem registros separados e não substituem a última nota corrigida nem entram na média. Média da equipe é média das médias individuais válidas; número de pessoas e tentativas acompanham o indicador.
- Linhas de avaliação incluem curso, versão, atividade, data de envio, estado, feedback, nota oficial e diagnóstico. Gabarito, respostas, enunciados e snapshot bruto não são serializados. Comparação objetiva/múltipla escolha e crédito parcial usam os helpers de domínio no servidor.
- Em `activity` / `courses`, progresso e situação continuam marcados como **atuais**. `period_completions` retorna nulo/indisponível: `updated_at` é mutável e XP de conclusão não identifica versão nem garante evento novo por conclusão. Instrumentação temporal permanece na etapa 05.

## Paginação e limites

Leituras ordenadas em lotes de 500, IDs em grupos de 100. Limites de 10.000 pessoas/linhas retornadas e 200.000 registros de origem por domínio; exceder retorna HTTP 422 com orientação de refinamento. Não há truncamento silencioso. `meta.complete: true` indica retorno sem corte; disponibilidade de cada métrica continua declarada em `coverage`.

Agrupamentos por pessoa e cache restrito à execução evitam percorrer repetidamente todo o conjunto para cada curso. Não há cache compartilhado de resultados gerenciais. A paginação usa `range` ordenado; limites explícitos restringem seu custo. Indexação e performance no banco publicado não foram aferidas.

## Arquivos

- `platform/src/app/api/reports/route.ts`: entrada GET, validação e erros privados.
- `platform/src/lib/reports/server.ts`: autenticação, normalização, orquestração e contrato de saída.
- `platform/src/lib/reports/{read.server,presence.server,learning.server}.ts`: escopo/leitura paginada e domínios.
- `platform/src/lib/reports/contracts.ts`: campos opcionais de coleta, curso, atribuições e avaliação; contratos anteriores preservados.
- `platform/src/lib/pilot-server.ts`: opção de autenticação sem cadastro e falha de leitura tratada.
- `platform/src/lib/reports/{server,authentication}.test.ts`: SQL isolado, rota e autenticação real com cliente simulado.

## Verificação

- `pnpm exec tsc --noEmit`: aprovado.
- **87 testes em oito arquivos aprovados**: relatórios, presença, escopo, pilot-server, trilhas e cadastro. Após a revisão final das consultas, os **34 testes de relatórios** foram executados novamente e passaram.
- PostgreSQL isolado via PGlite executou as consultas do serviço através de adaptador de leitura. Fixtures verificaram adulteração de pessoa/departamento, admin/manager/student/client/pendente/inativo, ausência de dados de outras equipes, meia-noite, 7/30/customizado, coleta parcial e zero versus indisponível.
- Aprendizagem verificada com duas trilhas para um curso, prova pendente após 100% de aulas, versões, avaliação legada, proficiência, múltipla escolha, crédito parcial, pendentes, políticas de tentativas e médias individuais.
- Teste de 1.005 tentativas confirmou páginas 0/500/1.000; 10.005 tentativas confirmou rejeição por excesso de linhas. Erros de fonte não viraram zero e headers foram verificados em sucesso/erro.
- Testes existentes de presença/trilhas executam suas migrações/RPCs em bancos isolados e passaram, preservando compatibilidade.
- Nenhuma alteração de interface nesta etapa. Nenhuma análise removida de Minha Gestão.

## Limites e continuidade

Não foi necessária nova migração. O serviço depende das tabelas e migrações existentes de perfis, aprendizagem, presença e atribuições (`20261009213438_learning_trails_and_alerts.sql` inclusive). A instalação dessas migrações no banco publicado não foi verificada nem alterada; fonte ausente retorna erro explícito.

Visões `overview`, `challenges`, `community` e `xp` retornam 422 nesta etapa, em vez de dados fictícios. A etapa 05 deve integrar essas fontes e instrumentar conclusões/eventos conforme o planejamento, reutilizando autorização e cobertura desta entrega. Interface e exportações permanecem nas etapas 06–07.

Sem deploy, push ou acesso a dados de produção. Alterações locais preexistentes preservadas.
