# 10 — Validação integrada e fechamento

Copie o texto abaixo como pedido de execução para o SOL 6.1.

---

Você é o SOL 6.1. Trabalhe no repositório `C:\Users\Daniel José\DOC-Academy-local`, aplicativo em `platform/`. Leia `AGENTS.md`, `platform/AGENTS.md` e `ARCHITECTURE.md`. O plano de referência é `docs/planejamento-reformulacao-2026-10-12/PLANEJAMENTO.md`. Execute somente esta etapa, considerando os resultados das etapas anteriores indicadas; confirme-os no código e não presuma implementação inexistente.

Preserve as alterações locais preexistentes, inclusive Trilhas/Discord. Faça diffs mínimos, componentes modulares e CSS temático. Use a documentação local da versão instalada do Next.js antes de alterar suas APIs e as skills pertinentes. Não mude regras de XP, papéis ou acesso por efeito colateral. Não faça deploy, push ou alterações em banco de produção. Para etapas com banco, prepare e teste migrações em ambiente local/de teste isolado; relate o que ainda precisa ser aplicado.

Ao concluir, informe comportamento entregue, arquivos alterados, verificações realmente executadas e limitações. Rode typecheck e testes pertinentes aos riscos da etapa; não alegue sucesso de verificações que não executou. Se encontrar desvio material do plano, explique a evidência e resolva sem ampliar silenciosamente o escopo.

Pré-requisitos: etapas 01–09 implementadas. Esta etapa não autoriza deploy.

**Objetivo:** verificar o fluxo completo e fechar a reforma, com evidências reproduzíveis e correções dos problemas encontrados.

**Execute:**
1. Leia PLANEJAMENTO.md e a matriz de rastreabilidade; confira cada pedido e cada critério dos nove prompts anteriores. Registre “atendido”, “parcial” ou “pendente” com evidência, sem considerar ausência de erro como comprovação.
2. Rode typecheck, testes de domínio/rotas/migrações pertinentes e E2E adaptados. Reutilize management-reports.spec.ts, testes de team-scope/engagement/trails/periodic-quizzes/community e fixtures existentes. Corrija falhas causadas pela reforma; relate falhas preexistentes comprovadas.
3. Teste admin, gestor A, gestor B, colaborador e cliente. Adulterar pessoa/departamento/curso no request ou URL não pode mostrar/exportar equipe não autorizada. Consultas gerenciais não expõem gabaritos, PDI ou notas locais.
4. Percorra Conhecimento: DLL apenas no corpo de artigo, cinco fontes, nota no navegador, resultados vazios/parciais, fonte falhando, digitação rápida, deep link, limpar e voltar.
5. Percorra Relatórios: seis visões, filtros, período personalizado, situação atual versus eventos, troca de gráfico, análise individual, mais de 25 linhas e mais de 1.000 registros no banco. Compare manualmente um conjunto de referência calculado fora da implementação com KPIs/linhas/CSV/PDF.
6. Cenários de dados: aluno com 100% de aulas e prova pendente; proficiência; múltipla escolha; crédito parcial; nenhuma nota; mesma pessoa com várias tentativas; mesmo curso em duas trilhas; ausência de cobertura; zero legítimo; meia-noite de Brasília; departamento alterado com rótulo de equipe atual; reação repetida/reativada; publicação editada; XP de período versus temporada; evento de conclusão prospectivo sem backfill fictício.
7. Percorra Gestão: lista→ficha→PDI/conquista/trilhas→relatório individual. RequestId repetido concede +100 XP uma vez; navegação/leitura não envia mensagens. Verifique ações indisponíveis para pendentes/inativos.
8. Verifique catálogo, trilhas, avisos de desafios, perfil/foto/senha e impressão de certificados após os ajustes secundários.
9. QA visual e acessibilidade: 1440/1024/768/390px, ambos os temas, zoom 200%, foco e teclado, nomes longos, números grandes, erros e carregamento. Inspecione os PDFs renderizados, não somente tamanho do arquivo.
10. Registre integrações ou migrações não aplicadas fora do ambiente de teste. Não publique nem aplique em produção.

**Entregáveis finais:** checklist rastreável, capturas comparativas das telas-alvo, amostras CSV/PDF de teste, comandos e resultados executados, problemas corrigidos, limitações reais de histórico e lista de migrações/dependências para implantação posterior. Informe se a reforma cumpre os critérios e o que falta; não declare pronta se relatórios divergirem das fontes ou um pedido dos vídeos estiver pendente.
