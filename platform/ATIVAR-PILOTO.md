# Ativar o piloto real da DOC-Academy

Projeto Supabase: `ktmymzokgxmmkleacclq`  
Site: https://doc-academy-hazel.vercel.app  
Primeiro administrador: `daniel@sacdemaria.com.br`

## 1. Configurar a Vercel

Em **Settings → Environment Variables**, configure as quatro variáveis abaixo para Production. Se também testar a branch `dev`, configure Preview com atenção: usar o mesmo banco significa compartilhar os mesmos dados.

| Variável | Valor / onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ktmymzokgxmmkleacclq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys: chave pública/publishable ou anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys: chave secreta/secret ou service_role |
| `NEXT_PUBLIC_SITE_URL` | `https://doc-academy-hazel.vercel.app` |

A chave secreta deve ficar apenas na variável sem prefixo NEXT_PUBLIC. Não cole chaves em arquivos versionados, mensagens ou capturas de tela. Depois de configurar, faça um novo deploy para que a Vercel incorpore as variáveis públicas.

## 2. Criar as tabelas

No Supabase, abra **SQL Editor → New query**. Copie o conteúdo completo de `supabase/migrations/202609150001_pilot.sql` e clique em Run. Execute esta migração apenas uma vez. Ela cria tabelas, índices, auditoria e comandos com acesso restrito ao servidor.

O banco começa vazio: os dados fictícios da apresentação não serão importados.

Depois da migração inicial, execute também `supabase/migrations/202609160001_learning_rewards.sql`, uma vez, para ativar XP por aula, conclusão sem avaliação e gestão de cadastros. Em um banco já existente, siga [ATUALIZAR-APRENDIZADO.md](ATUALIZAR-APRENDIZADO.md).

## 3. Criar o primeiro administrador

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Informe `daniel@sacdemaria.com.br` e escolha pessoalmente uma senha forte, com pelo menos 12 caracteres. Mantenha a senha privada. Confirme o e-mail nessa criação administrativa, quando essa opção aparecer.
3. Volte ao SQL Editor e execute `supabase/bootstrap-admin.sql`. Esse script vincula a conta já criada ao perfil de administrador; ele não contém senha.
4. No site, entre com o e-mail e a senha definidos acima.

## 4. Criar um colaborador de teste

Na DOC-Academy → **Administração → Pessoas → Cadastrar pessoa**:

- Informe nome, e-mail, setor, gestor e perfil Colaborador.
- Para testar sem SMTP, selecione **Criar com senha inicial (piloto)**. Escolha uma senha com pelo menos 12 caracteres e entregue-a diretamente à pessoa.
- Para usar convite por e-mail, selecione essa opção após configurar o envio no Supabase.
- O usuário poderá trocar a senha em **Minha senha**.
- Abra outra sessão de navegador para testar o colaborador sem sair da conta do administrador.

Contas existentes não têm seu e-mail alterado nesse editor. Desativar uma conta impede novas consultas e alterações pela API.

## 5. Configurar e-mail, quando necessário

No Supabase → Authentication, configure o Site URL e os Redirect URLs autorizados:

- `https://doc-academy-hazel.vercel.app/acesso`
- `http://127.0.0.1:4174/acesso` (somente para teste local)

Desative o cadastro público de novos usuários. O cadastro interno é feito pelo administrador da plataforma. Para convites e recuperação em e-mails de colaboradores, configure SMTP próprio e faça um envio de teste; o serviço padrão do Supabase possui restrições. As credenciais SMTP devem ser inseridas diretamente no painel, nunca no GitHub.

## 6. Cadastrar o primeiro curso

1. Administração → Cursos → Criar curso.
2. Preencha título, descrição e produto.
3. Adicione as atividades e organize a ordem com as setas. O mesmo nome de módulo agrupa as atividades.
4. Nas videoaulas, cole links HTTPS do Vimeo. Para vídeos não listados, preserve o link completo, incluindo o identificador privado.
5. No Vimeo, permita a incorporação no domínio `doc-academy-hazel.vercel.app`. Links não listados não substituem restrições por domínio.
6. Adicione a avaliação e as questões. Questões objetivas precisam de alternativas distintas e gabarito; questões discursivas terão correção manual.
7. Configure nota mínima, XP e a regra após reprovação. Salve rascunho e confira **Ver prévia salva**: a prévia não altera progresso ou XP.
8. Publique. O servidor exige aulas, avaliação, leituras preenchidas e links Vimeo válidos.

## 7. Conferir o fluxo real

Na conta do colaborador, abra o curso e assista a pelo menos 90% de cada vídeo. Os trechos reproduzidos são salvos aproximadamente a cada 12 segundos e ao pausar. Antes de fechar a aula, pause e aguarde a gravação. Trechos pulados não contam como assistidos. Leituras têm conclusão manual.

Após concluir as aulas, responda e envie a avaliação. Na conta do administrador, abra **Correções**, publique nota e feedback. Volte à conta do colaborador e atualize a página para consultar o resultado e o XP. Troque de navegador e confirme que o histórico permanece.

Confira também que o colaborador não acessa Administração, que um gestor vê apenas os relatórios da própria equipe e que repetir uma correção não concede XP novamente.

## Limites deste piloto

- O rastreamento do Vimeo depende dos eventos do player no navegador; não é prova inviolável de atenção nem sistema de fiscalização de provas.
- Republicar um curso cria uma nova versão e reinicia o progresso nessa versão. As tentativas antigas preservam suas questões e regras. O XP é concedido uma vez por curso; reciclagem anual ainda será implementada.
- Certificados oficiais, RAG, uploads e ambiente de clientes permanecem em etapas posteriores.
- Antes de ampliar o piloto, estabelecer backup, restauração e monitoramento com a TI.

## Verificação técnica

Em `platform/`: `pnpm test`, `pnpm typecheck`, `pnpm build`.
Os testes usam PostgreSQL via PGlite para executar a migração e validar regras. Isso não substitui a homologação no projeto Supabase e no Vimeo real, após configurar o ambiente.
