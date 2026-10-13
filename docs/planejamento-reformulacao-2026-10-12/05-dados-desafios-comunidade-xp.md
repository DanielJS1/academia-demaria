# 05 — Desafios, comunidade, XP e histórico

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisitos: etapas 01 e 04. Use o serviço de relatório e as mesmas regras de autorização/cobertura.

**Objetivo:** completar as fontes analíticas da liderança sem inferir métricas a partir de totais incorretos.

**Pontos de entrada:** periodic-quizzes.ts; academy_quizzes/academy_quiz_attempts e migração 20261006182007_periodic_quiz_history_rewards.sql; community-server.ts; migrações 202609210001_community.sql, 202609230001_media_rich_articles.sql e colaboração posteriores; academy_community_articles/reactions/comments/rewards; academy_xp; funções de conclusão e mutação de progresso/avaliações.

**Execute:**
1. Leia desafios do time por completed_at, nota, aprovação, edição/revisão e snapshot. Preserve uma tentativa oficial por edição. Resultados legados sem snapshot completo mostram limitação de revisão; não invente acertos nem ausência obrigatória. Taxa de participação requer público elegível comprovado; por padrão use contagem.
2. Leia XP por pessoa e created_at. Separe período, temporada e histórico disponível. Não use state.xpEvents, que é pessoal, nem recalcule XP multiplicando interações por valores fixos; preserve estornos e regras existentes.
3. Separe publicações, curtidas, hypes e comentários realizados/recebidos. Comentários vêm dos registros de comentários; rewards tem deduplicação/limites e não serve como contador de todas as interações.
4. Faça inventário temporal antes de migrar: created_at de artigo é criação; updatedAt é edição; created_at de reação não registra reativação. Para primeira publicação legada, aceite evento publish comprovado mesmo com amount=0, documentando cobertura. Não conte coautoria duas vezes.
5. Instrumente somente lacunas comprovadas. Eventos mínimos de publicação/transição de reação devem ser gravados na mesma transação da ação real, com idempotência, sem corpo de comentário ou outros dados desnecessários. Requisição repetida sem mudança não gera evento. Deduplicar reação ator/artigo/tipo dentro do período para métricas de participação; alternância não pode inflar premiação. Saldo ativo atual é outra métrica.
6. Se não houver prova canônica de conclusão temporal, registre evento pessoa/curso/versão ao cruzar incompleto→completo, contemplando correção tardia e proficiência. Não marque o acervo atual como concluído na data da migração; baseline é estado atual, data desconhecida. Não conceder XP adicional.
7. A leitura mostra cobertura prospectiva e dados legados parciais. Não acrescente rastreamento de conteúdo de teclas, URLs ou “tempo real de estudo”.

**Critérios de aceite:** usuário fora da equipe recusado em todas as fontes; reação repetida/on-off-on com contagens corretas; comentário sem recompensa continua contado; XP respeita ledger; primeira publicação versus edição; desafio com snapshot legado; conclusão por aprovação posterior; retries não duplicam evento nem XP; nenhuma falsa retroatividade. Teste migrações/RPC e regressões de comunidade, quizzes, proficiência e reconhecimento em ambiente isolado. Documente claramente desde quando cada métrica é completa.
