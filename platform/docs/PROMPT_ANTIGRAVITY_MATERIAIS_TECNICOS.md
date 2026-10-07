# Prompt para o Antigravity — plataforma e importação do acervo técnico

Você vai **concluir e ativar as melhorias da plataforma** e depois preencher a seção **Conhecimento → Materiais técnicos** da Academia DeMaria usando os arquivos da rede da DeMaria. Já há alterações preparadas neste repositório; inspecione o estado atual antes de editar, aproveite o que está pronto e corrija o que estiver faltando, sem criar uma implementação duplicada.

## Primeiro: melhorias da plataforma

1. Na página **Conhecimento**, deixe o cabeçalho compacto e a biblioteca visível sem exigir muita rolagem. Use uma busca principal e navegação clara e visual para **Biblioteca**, **Consulta assistida**, **Minhas anotações** e **Materiais técnicos**. Preserve os recursos existentes, especialmente artigos recentes e reconhecidos, criação de artigos, assistentes e anotações.
2. Na nova seção **Materiais técnicos**, organize os itens por assunto/produto. Ofereça busca e filtros de **Todos**, **Manuais** e **Vídeos**. Cada item deve ter título, descrição e um botão para visualizar o PDF ou assistir ao vídeo do Vimeo dentro da plataforma. Os vídeos técnicos devem ficar em Conhecimento, separados das aulas e cursos do menu Aprender.
3. Permita criar e excluir materiais **somente a gestores e administradores internos**. Colaboradores internos podem consultar; usuários da audiência cliente não devem acessar. Valide essas permissões também no servidor. Para cadastro, aceite PDF privado de até 30 MB ou link HTTPS válido do Vimeo, com assunto, título e descrição. Use URLs temporárias para PDFs e mantenha a busca, estados vazios e interface responsiva funcionais.
4. Confira os arquivos já preparados: `platform/src/components/knowledge.tsx`, `platform/src/components/technical-materials.tsx`, `platform/src/styles/knowledge.css`, `platform/src/app/api/technical-materials/`, `platform/src/lib/technical-material.ts` e `platform/supabase/migrations/20261007165228_technical_materials.sql`. Complete ou corrija a implementação conforme os requisitos acima. Execute checagem de tipos, testes pertinentes e build; verifique a experiência com as três funções de usuário.
5. Aplique a migração no banco do **ambiente alvo** e confirme que o bucket privado e a tabela estão disponíveis antes da importação. Se faltar acesso ao ambiente ou houver erro na migração, registre o impedimento com precisão e não tente publicar materiais em uma seção incompleta.

## Depois: origem e organização

1. Percorra recursivamente `Y:\Treinamento Interno - CQ` (unidade `cpt-005`, servidor `\\192.168.1.179`). Se a letra Y: não estiver disponível, localize o mesmo compartilhamento pela rede. Trabalhe em leitura na origem: não renomeie, mova nem exclua arquivos.
2. Faça um inventário antes de publicar: caminho completo, pasta de assunto, nome, extensão, tamanho, PDFs encontrados, vídeos encontrados e arquivos ignorados. Mostre o inventário resumido e registre ambiguidades para revisão.
3. Use a pasta temática como **assunto/produto**. Remova prefixos numéricos como `009-` e padronize capitalização, acentos e nomes para leitura humana. Não misture arquivos de pastas distintas só porque têm nomes parecidos. Preserve a relação entre PDF e vídeos do mesmo assunto.
4. Leia cada PDF para criar um **título claro** e uma **descrição breve e fiel ao conteúdo** (1 a 2 frases). Não invente funcionalidades nem datas. Se o PDF estiver ilegível ou protegido, registre a pendência em vez de gerar uma descrição especulativa. Não publique duplicatas.

## PDFs na Academia

5. Para cada manual relevante, entre com uma conta interna administradora ou gestora e crie um item do tipo **Manual em PDF** em `Conhecimento → Materiais técnicos`. Preencha assunto, título, descrição e anexe o PDF original. A interface aceita até 30 MB por PDF; informe arquivos acima desse limite para tratamento separado.
6. Confirme após cada publicação que o item aparece no assunto correto e que **Visualizar PDF** abre o documento. Não exponha os PDFs por links públicos permanentes; o aplicativo usa bucket privado e links temporários.

## Vídeos no Vimeo e na Academia

7. Acesse a conta corporativa da DeMaria no Vimeo já autenticada neste computador. Na biblioteca, crie ou reutilize **uma pasta por assunto** correspondente às pastas temáticas da origem. Evite pastas duplicadas.
8. Envie diretamente os vídeos da rede ao Vimeo quando possível, sem manter cópias locais extras. Se o navegador exigir um arquivo local, use uma cópia temporária e remova somente essa cópia após validar o upload; preserve o original da rede.
9. Configure a privacidade e a permissão de incorporação de modo que o vídeo possa ser reproduzido dentro da Academia DeMaria. Para cada vídeo, capture o link HTTPS válido do Vimeo, incluindo o hash de privacidade quando existir.
10. Crie um item separado do tipo **Vídeo do Vimeo** em `Conhecimento → Materiais técnicos`, no mesmo assunto do PDF correspondente, com título e descrição fiéis. Esses vídeos técnicos são materiais de consulta; não crie cursos nem aulas no menu **Aprender**.
11. Confirme que **Assistir vídeo** reproduz o vídeo incorporado na Academia. Se a reprodução falhar por privacidade, domínio, processamento ou formato, corrija ou registre a pendência antes de considerar o item concluído.

## Controle e entrega

12. Não altere permissões da Academia: apenas gestores e administradores podem adicionar ou excluir materiais; colaboradores internos podem consultar. Não publique material de outro diretório sem verificar sua pertinência.
13. Mantenha um relatório de mapeamento por arquivo: origem, assunto, tipo, título publicado, ID ou link na Academia, URL no Vimeo (quando houver), status de validação e motivo de qualquer pendência. Ao final, informe totais de PDFs, vídeos, duplicatas e falhas. Peça minha decisão para casos ambíguos antes de publicá-los.
