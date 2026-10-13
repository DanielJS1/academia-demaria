# Academia DeMaria — plano de reformulação

Data: 12/10/2026. Entrega de planejamento; nenhuma implementação realizada nesta etapa.

## 1. Decisão de produto

**Minha Gestão organiza pessoas e ações. Relatórios concentra análise. Conhecimento organiza consulta e compartilhamento.** As três áreas usam a mesma linguagem visual, mas cada uma responde a uma pergunta diferente:

| Área | Pergunta principal | Resultado esperado |
|---|---|---|
| Conhecimento | Onde encontro uma resposta ou compartilho o que aprendi? | Localizar e abrir conteúdo, identificar sua origem e publicar quando permitido |
| Minha Gestão | Quem precisa da minha atenção e qual ação devo tomar? | Abrir ficha, registrar PDI, conceder conquista, atribuir trilha ou gerir avisos |
| Relatórios | Como minha equipe está participando e evoluindo? | Filtrar, comparar, aprofundar por pessoa e exportar evidências |

Manter as rotas `/conhecimento`, `/equipe` e `/equipe/relatorios`. Relatórios deixa de se apresentar como um assistente de três passos chamado “Gerador de relatórios” e passa a ser uma área analítica diretamente utilizável. O botão persistente “Voltar para minha gestão” é removido. A navegação normal do navegador continua funcionando.

### Base e limites desta análise

Foram lidos o briefing do Desktop, AGENTS.md, platform/AGENTS.md, ARCHITECTURE.md, componentes, contratos, rotas, CSS, testes existentes e migrações relacionadas. Os pedidos dos vídeos utilizam a análise visual e a transcrição realizadas nesta conversa. O código contém alterações locais e arquivos de Trilhas/Discord ainda não versionados; eles fazem parte da base observada e devem ser preservados.

Esta é uma auditoria estática do checkout local. Não foram consultados dados pessoais em produção, executadas migrações, iniciados servidores, alteradas configurações nem validados fluxos no navegador nesta etapa. Uma migração presente no repositório não comprova sua aplicação no banco publicado. Os testes mencionados são verificações a executar pelo SOL, não resultados já obtidos.

A base de UI/UX foi complementada pelas skills UI/UX Pro Max, shadcn e React Best Practices; a leitura dos dados considerou a skill Supabase. O projeto possui configuração shadcn, mas atualmente apenas poucos componentes em `components/ui`; não pressupor que Dialog, Table, Tabs ou Chart já estejam instalados.

## 2. Diagnóstico com evidências

| ID | Constatação no código atual | Consequência e decisão |
|---|---|---|
| D01 | `knowledge.tsx:40–71`: a busca remota de artigos só roda na aba Biblioteca; assistentes são filtrados localmente; materiais são carregados no componente próprio | Implementar busca federada, com adaptadores por fonte e resultados junto ao campo |
| D02 | `knowledge.tsx:129` em diante: Minhas Anotações lista os cadernos sem aplicar o termo pesquisado; `lesson-notepad.tsx:14` lê localStorage por usuário | Incluir pesquisa real por texto da anotação, curso e aula, somente no navegador do usuário |
| D03 | `article-client.ts:6` transforma ausência de token/erro HTTP em lista vazia; Knowledge também ignora rejeições | Separar “nenhum resultado”, “carregando” e “fonte indisponível” |
| D04 | `/api/community/search/route.ts` pesquisa título, conteúdo, produto, categoria e tags dos artigos publicados; atualmente carrega conjuntos de artigos no servidor | Preservar o caso DLL; limitar retorno a resultados e trechos, adicionar paginação e não ampliar indiscriminadamente a carga |
| D05 | `/api/kb` e `lib/kb/server.ts:61` já usam `kb_search`; materiais têm `/api/technical-materials` | Reutilizar fontes existentes; base oficial não precisa ser recriada dentro do fórum |
| D06 | `team.tsx:335`, `:466`, `:1393`: indicadores, análises por curso/avaliação, formulário de reconhecimento e PDI estão na mesma experiência | Migrar análise e preservar gestão operacional, dando destaque às ações |
| D07 | `pilot-server.ts:109` calcula `person.progress` pela proporção de aulas concluídas em todo o catálogo elegível | Não usar essa porcentagem como obrigação, atraso ou progresso de uma atribuição |
| D08 | `team-reports.tsx` rotula progresso de aulas em 100% como “Concluído”; `rewards.ts:7` também exige aprovação nas atividades aplicáveis | Separar “Aulas concluídas” de “Curso concluído”; reutilizar a regra de domínio, incluindo proficiência |
| D09 | `team.tsx:300` chama progresso menor que 30% de “at_risk” | Retirar o rótulo genérico de risco; usar atraso real de atribuição e regras de presença existentes |
| D10 | `team-scope.ts` inclui pendentes e normaliza acentos; a RPC de presença inclui somente ativos e compara departamento com trim/lower | Unificar escopo de gestão. Pendentes ficam fora dos denominadores de atividade e das ações que exigem conta ativa |
| D11 | `pilot-server.ts:123` oculta `questions.correct` para não administradores; Team e TeamReports recalculam acertos comparando esse campo | Contagens/diagnóstico do gestor precisam vir calculados e autorizados pelo servidor; não expor gabaritos como solução |
| D12 | As análises locais não tratam plenamente múltipla escolha nem crédito parcial e podem contar pendências como erros | Usar correção de domínio e estado “Aguardando correção”; preservar nota oficial |
| D13 | `team-reports.tsx`: somente quatro tipos, período apenas 7/30 na presença, média por todas as tentativas e filtros globais por `person.progress` | Criar semântica de período por tema e filtros que realmente incidam sobre o conjunto exibido |
| D14 | `team-report-visual.tsx`: índices de `string[][]`, agrupamento por e-mail/nome, top 8 e barras fixas | Usar registros tipados por IDs; visualizações selecionáveis, ranking explícito e tabela paginada |
| D15 | Relatórios já exporta CSV e usa `window.print()` para PDF; a tela mostra 20 linhas e a impressão todas | Aperfeiçoar o fluxo existente, garantindo igualdade do conjunto filtrado e impressão completa |
| D16 | `academy_engagement_daily` tem agregação diária; `academy_presence` guarda apenas o último acesso; RPC aceita 7/30 | Período personalizado pode reutilizar diários. Último acesso exato de um período histórico não é reconstruível |
| D17 | `academy_xp` tem usuário, valor e data; `state.xpEvents` entrega eventos só do usuário atual | Relatório de XP da equipe exige consulta autorizada própria, não soma do estado pessoal |
| D18 | `academy_quiz_attempts` guarda resultados de Desafios e a migração de 06/10 adiciona snapshots; `/api/quizzes` retorna desafios do próprio usuário | Criar leitura de resultados do time, preservando snapshots e o limite de uma tentativa oficial por edição |
| D19 | Reações guardam `active` e a primeira `created_at`; reativação não atualiza a data. Recompensas deduplicam comentários e têm limites de XP | Recompensas não representam todas as interações. Histórico completo de ativações/remoções exige instrumentação |
| D20 | Trilhas já têm atribuições, prazo, política de inatividade, baixa frequência e função de conclusão por pessoa | Reutilizar esses conceitos; não criar um segundo mecanismo de alertas |
| D21 | `shared.tsx:10` oferece PageHeading; `theme.css:223` e responsive.css alteram títulos; Knowledge tem hero próprio | Criar variante compacta opt-in e verificar a cascata responsiva, sem encolher todas as páginas por um seletor global |

**Não confirmado em produção:** volume/qualidade dos dados, migrações aplicadas, índices e tempos de resposta reais. **Recomendações novas deste plano:** busca federada com fontes explícitas, contratos tipados de relatórios, seis visões analíticas, ficha operacional por URL e instrumentação temporal mínima. São decisões propostas para cumprir os pedidos, não funcionalidades alegadamente vistas nos vídeos.

## 3. Matriz de destino das informações

| Bloco ou ação atual | Destino e tratamento |
|---|---|
| Cabeçalho e busca de Conhecimento | Ficam, compactados e alinhados à esquerda |
| Base oficial: consultar, gerenciar, site público | Fica como área distinguível; consultar na navegação de fontes, gerenciar como ação contextual, site público como link secundário |
| Fórum, assistentes, anotações e materiais | Ficam com nomenclatura curta e busca entre fontes |
| Criar artigo, meus artigos/rascunhos, editar, sugerir, comentar, curtir e hype | Ficam no Fórum e no artigo; não remover fluxos existentes |
| Número de pessoas e contexto do departamento | Resumidos em Minha Gestão, com acesso à lista |
| Média de notas, progresso agregado de catálogo, tempo ativo total, frequência e gráficos comparativos | Migram para Relatórios |
| “Presença e constância” com explicação longa e seletor 7/30 | Migra para Presença em Relatórios; em Gestão fica somente sinal operacional e último acesso |
| Análise por curso e avaliações/diagnóstico de erros | Migra para Aprendizagem em Relatórios antes de ser retirada de Gestão |
| Lista de pessoas | Fica operacional em Gestão; Relatórios possui tabela analítica própria por tema |
| Perfil com muitos indicadores, cursos, avaliações e linha do tempo de aprendizagem | Parte analítica migra para Relatórios individual; dados de identificação e ações ficam na ficha de gestão |
| Conquista/reconhecimento +100 XP e histórico | Ficam em Minha Gestão; efeito em XP é contabilizado em Relatórios |
| PDI e suas anotações | Ficam na ficha de gestão, com as permissões atuais; não exportar texto de PDI em relatórios gerais |
| Trilhas e avisos, atribuições, prazos, políticas e histórico de mensagens | Permanecem em `/equipe/trilhas`; Gestão oferece acessos contextualizados |
| Botão “Gerar relatório” em Gestão | Substituir por acesso secundário “Ver relatórios” |
| Link “Voltar para minha gestão” em Relatórios | Remover; manter menu, voltar do navegador e ação contextual “Gerir colaborador” |
| CSV, PDF e filtros | Permanecem exclusivamente na experiência analítica para esses conjuntos de dados |
| Aprovação/reprovação/exclusão/cadastro de pessoas; correção administrativa de provas | Permanecem em Administração segundo permissões atuais |

## 4. Padrão visual e microcopy

Adotar os tokens existentes (`--ink`, `--muted`, `--surface`, `--line`, `--primary`), Inter, Lucide e os componentes Button, Badge, PageHeading, SectionHeading, EmptyState e Progress. Não trocar biblioteca, identidade ou temas.

| Elemento | Decisão |
|---|---|
| Cabeçalho das telas-alvo | Esquerda, título 28px desktop/24px mobile, peso aproximadamente 700, subtítulo 14–16px; uma frase curta. Eyebrow opcional, sem repetir o título |
| Espaçamento | Escala 4/8/12/16/24/32; 24px entre seções, 16–20px de padding nos cards; 16px em telas estreitas |
| KPI | Rótulo curto de uma ou duas linhas, número 28–32px, uma linha de contexto. Mesma estrutura; no máximo quatro no topo analítico e três em Gestão |
| Texto | Corpo principal 16px; dados densos 14px; metadados secundários 12–13px. Não perpetuar descrições mobile de 10–11px |
| Ações | Uma ação visualmente primária por bloco; texto junto do ícone; alvos interativos de pelo menos 44px nas telas reformuladas |
| Filtros | Rótulos visíveis, defaults úteis, resumo dos aplicados e “Limpar filtros”; avançados recolhidos |
| Tabelas | Cabeçalhos claros, números alinhados, ordenação acessível, 25 linhas por página, ações nomeadas. Em mobile, resumo por pessoa e detalhes expansíveis |
| Estados | Skeleton/carregamento sem número falso; erro com tentar novamente; vazio com orientação; dados parciais identificados |
| Acessibilidade | Contraste mínimo de referência 4,5:1 para texto comum, foco visível, navegação por teclado, zoom 200%, sem dependência exclusiva de cor/hover; validar, não declarar conformidade sem teste |

Criar uma variante compacta opt-in em PageHeading e um arquivo temático `page-layout.css` apenas se for a melhor forma de isolar as novas regras; globals.css pode receber somente o import. Para componentes faltantes, consultar o catálogo shadcn antes de instalar o mínimo necessário; não importar um preset nem reestilizar componentes globais indiscriminadamente.

Textos propostos: “Conhecimento”, “Minha gestão”, “Relatórios”, “Aprender”, “Minhas trilhas”, “Desafios”, “Minha evolução”. Frases atuais como “Encontre seu próximo passo” e “Toda evolução conta” podem virar subtítulos curtos. KPIs: “Equipe”, “Com atrasos”, “Precisam de contato”, “Com acesso”, “Tempo ativo”, “Nota média”, “XP no período”. “Tempo ativo” sempre tem contexto visível “estimado”.

## 5. Wireframes e fluxos

### Conhecimento — sem pesquisa

```text
Conhecimento                              [Criar artigo — contexto Fórum]
Encontre respostas e compartilhe experiências.
[Buscar no conhecimento..............................................]
[Fórum] [Base oficial] [Assistentes] [Minhas anotações] [Materiais]

Título da área ativa                   ações específicas dessa área
Filtros da área                         contagem com significado claro
Conteúdo principal
```

Manter Fórum como área inicial para preservar o comportamento atual. A Base oficial abre sua consulta existente; gerenciar abre `/conhecimento/oficial`. Não embutir o editor editorial em Conhecimento. Nas fontes internas, respeitar público interno/cliente. Clientes continuam com os acessos permitidos e não recebem resultados de fórum/materiais internos.

### Conhecimento — pesquisa ativa

```text
Conhecimento
[DLL.......................................................][Limpar]
Resultados para “DLL”                 N resultados / N+ se parcial
[Todos] [Fórum (n)] [Base oficial (n)] [Assistentes (n)] [...]

[Fórum] Corrigir falha na DLL
Trecho do conteúdo com DLL em destaque — Produto — [Abrir artigo]
[Base oficial] Instalação e dependências
Trecho relevante ou resumo identificado — [Consultar]
[Minhas anotações] Aula de instalação
Trecho da minha anotação — Curso — [Abrir aula]
```

Com dois ou mais caracteres, entrar no estado de resultados; um caractere mostra “Digite pelo menos 2 caracteres”. Debounce de 250ms, cancelamento de requisição antiga e estados por fonte. Não mostrar hero, card institucional e introdução do fórum entre campo e resultados.

Pesquisar Fórum pelo conteúdo completo já suportado; Base oficial pela `kb_search`; Assistentes por metadados do catálogo local; Materiais por título, descrição e assunto; Anotações por texto/curso/aula em localStorage do usuário. **PDFs e vídeos não possuem conteúdo interno indexado confirmado**: não prometer pesquisa dentro deles. Anotações devem ser identificadas como “Neste navegador”.

Todos apresenta grupos pequenos por fonte e “Ver mais” com paginação da fonte; não criar ranking artificial misturando relevâncias incomparáveis. Ao selecionar uma fonte, aplicar seu filtro e paginação. Preservar `aba`/`busca` existentes, acrescentando `tipo`/`pagina` conforme necessário. Limpar retorna à área anterior; voltar restaura termo e contexto. A busca global mantém seus escopos, mas seus links precisam transportar o termo e usar a mesma nomenclatura — inclusive notas.

### Minha Gestão

```text
Minha gestão                           [Trilhas e avisos] [Ver relatórios]
Pessoas e ações para acompanhar sua equipe.
Departamento: Suporte · colaboradores sob sua gestão

[Equipe: 19]        [Com atrasos: 3]        [Precisam de contato: 2]

Colaboradores                          [Buscar nome ou e-mail]
[Departamento, quando útil] [Todos | Com atraso | Sem acesso | Pendentes]
Pessoa / Setor     Situação de acompanhamento     Último acesso     Ação
Ana / Suporte      1 trilha atrasada              12/10 09:12       [Gerir]
Bruno / Suporte    Sem registro                   —                [Gerir]
```

Os números acima são ilustrativos, nunca valores a colocar no aplicativo. “Equipe” considera ativos por padrão; pendentes têm uma visão operacional identificada e não entram nas métricas de participação. “Com atrasos” conta pessoas únicas com pelo menos uma atribuição ativa incompleta cujo prazo terminou. “Precisam de contato” reutiliza a política de inatividade/baixa frequência de Trilhas, com cobertura suficiente; não usa progresso <30%. Os dois grupos podem se sobrepor, por isso não somar seus cards como um total.

### Ficha operacional

```text
Ana Silva · Suporte · Conta ativa                         [Fechar]
[Acompanhamento] [Conquistas] [Trilhas]

Acompanhamento: resumo de pendências + histórico de PDI
[Registrar acompanhamento]
Conquistas: histórico + [Conceder conquista]
Trilhas: atribuições, prazo, situação + [Gerir trilhas]

[Ver relatórios desta pessoa]
```

Usar diálogo/painel acessível, com título, foco contido, Escape, retorno de foco e formulário com rótulos. Reconhecimento tem título, justificativa e impacto explícito **+100 XP**, com o requestId idempotente atual. Não adicionar alteração de quantidade de XP. PDI permanece visível somente a quem já tem permissão. Links propostos: `/equipe?pessoa=<id>&acao=pdi|conquista|trilhas`; validar ID e permissão antes de abrir, e ampliar `/equipe/trilhas` para aceitar contexto de pessoa sem mudar a autorização.

### Relatórios da equipe

```text
Relatórios                                   [Baixar CSV] [Salvar em PDF]
Entenda a participação e a evolução da equipe.
[Visão geral] [Presença] [Aprendizagem] [Desafios] [Comunidade] [XP]

[Últimos 30 dias v] [Departamento v] [Colaborador v] [Mais filtros]
Filtros aplicados... [Limpar filtros]          Atualizado em ...

Até quatro KPIs do tema
Indicador: [Dias com acesso v]       Exibir: [Tabela] [Barras] [Rosca*]
Visualização + valores + legenda + cobertura dos dados

Detalhes por colaborador   [Busca] [Ordenação] [Colunas, se necessário]
Tabela analítica paginada                                   [Ver detalhes]
```

O asterisco significa que Rosca aparece somente para composição válida. Na primeira visita, abrir Visão geral, últimos 30 dias e equipe ativa autorizada. Preservar escolhas na URL. Departamento único vira texto contextual, sem filtro redundante.

Visão geral mostra quatro KPIs de eventos do período: pessoas com acesso, avaliações corrigidas (tentativas), participações em desafios e XP registrado no período. Abaixo, no máximo dois módulos visuais: presença diária no período e situação **atual** das atribuições, esta última explicitamente separada do intervalo. Os temas detalhados apresentam suas métricas específicas.

Aprendizagem possui “Situação atual” e “Atividade no período”. Em Situação atual, desabilitar o controle de período com explicação curta; não fingir que a data filtra progresso acumulado. Em Atividade no período, o intervalo vale para eventos com data confiável. Cursos e avaliações são subvisões desse tema, com acesso ao diagnóstico hoje disponível em Team.

### Relatório individual

Ao abrir uma pessoa, manter a mesma página e filtros; o filtro Colaborador e o cabeçalho identificam a seleção. Mostrar visão temática da pessoa, cursos/avaliações/participações e séries existentes. “Todos os colaboradores” limpa somente pessoa. “Gerir colaborador” abre sua ficha operacional. Remover o vínculo visual obrigatório com Minha Gestão, mas manter transições contextuais úteis.

URL proposta: `/equipe/relatorios?visao=presenca&pessoa=<id>&inicio=2026-10-01&fim=2026-10-12&formato=barras`. Também suportar departamento/curso/desafio/status e subvisão conforme contrato; parâmetros inválidos não ampliam o escopo.

### Ajustes pontuais nas outras telas

| Tela | Composição final |
|---|---|
| Aprender | Cabeçalho compacto à esquerda, quantidade de cursos como resumo à direita; integrar ou remover por redundância o banner “Uma jornada...” após incorporar seu contexto; retirar livro decorativo isolado. Filtros e catálogo sobem |
| Minhas Trilhas | Aplicar o mesmo cabeçalho compacto; preservar cards, prazos, conexão Discord e comportamento |
| Desafios | Preferência de avisos como bloco compacto junto ao topo, com estado e botão; descrição detalhada só quando necessária. Preserve habilitar/cancelar e mensagens de falha |
| Minha Evolução | Cabeçalho e perfil em duas colunas no desktop com espaço; perfil mostra identidade, ações de foto/senha e informações essenciais. Reduzir repetição de XP/nível entre perfil e card de evolução. Empilhar em telas estreitas |

O pedido de reduzir “pela metade” é uma direção visual: buscar redução aproximada da área excedente nas mesmas dimensões de tela dos vídeos, sem impor 50% de largura ou fonte a todos os dispositivos.

## 6. Contrato de dados e definições

### População e tempo

Consultas de gestão devem usar o usuário autenticado no servidor. População padrão: internos ativos, exceto o próprio gestor; administrador vê essa população geral, gestor vê subordinados diretos ou pessoas sem manager_id no mesmo departamento não vazio. Não adicionar subordinados indiretos por inferência. Padronizar trim e comparação sem distinção de caixa segundo a regra atual do servidor; não colapsar departamentos diferentes por remoção arbitrária de acentos.

Pendentes têm lista operacional específica e ações limitadas; inativos não entram na população padrão. Não alterar os rankings públicos de Minha Evolução como efeito colateral desse escopo. O departamento dos relatórios é o cadastro **atual**, não a lotação histórica — não há histórico de movimentações confirmado.

Datas em `America/Sao_Paulo`; intervalos de calendário inclusivos na UI e consulta `>= início`, `< início do dia seguinte ao fim`. 7/30 dias incluem hoje. Personalizado: no máximo 366 dias por consulta, sem datas futuras. Comparação opcional com intervalo anterior do mesmo tamanho somente com cobertura suficiente, mesma população atual e mesma definição. Se anterior for zero, mostrar diferença absoluta, sem percentual infinito.

### Dicionário de métricas

| Métrica | Fonte e fórmula | Recorte e limites |
|---|---|---|
| Equipe | Perfis únicos autorizados e ativos | Estado atual; pendentes separados |
| Último acesso | `academy_presence.last_access_at` | Último registro conhecido, independentemente do período. Não é histórico de login nem último acesso dentro de intervalo antigo |
| Dias com acesso | Contar dias distintos em `academy_engagement_daily` no intervalo | Dia com registro pode ter zero segundos; não exigir minutos >0 para contar acesso |
| Frequência | Dias com acesso / dias observáveis | Dias observáveis a partir de max(início, início da coleta, criação do perfil); dias corridos, sem supor calendário de trabalho. Conta criada não comprova data de aprovação; explicar cobertura limitada |
| Tempo ativo estimado | Soma de `active_seconds` / 60 para minutos | Plataforma em foco/visível, pausa após inatividade; sem XP e sem comprovar dedicação exclusiva ao estudo |
| Aulas concluídas (%) | Aulas não quiz concluídas / aulas não quiz elegíveis da versão corrente | Estado atual por pessoa/curso; sem aulas elegíveis, percentual não aplicável. Reaproveitar regra validada para proficiência |
| Curso concluído | Regra de `isCourseComplete`, com estado da pessoa correta e avaliações exigidas | Não inferir só de 100% das aulas. Não usar `state.completed` do gestor ao calcular um subordinado |
| Taxa de conclusão atribuída | Pares pessoa/curso concluídos / pares elegíveis atribuídos, deduplicados entre trilhas ativas | Estado atual. Cursos livres aparecem em visão separada “Catálogo”, sem serem obrigação. Sem atribuição = “Sem cursos atribuídos”, não zero |
| Atraso | Atribuição ativa + incompleta + dueDate anterior ao dia atual | Contar atribuições e pessoas em indicadores distintos; reaproveitar `deadlineKind` |
| Conclusões no período | Eventos de conclusão com data confiável | Não usar `academy_progress.updated_at` como data de conclusão. Instrumentação prospectiva se não houver evento canônico auditável; marcar cobertura |
| Nota | `academy_attempts.score` e snapshot | Padrão: última tentativa corrigida por pessoa/atividade/versão dentro do recorte; alternativas: melhor ou todas, sempre rotuladas. Média da equipe = média das médias individuais com nota; informar n válido |
| Correção pendente | Tentativa sem nota/status pendente | Não contar como nota 0, reprovação ou todas as questões erradas. Objetivas/múltipla escolha e parciais calculadas no servidor |
| Participações em desafios | Contar `academy_quiz_attempts` por completed_at | Uma tentativa oficial por edição; preservar snapshots e indicar legado sem revisão disponível |
| Pontuação em desafios | score_percentage da tentativa; média em % | Não comparar acertos brutos entre quizzes com números diferentes de questões; mostrar n de participações |
| Taxa de participação em desafios | Participantes / público elegível comprovado para a edição | Hoje há target_audience, mas não há snapshot de elegibilidade departamental confirmado. Usar contagem como padrão; não chamar disponibilidade de obrigação |
| Artigos publicados | Primeira publicação por artigo/autor; distintos | Meta.created_at é criação, updatedAt é edição. Evento publish em rewards pode comprovar data para parte do legado, inclusive amount=0; marcar origem/cobertura. Coautoria não duplica publicação |
| Comentários realizados/recebidos | IDs distintos de comentários por created_at, agrupados por ator/autor do artigo | Separar direção; recebidos de outras pessoas para avaliar repercussão. Recompensas de comentário não contam todos os comentários |
| Curtidas/hypes realizados/recebidos | Estado atual em reactions; eventos de ativação no período após instrumentação | Timestamp atual é da primeira reação, não da reativação. Não projetar o estado atual como histórico completo |
| XP do período | Soma de `academy_xp.amount` por pessoa e created_at | Consulta própria do time. Preservar estornos/regras existentes; não recalcular XP pelo volume de interações |
| XP da temporada | Soma por season | Estado da temporada; não rotular como XP do período |
| XP acumulado | Soma do histórico disponível | Identificar cobertura/importações; sem promessa de histórico anterior |

Tempo comprovado de estudo por aula não integra esta entrega. A necessidade será atendida com tempo ativo **estimado**, corretamente rotulado. Uma futura instrumentação por aula requer especificação própria; não extrapolar duração nominal das aulas assistidas.

### Lacunas que exigem trabalho

1. Criar contratos Zod em módulos próprios de relatórios e um serviço de leitura autenticado, mantendo os comandos de escrita atuais. Não inchar AcademyProvider com corpos de artigo, eventos de toda a empresa ou gabaritos.
2. Reaproveitar diários de presença para intervalo personalizado. Preservar a RPC atual de 7/30 durante a transição; criar uma leitura por intervalo validado ou extensão compatível.
3. Adicionar consulta do time para XP, desafios e comunidade. Consultar apenas IDs autorizados, campos necessários e intervalos relevantes; paginar as leituras do banco para não truncar em 1.000 registros.
4. Calcular acertos/erros/pendentes/parciais no servidor usando snapshots e regras de domínio. Retornar diagnóstico sanitizado, sem gabarito completo ao gestor.
5. Para comunidade, registrar eventos mínimos de primeira publicação e transição real de reação dentro da mesma transação. Não gerar evento em retry sem mudança de estado. Não alterar regras de XP. Contagem de reações no período deve deduplicar ator/artigo/tipo para evitar inflar números com alternâncias; informar que remoções posteriores não reescrevem o evento histórico de participação. Saldo ativo atual é outra métrica.
6. Para conclusões temporais, se o inventário não encontrar prova canônica suficiente, criar evento idempotente pessoa/curso/versão ao cruzar de incompleto para completo. Inclui aprovação tardia e proficiência; registros existentes são baseline atual com data desconhecida, não “concluídos na migração”. Não mudar conclusão nem conceder XP ao registrar telemetria.
7. Toda métrica responde com disponibilidade (`available`, `partial`, `unavailable`), intervalo/cobertura e semântica. Valor nulo não vira zero. Falha de fonte é diferente de ausência de atividade; métricas dependentes ficam indisponíveis, demais fontes continuam identificadas.

A camada atual usa service_role no servidor. Essa credencial exige filtragem/autorização explícita antes de devolver dados; não presumir proteção automática pela RLS. Manter tabelas/funções não expostas a anon/authenticated quando essa for a arquitetura atual. [Referência Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Contrato proposto de apresentação

`ReportQuery`: visão/subvisão, datas, pessoa, departamento, curso/desafio, situação, escopo atribuído/catálogo, política de tentativas e ordenação. Formato do gráfico não muda a consulta nem os valores.

`ReportDataset`: metadados de escopo, período, generatedAt, coverage por métrica, registros tipados com IDs, KPIs e séries derivados da mesma base filtrada. Não usar arrays de strings como contrato interno. Strings/localização pertencem à apresentação e exportação.

Para o porte atual, carregar uma consulta completa validada por tema e paginar a tabela no cliente; limites explícitos de volume precisam rejeitar a consulta com orientação para refinar, nunca truncar silenciosamente. Um limite inicial de 10.000 linhas é uma guarda de implementação, a revisar com evidência de desempenho. Gráficos, CSV e PDF usam o mesmo dataset carregado e a mesma data de geração. Assim não é necessário introduzir um serviço de snapshots remoto nesta reforma.

## 7. Matriz de visualizações

| Pergunta/métrica | Tabela | Barras | Pizza/rosca |
|---|---|---|---|
| Quando cada pessoa acessou? | Principal, data/hora | Não para timestamp bruto | Não |
| Quantos dias/minutos por pessoa? | Valores completos | Horizontal, comparar a mesma unidade | Não; frequência e tempo não são categorias de um total |
| Quantas pessoas acessaram por dia? | Data + quantidade | Colunas temporais ou linha | Não |
| Como estão os cursos atribuídos? | Pessoa/curso/status | Barras de quantidade por status | Sim: pares pessoa/curso em estados exclusivos |
| Quanto falta em um curso de uma pessoa? | Aulas feitas/total + avaliação | Progresso compacto | Sim: aulas concluídas/restantes; não significa aprovação final |
| Quem tem maior progresso? | Ranking com contexto | Horizontal 0–100% | Não somar percentuais de pessoas |
| Como estão as notas? | Pessoa/atividade/tentativa | Por pessoa, escala 0–100 e n de notas | Não para médias; possível somente composição de resultados categóricos definida |
| Como foi cada desafio? | Participação, nota, edição | Notas por pessoa ou participações por edição | Somente aprovados/reprovados entre participantes avaliados; não inventar ausentes |
| Quem compartilha e recebe interações? | Colunas por tipo/direção | Comparação na mesma unidade | Evitar misturar publicações, hypes e comentários como “engajamento” sem significado |
| Quem ganhou XP? | Principal para ranking completo | Horizontal por pessoa | Não como formato padrão de ranking |

Estados exclusivos de curso para rosca: não iniciado, em andamento, aulas concluídas com avaliação pendente/não aprovada, concluído. “Atrasado” é dimensão de prazo que pode coexistir com andamento; não acrescentá-lo como fatia sobreposta. Ausência de atribuição não entra no total de matrículas/pares.

Barras começam em zero; percentuais usam 0–100; rótulos e valores permanecem disponíveis sem hover. Gráfico mostra até 12 pessoas com aviso e acesso ao conjunto completo; troca de top maiores/menores é explícita. Rankings usam IDs e desempate determinístico, sem misturar números e nomes em um identificador. Toda visualização tem resumo textual e tabela equivalente.

## 8. Benchmark aplicado

| Fonte oficial consultada | Padrão observado | Aplicação na DeMaria |
|---|---|---|
| [Absorb — Manager Experience](https://support.absorblms.com/hc/en-us/articles/13133210919699-Manager-Experience) | Visão resumida do time, escopo gerencial e widgets que abrem listagem filtrada | Cards operacionais clicáveis em Minha Gestão; contexto acompanha o detalhamento |
| [Docebo — Reports for managers](https://help.docebo.com/hc/en-us/articles/4411987588242-Reports-for-managers) | Relatórios por assunto, filtros conforme o relatório e exportação; informação explícita sobre atualização | Visões temáticas, filtros pertinentes e generatedAt/cobertura visíveis. Não copiar a atualização noturna: o sistema DeMaria deve mostrar a sua própria atualização |
| [Cornerstone — Analytics and reporting](https://www.cornerstoneondemand.com/solutions/analytics-and-reporting/) | Dashboards visuais e relatórios predefinidos para líderes | Oferecer visões prontas antes de configurações avançadas |
| [Cornerstone — Measuring what matters](https://www.cornerstoneondemand.com/resources/article/measuring-what-matters-getting-started-reporting-analytics/) | Métricas precisam responder à finalidade e ao nível organizacional | Distinguir acompanhamento, aprendizagem e reconhecimento; não tratar tempo/XP isolados como qualidade profissional |

As escolhas de tabela/barras/rosca são recomendações analíticas deste plano, não alegações de que os três fornecedores recomendam exatamente essa matriz. O guia técnico detalhado de Reporting 2.0 da Cornerstone não ficou acessível nesta consulta; não foram assumidos recursos específicos a partir dele.

## 9. Sequência de execução e dependências

| Etapa | Entrega | Depende de | Critério de passagem |
|---|---|---|---|
| 01 | Contratos, escopo e cálculos canônicos | Base atual | Testes de autorização, conclusão, nota e datas; decisões documentadas |
| 02 | Componentes/padrão visual compacto | 01 como referência | Primitivos reutilizáveis e apresentação consistente, opt-in |
| 03 | Conhecimento e busca federada | 02 | DLL, notas privadas, cinco fontes, erro parcial e navegação funcionando |
| 04 | Leituras de presença e aprendizagem | 01 | Dados tipados, período personalizado e diagnóstico correto do gestor |
| 05 | Leituras de desafios/comunidade/XP e lacunas temporais | 01 e 04 | Fontes integradas, história honesta e telemetria idempotente quando necessária |
| 06 | Relatórios completos, gráficos e análise individual | 02, 04, 05 | Todas as análises antigas acessíveis no novo destino, filtros coerentes |
| 07 | CSV e PDF consistentes | 06 | Exportações iguais ao dataset filtrado, completas e legíveis |
| 08 | Minha Gestão operacional e ficha | 06, 07 | Remover duplicação somente após equivalência; conquista/PDI/trilhas preservados |
| 09 | Compactação das quatro telas secundárias | 02 | Pedidos pontuais atendidos sem regressão funcional |
| 10 | Validação integrada e fechamento | 03–09 | Fluxos por papel, dados, temas, responsividade e regressões verificados |

A ordem é sequencial por padrão. Conhecimento e ajustes secundários são independentes do backend analítico, mas a lista acima evita execução simultânea conflitante no mesmo checkout. Não excluir a análise antiga antes de seu substituto passar nos critérios de aceite.

## 10. Rastreabilidade e validação final

| Pedido | Origem | Etapas |
|---|---|---|
| Conhecimento intuitivo, busca DLL visível e acessos coesos | Vídeo 193411, 00:00–01:14 | 02, 03, 10 |
| Separar gestão de análise e reduzir excesso de cards | Vídeo 193809, 00:00–01:03; briefing | 01, 04–08 |
| Aprender: compactar banner e retirar livro isolado | Vídeo 193809, 01:03–01:30 | 02, 09 |
| Minhas Trilhas: reduzir título, manter organização | Vídeo 193809, 01:30–01:45 | 02, 09 |
| Desafios: aviso menor e mais alto | Vídeo 193809, 01:45–02:09 | 09 |
| Minha Evolução: compactar topo e perfil lado a lado | Vídeo 193809, 02:09–02:36 | 09 |
| Clareza para gestores e referência Trilhas e avisos | Vídeo 193809, 02:36–03:01 | 02, 06, 08, 10 |
| Remover retorno persistente de Relatórios | Vídeo 193809, 03:01–03:22 | 06 |
| Tabela, barras, pizza e filtros intuitivos | Vídeo 193809, 03:22–fim | 06, 07 |
| Presença, notas, desafios, comunidade, XP e ranking | Complemento textual | 01, 04–07 |
| Conquistas e colaboradores em Minha Gestão | Complemento textual | 08 |
| Plano e prompts prontos para o SOL | Ambos os vídeos e pedido atual | Este pacote, prompts 01–10 |

Verificações críticas: gestor de um departamento não consulta/exporta outro por alteração de URL; pessoa pendente não vira “inativa”; curso com aulas concluídas e prova pendente não vira “concluído”; múltipla escolha em ordem diferente tem correção correta; texto parcial não vira erro total; dataset com >20 linhas e consulta de banco com >1.000 registros não perde dados; período atravessando meia-noite usa Brasília; ausência de fonte não vira zero; alternar/repetir reação não infla contagens ou XP; conquista repetida com o mesmo requestId concede XP uma vez; anotação local de outro usuário não aparece; CSV protege células interpretáveis como fórmula; impressão não quebra certificados existentes.

Validação visual em 1440px, 1024px, 768px e 390px, temas claro/escuro e zoom 200%. Percursos de teclado incluem busca, filtros, troca de gráfico, paginação, abertura/fechamento de ficha e submissão de formulários. Em mobile, a página não deve rolar horizontalmente; uma tabela detalhada excepcional pode ter região rolável identificada, com alternativa resumida.

Não há decisão do proprietário bloqueando o início: este plano recomenda tempo estimado, equipe atual, última tentativa corrigida como padrão, fórum como entrada de Conhecimento e PDF por impressão. Mudanças futuras de regra de premiação, hierarquia de gestores, tempo por aula ou histórico de lotação devem ser tratadas como novos requisitos.

Os dez prompts estão em arquivos numerados nesta pasta. Eles são copiáveis individualmente e referenciam este plano para detalhes, incluindo contexto próprio suficiente para a execução da etapa.
