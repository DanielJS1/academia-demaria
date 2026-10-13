# Discord da Academia DeMaria — preparação para ativação

Status em 09/10/2026: integração implementada e publicada, com migração aplicada em homologação e produção. Token conferido e os identificadores do Discord foram configurados na Vercel. O Discord validou a URL de interações e registrou o comando `/academia`. A consulta de ativação ainda não confirmou o acesso do bot ao servidor: falta adicioná-lo pelo link abaixo. E-mail de aprendizagem continua em espera; autenticação do Supabase permanece independente.

- Aplicação: `1558246474578665562`.
- Servidor: `867749095967686676`.
- Endpoint validado: `https://academia-demaria.vercel.app/api/discord/interacoes`.
- Comando registrado: `1558292611314221077`.
- [Adicionar o bot ao servidor Academia DeMaria](https://discord.com/oauth2/authorize?client_id=1558246474578665562&scope=bot%20applications.commands&permissions=0&guild_id=867749095967686676&disable_guild_select=true). Este fluxo exige login e permissão de gerenciar o servidor; o token do bot não permite autorizar sua própria instalação.

## Primeiro uso

1. Adicionar o bot pelo link acima.
2. Na Academia, abrir **Menu lateral → Minhas trilhas → Lembretes no Discord** e clicar em **Conectar Discord**.
3. Entrar na conta do Discord e autorizar a identificação. A Academia confirma a conta autenticada e a participação no servidor da DeMaria. Não é necessário copiar códigos; o login é feito uma única vez.
4. O retorno à Academia conclui a conexão automaticamente. Usar **Testar mensagem privada** para confirmar que as DMs estão permitidas. A opção **Vincular por código como alternativa** continua disponível.
5. Cada gestor abre **Minha gestão → Trilhas e avisos → Configurações**, habilita **Enviar lembretes privados pelo Discord** e escolhe os dias e critérios. O canal começa desabilitado; a conexão da equipe pode ser acompanhada nessa tela.

Comandos disponíveis: `/academia vincular`, `/academia trilhas`, `/academia prazos`, `/academia equipe` (gestores) e `/academia ajuda`. Respostas no servidor são privadas para quem executa o comando. Os botões de uma DM permitem abrir a Academia, consultar trilhas e confirmar o aviso.

O histórico distingue envio aceito pelo Discord e confirmação explícita no botão. Mensagens privadas bloqueadas ficam visíveis para a gestão; o colaborador pode permitir DMs e pausar/reativar os lembretes em sua conexão. Entrega sem confirmação técnica não é repetida automaticamente.

A rotina usa o agendamento existente, diariamente às 8h de São Paulo, sujeito à precisão da Vercel, e respeita os dias selecionados. Há no máximo uma tentativa automática por pessoa/dia, priorizando prazos vencidos e próximos. O intervalo entre lembretes da mesma pendência continua configurável. Até 20 envios são considerados por execução, dentro do tempo da função; pendências restantes ficam para a próxima execução. O horário global atual é definido em `platform/vercel.json`.

Avisos personalizados da gestão permanecem internos; os envios automáticos do Discord abrangem atribuição, prazos, inatividade, baixa frequência e retomada. O bot atende por comandos e botões, sem conversa livre com IA ou leitura das conversas do servidor.

Validação: 344 testes da aplicação; 37 testes finais das trilhas/Discord; compilação e TypeScript; navegador com API simulada, vinculação, pausa, retomada, teste de mensagem e largura de 375px. O teste de DM real deve ser feito pela primeira conta vinculada. As tabelas de vínculos e códigos têm RLS e nenhuma permissão direta de leitura para o navegador; acesso exclusivo pelo servidor. O aviso informativo de RLS sem políticas é esperado nesse padrão: [referência do Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## O que o administrador do Discord precisa preparar

1. Entrar no [Discord Developer Portal](https://discord.com/developers/applications) com a conta responsável pelo bot. Criar uma aplicação chamada **Academia DeMaria**.
2. Em **General Information**, guardar **Application ID** e **Public Key**. Esses dois valores podem ser informados no chat; não são o token secreto.
3. Em **Bot**, gerar o token do bot. Guardá-lo diretamente na [Vercel → Academia DeMaria → Environment Variables](https://vercel.com/daniel-js/academia-demaria/settings/environment-variables), com nome **DISCORD_BOT_TOKEN**, tipo secreto e ambiente **Production**. Não enviar o token por chat nem adicioná-lo a arquivos versionados.
4. Instalar a aplicação no servidor da DeMaria usando instalação no servidor (**Guild Install**), com os escopos **bot** e **applications.commands**. Não conceder **Administrator**. A seleção exata das permissões será conferida na ativação; o objetivo é mensagens privadas e comandos, sem administração de usuários ou canais.
5. Informar o ID do servidor. No Discord, habilitar **Modo desenvolvedor** nas configurações avançadas, clicar com o botão direito no servidor e usar **Copiar ID do servidor**.

Criar a aplicação e instalar no servidor exige acesso à conta do Developer Portal e permissão para gerenciar o servidor. Se o usuário não tiver essas permissões, o administrador pode fazer essa preparação.

Referência oficial: [criação de um bot](https://docs.discord.com/developers/quick-start/getting-started).

## O que foi preparado na aplicação

- Vinculação verificada entre a conta autenticada da Academia e a conta do Discord; não associar pessoas pelo apelido ou nome exibido.
- Mensagens privadas sobre novas trilhas, prazos, inatividade e retomada de cursos, com links para a Academia.
- Consultas por comandos e botões, incluindo trilhas e pendências pessoais.
- Avisos privados ao gestor responsável, respeitando a equipe e as permissões existentes.
- Preferências na gestão, controle de frequência e histórico de envio e confirmação.
- Tratamento de mensagens bloqueadas, conta desvinculada e falhas do Discord; avisos internos continuam disponíveis.

O recebimento de interações usa HTTP, sem processo conectado permanentemente ao Gateway. O endpoint verifica a assinatura Ed25519 sobre o corpo original e a atualidade do timestamp; respostas de consultas demoradas usam confirmação imediata e conclusão posterior. A URL já foi cadastrada e validada automaticamente pelo Discord.

Referência oficial: [recebimento de interações por HTTP](https://docs.discord.com/developers/interactions/receiving-and-responding).

## Variáveis para ativação

| Variável | Origem | Tratamento |
| --- | --- | --- |
| `DISCORD_APPLICATION_ID` | General Information → Application ID | Identificador |
| `DISCORD_PUBLIC_KEY` | General Information → Public Key | Chave pública para verificar assinaturas |
| `DISCORD_GUILD_ID` | ID do servidor da DeMaria | Identificador |
| `DISCORD_BOT_TOKEN` | Bot → token | Segredo apenas no servidor |
| `DISCORD_CLIENT_SECRET` | OAuth2 → Client Secret | Segredo OAuth apenas no servidor |

O `CRON_SECRET` e a URL pública da Academia já estão configurados em produção. Esses dados do Discord não substituem as credenciais do Supabase.

## Ativação e teste

Para esta instalação, código, variáveis, endpoint e registro de comandos já foram preparados. Depois de adicionar o bot ao servidor, vincular inicialmente sua própria conta e testar a DM. Conferir consulta de trilhas e histórico antes de habilitar os lembretes para as equipes.

Os colaboradores precisarão permitir as mensagens privadas do bot. O Discord pode bloquear DMs conforme as configurações de privacidade; registrar aceitação pelo Discord não equivale a comprovar leitura. Referência: [privacidade e mensagens diretas](https://support.discord.com/hc/en-us/articles/217916488-Blocking-Privacy-Settings).

Os avisos enviados serão restritos à capacitação da Academia. Conversa livre com inteligência artificial não faz parte desta preparação e exigiria uma definição adicional de escopo.

## Login com Conectar Discord

No Developer Portal → OAuth2 → Redirects, cadastrar exatamente `https://academia-demaria.vercel.app/api/discord/oauth/callback`. Guardar `DISCORD_CLIENT_SECRET` na Vercel, ambiente Production, e publicar novamente para aplicar o segredo. O token do bot não substitui o segredo OAuth.

O fluxo solicita apenas `identify`, valida estado assinado em cookie HttpOnly/Secure e compara o usuário autenticado antes de gravar a conexão. A autorização vence em dez minutos; a conta do Discord precisa pertencer ao servidor configurado e não pode estar vinculada a outra pessoa. Tokens OAuth não são persistidos e são revogados após a consulta da identidade. Códigos de autorização são removidos da URL no retorno.

Validação adicional: oito testes de OAuth, incluindo adulteração, expiração, troca de usuário, callback e revogação; navegador com autorização simulada, retorno único, remoção da URL, teste de DM, alternativa manual e largura de 375px. A autorização e o recebimento reais devem ser confirmados pelo colaborador com sua própria conta.
