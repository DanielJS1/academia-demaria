# Atualização: cursos, usuários e XP

## Ativar no ambiente existente

1. No projeto Supabase `ktmymzokgxmmkleacclq`, abra **SQL Editor → New query**.
2. Execute uma única vez o arquivo `supabase/migrations/202609160001_learning_rewards.sql` completo. Não execute novamente a migração inicial.
3. Confirme `Success`. A migração usa uma transação: se houver erro, as alterações não são aplicadas parcialmente.
4. Depois, publique o código desta atualização na `main` para o deploy da Vercel.

O SQL preserva usuários, cursos, avaliações e XP existentes. Ajusta as referências para permitir a exclusão definitiva de uma conta sem excluir seus subordinados. Atualiza a lista de setores; setores antigos nos perfis permanecem até a correção pelo administrador.

## Regras

### Exceção temporária para testar vídeos

No piloto, avançar para os últimos 20 segundos também conclui a aula e concede o XP normal. Para vídeos de até 20 segundos, exige alcançar 90% da duração. O botão destacado abaixo do player avança após o servidor confirmar o salvamento. A prévia continua sem registrar progresso. A regra original de 90% assistido permanece como alternativa. Para remover a exceção, altere `ALLOW_END_SEEK_COMPLETION` para `false` em `src/lib/video-completion.ts` e ajuste os avisos na sala de aula. Não requer migração SQL.

- Cursos sem avaliação concluem quando todas as aulas forem concluídas. Com avaliação, exigem também aprovação.
- Aula não avaliativa: `10 + 5 × máximo(1, teto(minutos / 5))` XP. Exemplos: até 5 min = 15; até 10 = 20; até 15 = 25. Usa os minutos cadastrados pelo administrador. Vídeos continuam exigindo 90% assistido.
- Curso concluído: 30 XP.
- Objetiva correta: 5 XP. Dissertativa marcada como correta pelo avaliador: 8 XP. Os acertos são pagos ao publicar a correção, mesmo quando a nota final reprova.
- Primeira tentativa aprovada: 30 XP; aprovação após reprovação: 10 XP. Reprovação não paga bônus.
- Cada aula, pergunta, conclusão e aprovação paga uma vez por pessoa/curso. Rever, tentar novamente ou republicar com os mesmos identificadores não multiplica XP. Reciclagens por temporada ficam para uma etapa específica.
- Cursos já remunerados pela regra antiga conservam o XP histórico e não recebem pagamento duplicado pela nova regra. Não há recalculo retroativo de aulas antigas.
- Cadastro reprovado fica inativo; pode ser editado/reativado pelo administrador. Excluir remove Auth, perfil, progresso, avaliações e XP. A auditoria permanece, sem referência pessoal para atores excluídos.
- Os 12 setores são oferecidos no cadastro e podem ser corrigidos pelo administrador. O cadastro público continua limitado aos dois domínios corporativos e sujeito à aprovação.

## Proteção do editor

O editor só navega após confirmação do servidor. Falhas deixam o preenchimento na tela. Uma cópia em `sessionStorage`, por usuário e rota, protege contra recarregamento na mesma aba; salvar com sucesso remove essa cópia. Fechar a aba pode apagar a cópia: use **Salvar rascunho** para persistir no servidor.

## Conferência após ativação

- Publique um curso de uma aula de 5 minutos, sem avaliação: finalizar concede 15 + 30 = 45 XP. Repetir não concede mais XP.
- Crie uma avaliação com uma objetiva e uma dissertativa. Ambas corretas: +13 XP por perguntas; aprovação na primeira tentativa +30 XP; conclusão +30 XP (além das aulas).
- Reprove uma tentativa e aprove a seguinte: +10 XP de aprovação; acertos já remunerados não se repetem.
- Cadastre com um dos setores, aprove e corrija o setor. Teste reprovação e exclusão com uma conta de teste.
- Simule falha de salvamento do curso: o editor deve continuar aberto com todos os dados.

Testes automatizados executam as duas migrações em PostgreSQL via PGlite, verificando XP, concorrência, permissões, reprovação e cascatas de exclusão. Eles não substituem a verificação das credenciais/configurações em produção.
