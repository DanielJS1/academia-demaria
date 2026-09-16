# Atualização de atividades, PDFs e interface

## Ordem de ativação

1. Com as migrações anteriores já aplicadas, execute uma vez `supabase/migrations/202609170001_activity_assessments.sql` no SQL Editor do Supabase.
2. Confirme `Success`. O script usa transação, preserva o rascunho e a versão publicada e vincula a avaliação antiga à primeira atividade de avaliação.
3. Publique a versão correspondente da aplicação. As novas avaliações por atividade dependem dessa migração.

## Editor e publicação

- Módulo é opcional. A ordem das atividades é mantida mesmo quando nomes de módulos se repetem.
- Erros de validação identificam a atividade e aparecem também junto ao botão Publicar, além do aviso temporário.
- Adicionar atividade aparece no início e no final da lista quando há duas ou mais atividades.
- Salvar rascunho não altera o curso visível no catálogo. Publicar confirma a gravação antes de sair da página.

## Avaliações

- Cada atividade do tipo Avaliação tem suas próprias perguntas. Pode ser colocada em qualquer posição, com ou sem módulo.
- Para enviar uma avaliação, o aluno conclui as aulas anteriores e aguarda aprovação das avaliações anteriores. Aulas posteriores podem ser consultadas, mas não são pré-requisito desta avaliação.
- Nota mínima e política de novas tentativas são herdadas das regras do curso.
- Na política Revisar, a reprovação reinicia apenas as aulas desde a avaliação anterior até a avaliação reprovada. Ganhos de XP existentes não se repetem.
- Cada avaliação possui bônus de aprovação de 30 XP ou 10 XP após reprovação. O bônus de 30 XP do curso exige todas as aulas e avaliações concluídas/aprovadas.
- Respostas e gabaritos ficam associados à versão enviada. Cursos e tentativas antigos são convertidos sem descartar perguntas ou correções.

## PDFs

- Leitura aceita texto, PDF ou ambos. Limite inicial: 3 MB por PDF, adequado ao upload pela API da Vercel.
- Upload é exclusivo de administradores. A API valida tamanho, extensão e assinatura do arquivo.
- O bucket privado `academy-pdfs` é criado no primeiro envio pela API com a credencial de servidor já configurada. Não conceder acesso público ao bucket.
- A leitura usa link temporário de 10 minutos, emitido somente após autenticação e conferência do anexo no curso publicado (ou rascunho para administrador). O botão Recarregar PDF renova o acesso.
- Trocar ou remover um anexo no rascunho não apaga o arquivo físico: isso preserva a versão ainda publicada. Uma limpeza futura deve considerar todas as referências antes de remover arquivos.
- Salve antes de abrir a prévia. A conclusão de leitura é manual pelo aluno.

## Aparência

- Tema escuro com fundo próximo do preto, superfícies neutras e roxo nos destaques.
- Logo no topo da navegação; DOC-Academy no rodapé, com Academy roxo.
- Indicador visual K removido; o atalho Ctrl/Cmd+K continua focando a pesquisa.
- Movimento discreto no banner com o mouse, desativado em preferências de movimento reduzido e sem dependência de animação para navegação.

## Validação

- Testes SQL incluem migração de tentativa antiga, provas intermediárias, recuperação por etapa e bônus sem duplicidade.
- Teste de navegador local com autenticação/API simuladas: publicação de 13 aulas, manutenção dos dados após falha, botões de inclusão, editor de perguntas e anexo PDF.
- Teste com Supabase e Vimeo reais deve ser feito após ativação, incluindo upload de um PDF válido e publicação do rascunho de DOC-Windows pelo administrador.
