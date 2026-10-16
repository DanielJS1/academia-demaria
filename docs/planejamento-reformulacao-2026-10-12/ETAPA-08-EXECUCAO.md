# Etapa 08 — Minha Gestão e ficha operacional

Concluída em 13/10/2026, seguindo `08-minha-gestao.md`. Implementação local, sem deploy, push ou aplicação de migração ao banco publicado.

## Entrega

- Cabeçalho compacto “Minha gestão”, ação principal “Trilhas e avisos” e acesso secundário “Ver relatórios”. Escopo resumido no cabeçalho, sem banner analítico.
- Três cards acionáveis: Equipe, Com atrasos e Precisam de contato. Contagem por pessoas, sem somar categorias sobrepostas. Ativos por padrão; pendentes separados e com ação de gestão desativada.
- Atraso usa atribuição ativa, incompleta e com prazo passado, reaproveitando o resultado oficial das trilhas. Atribuições concluídas/canceladas e prazo de hoje não produzem atraso; duas atribuições atrasadas de uma pessoa continuam contando uma pessoa.
- Contato usa a política existente de inatividade/baixa frequência e dados autenticados de presença. Não usa progresso <30%. Exige dias observáveis suficientes para a regra; um período maior parcialmente coletado pode ser usado quando seu trecho observado cobre o limiar. Sem último acesso verificável não se inventa inatividade. Falha, coleta curta e dados desconhecidos ficam identificados, sem virar zero confirmado.
- Busca por nome/e-mail, departamento quando há mais de um, filtros operacionais, paginação de 25 pessoas e lista com identificação, acompanhamento, último acesso conhecido e “Gerir”. Em contêineres menores, os registros viram blocos com a ação ao lado do nome, sem rolagem horizontal.
- Ficha modular com Acompanhamento/PDI, Conquistas e Trilhas. Diálogo nativo com foco contido, Escape, retorno ao acionador e bloqueio de rolagem do fundo. Identificação e históricos separados dos formulários.
- PDI mantém o comando e a visibilidade atuais de gestores autorizados/administradores. Não ganhou botão de enviar mensagem.
- Conquista conserva título, justificativa, recompensa fixa de +100 XP e `requestId`. Clique concorrente é bloqueado; repetição após falha mantém o mesmo identificador até sucesso ou alteração dos dados. Campos ficam bloqueados durante gravação.
- Trilhas reaproveita a gestão/atribuições e o editor existentes. A ficha mostra somente as atribuições do colaborador selecionado, incluindo histórico cancelado, e encaminha para a atribuição exata. Não duplica editor, serviço de alertas ou política.
- URLs `/equipe?pessoa=...&acao=pdi|conquista|trilhas`, com `atribuicao` opcional. Escopo é validado antes de abrir a ficha; inexistentes, inativos, pendentes e pessoas fora da equipe são recusados. Aba/colaborador/atribuição também são validados no destino de trilhas.
- Relatórios encaminha a ficha com retorno validado ao mesmo colaborador. Período, formato e demais filtros são preservados no caminho Relatórios → ficha → atribuição → ficha → Relatórios. Retornos externos ou incompatíveis viram link interno ao relatório da pessoa autorizada.
- Aprovação, exclusão, cadastro, mudança de papéis e correções administrativas continuam nos destinos anteriores. Nenhum desses comandos foi adicionado à ficha.

## Destino das análises anteriores

| Conteúdo anterior | Destino conferido / ajuste |
|---|---|
| Progresso por curso/pessoa e comparações | Relatórios → Aprendizagem → Cursos, com departamento, curso, pessoa, atribuídos/catálogo e situação atual |
| Médias e tentativas de avaliação | Relatórios → Aprendizagem → Avaliações, com nota oficial, pendências, política de tentativas e filtro por pessoa/curso |
| Acertos/erros e feedback | Diagnóstico sanitizado da tentativa em Relatórios, sem respostas ou gabaritos |
| Questões com mais erros | Novo módulo “Pontos de atenção nas avaliações”, derivado do mesmo DTO autorizado; agrupamento por curso, versão, atividade e ID da questão; crédito parcial, pendência e indisponibilidade separados |
| Presença diária do colaborador | Relatórios → Presença → indicadores “Acessos registrados por dia” e “Tempo ativo estimado por dia”, com filtro individual |
| Linha do tempo de envios | Data de envio e situação nas avaliações; conclusões com data registrada em Atividade no período |
| XP | Relatórios → XP, separando período, temporada e histórico disponível |
| Histórico de PDI e conquistas | Preservado na ficha operacional |

Diferenças semânticas corrigidas: duração planejada de aulas não é tempo real de estudo; 100% de aulas não substitui aprovação; correspondência heurística entre categoria/setor não cria uma obrigação; questões pendentes/parciais não viram erros completos. O diagnóstico agregado usa identificação da questão, não reintroduz o gabarito nem o cálculo incorreto no cliente. Histórico sem data/cobertura segue identificado conforme as etapas 04/05.

O ponto de entrada `Team` agora monta `ManagementPage`. O corpo antigo permanece no arquivo como `LegacyTeam`, sem ser montado, para preservar as alterações locais e permitir comparação durante a reforma; seus gráficos, abas analíticas e modais não fazem parte da interface ativa. Foi evitada a reescrita integral de `team.tsx`.

## Arquivos

- `platform/src/components/management/`: página, ficha, formulários e hook de sinais.
- `platform/src/lib/management.ts` e `management.test.ts`.
- `platform/src/styles/management.css` e import em `globals.css`.
- Pontos de entrada `team.tsx` e `/equipe/page.tsx`, com Suspense para parâmetros da URL.
- Integração de contexto em `trails/manage-trails.tsx`, `trails/assignments.tsx` e rota `/equipe/trilhas`.
- Em Relatórios: retorno contextual em `reports-page.tsx`, indicadores diários em `presentation.ts`, `question-attention.ts` e componente correspondente.

Comandos, RPC de conquista, schemas de escrita, backend de PDI, política e serviço de notificações não foram alterados. Trilhas/Discord e demais alterações locais preexistentes preservados.

## Verificações

- `pnpm typecheck`: aprovado; tipos de rotas regenerados após remoção do bootstrap temporário.
- **92 testes aprovados em nove arquivos**: gestão, escopo, trilhas e Relatórios. Seis testes novos cobrem prazo real, atribuições sobrepostas, histórico ausente/curto, limiares com cobertura suficiente, retornos seguros e agregação do diagnóstico por versão/atividade.
- Teste existente de RPC em PostgreSQL isolado/PGlite executado novamente: duas chamadas com o mesmo `requestId` produziram uma conquista e total de 100 XP.
- Playwright em Chromium visível com APIs e autenticação fictícias: 32 ativos autorizados, dois pendentes e pessoa fora do escopo; paginação 25/7, filtros, busca, PDI, conquista, atribuição específica, validação de pessoa/atribuição, retorno contextual, foco/Escape e troca para conta cliente.
- Simulação de resposta interrompida depois de registrar a conquista: retry com o mesmo identificador; uma conquista e +100 XP, sem duplicação. A gravação de PDI e o editor existente de atribuição também foram exercitados com dados isolados.
- Nenhum comando foi enviado ao listar/navegar. Na execução final, somente as ações explícitas do teste geraram comandos: PDI, duas tentativas da mesma conquista e alteração de atribuição. Nenhum anúncio, configuração de política ou preferência foi acionado.
- Seis combinações de tema claro/escuro e larguras 1440, 768 e 390 px; ficha mobile e diagnóstico agregado de Relatórios. Capturas revisadas visualmente; sem overflow da página ou erros de JavaScript.

Evidências e script em `output/management-stage08/`, com `validation.json`, capturas dos temas/larguras, `sheet-mobile.png` e `reports-question-attention.png`. Bootstrap temporário removido; servidor de QA encerrado.

## Limitações

Interface validada com fixtures isoladas, não com login e dados do banco publicado. Não foi realizado build de produção. A migração temporal da etapa 05 continua pendente de aplicação pelo fluxo autorizado; fontes indisponíveis aparecem como falha/cobertura insuficiente. Nenhuma migração nova nesta etapa.

Próxima etapa: **09 — Telas secundárias** (`09-telas-secundarias.md`).
