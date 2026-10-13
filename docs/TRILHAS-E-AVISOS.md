# Trilhas e avisos de aprendizagem

## Uso

Em **Minha gestão → Trilhas e avisos**, administradores e gestores podem:

1. Criar trilhas de integração ou capacitação com cursos publicados e ativos, incluindo cursos de RH. Selecionar e ordenar os cursos; o setor é uma referência, não uma matrícula automática.
2. Atribuir uma trilha a um ou vários colaboradores da equipe, com data limite e antecedentes independentes para colaborador e gestor. Ajustar ou cancelar uma atribuição individual depois.
3. Configurar pop-ups, e-mail, intervalo entre lembretes, dias de inatividade e frequência mínima de acesso. As antecedentes padrão valem para novas atribuições; as existentes são ajustadas individualmente.
4. Publicar avisos internos personalizados e escolher se aparecem também em pop-up.
5. Consultar o histórico da equipe, com destinatário, mensagem, confirmação na plataforma e estado do e-mail.

O aluno encontra **Minhas trilhas** em **Aprender**, com cursos, progresso e prazo. Cursos já concluídos continuam contando. A conclusão segue a regra existente do curso, incluindo aprovação das atividades aplicáveis; não basta abrir um vídeo.

Editar o modelo de uma trilha não substitui a seleção de cursos das atribuições anteriores. A atribuição preserva título e cursos. O progresso acompanha a versão corrente do curso, conforme as regras já usadas na plataforma.

## Avisos

- Atribuição de trilha, retomada de curso e avisos personalizados ficam na plataforma.
- Prazos próximos ou vencidos, inatividade prolongada e baixa frequência podem gerar e-mail quando a gestão habilita esse canal.
- Os dois dias para avisar o gestor são apenas um padrão inicial editável. A antecedência admite zero, para aviso no próprio dia do vencimento.
- Um pop-up prioritário por entrada/dia do navegador, com fundo escurecido e fechamento explícito. Outros avisos continuam no sino. Fechar ou abrir um aviso confirma sua leitura na plataforma; uma falha de gravação não prende a pessoa no modal.
- Não há e-mails disparados pelo navegador ou pela consulta da tela. O envio é feito pela rotina autenticada de lembretes.
- Confirmação na plataforma não comprova leitura do e-mail. “Aceito pelo provedor” registra apenas a aceitação do envio.
- Lembretes têm intervalo mínimo configurável e deixam de ser pertinentes quando a trilha é concluída, cancelada ou o prazo é alterado. A fila verifica novamente a pertinência antes de enviar.
- Presença é avaliada apenas no período observado após cadastro/coleta. Não classificamos como pouco acesso um colaborador recém-cadastrado sem janela suficiente.
- O gestor direto é priorizado. Sem vínculo direto, usa-se um gestor do setor, conforme o modelo atual da equipe; recomenda-se preencher o gestor direto quando houver mais de um gestor no setor.
- Preferências de trilhas pertencem a quem atribui a trilha. Alertas de presença usam as preferências do gestor responsável.

## Ativação

O código e a migração foram validados com o Supabase isolado de homologação. Em 09/10/2026, a ativação em produção ficou assim:

- Migração confirmada no Supabase de produção: cinco tabelas e função de gravação presentes.
- Aplicação publicada: implantação `dpl_AV3JjZvMPXkDgi1VKmjTe6Y9uGbo`, estado `READY`, em `https://academia-demaria.vercel.app`.
- `CRON_SECRET` configurado como segredo de produção; URL pública conferida.
- Agendamento diário registrado e ativo: `0 11 * * *`, em `/api/trilhas/lembretes`.
- Execução autenticada validada com HTTP 200; sem autenticação, HTTP 401. Foram criados sete avisos internos e enviados zero e-mails.
- Em espera, por decisão de 09/10/2026: ativação dos e-mails de aprendizagem. O código do adaptador foi preservado para retomada futura; nenhum serviço Resend foi configurado. O SMTP de autenticação do Supabase continua independente.
- Discord implementado e publicado, com comandos e endpoint registrados. Falta confirmar a entrada do bot no servidor e vincular as contas; procedimento em [DISCORD-ATIVACAO.md](DISCORD-ATIVACAO.md).

Os passos abaixo são a referência para futuras ativações; os passos 1, 2 e 3 já estão concluídos em produção.

1. Aplicar `platform/supabase/migrations/20261009213438_learning_trails_and_alerts.sql` no projeto do ambiente de destino. A migração cria tabelas separadas; não altera as questões das provas.
2. Implantar a aplicação com `platform/vercel.json`. O agendamento diário chama `/api/trilhas/lembretes` às 11h UTC, equivalente a 8h de São Paulo. Também aceita POST para um agendador externo. Configurar apenas um agendador.
3. Definir um `CRON_SECRET` longo e aleatório no servidor. A rota recusa execução sem o token. O cron pode preparar avisos internos mesmo sem provedor de e-mail.
4. Para e-mails, configurar no servidor `RESEND_API_KEY`, `LEARNING_EMAIL_FROM` com remetente de domínio validado, e `NEXT_PUBLIC_SITE_URL` com a URL HTTPS correta da Academia. O adaptador usa a API do Resend; um SMTP corporativo requer outro adaptador de transporte.
5. Habilitar o canal de e-mail nas configurações da gestão. Ele começa desabilitado. Na ausência das variáveis, a gestão mostra que o envio aguarda configuração.

### Configurar o envio de e-mails

Esta seção fica guardada para uma futura retomada. Não é uma pendência necessária para ativar o Discord.

No Resend, adicionar e validar um domínio da empresa seguindo os registros DNS apresentados em **Domains**. Escolher um remetente nesse domínio. Referência: [domínios verificados](https://resend.com/docs/dashboard/domains/introduction).

Em **API Keys**, criar uma chave para a Academia com permissão de envio (`sending_access`), preferencialmente restrita ao domínio escolhido. Guardar a chave diretamente na Vercel; não enviar por chat. Referência: [gerenciamento de chaves](https://resend.com/docs/dashboard/api-keys/introduction).

Na [configuração de variáveis da Academia na Vercel](https://vercel.com/daniel-js/academia-demaria/settings/environment-variables), adicionar em **Production**:

- `RESEND_API_KEY`: a chave criada, como variável secreta.
- `LEARNING_EMAIL_FROM`: `Academia DeMaria <endereco@dominio-validado>`; substituir pelo remetente real do domínio validado.

Após salvar essas variáveis, fazer uma nova implantação para que o servidor as receba. `NEXT_PUBLIC_SITE_URL` deve apontar para `https://academia-demaria.vercel.app`.

Por último, abrir **Minha gestão → Trilhas e avisos → Configurações**, habilitar o canal de e-mail e salvar os critérios desejados. Cada gestor controla suas preferências; não é necessário habilitar o envio para todos de uma vez. Consultar o histórico após a execução da rotina para verificar a aceitação pelo provedor.

O cron da Vercel admite execução diária no plano Hobby, sujeito às cotas de funções e sem garantia de precisão no minuto. Consulte [uso e limites do cron](https://vercel.com/docs/cron-jobs/usage-and-pricing). O provedor de e-mail tem limites e custos próprios; esta implementação não cria conta ou assinatura.

Reservas de envio evitam concorrência entre executores. A chave de idempotência do provedor tem janela de 24 horas, conforme a [documentação do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). Entrega sem confirmação ou reserva antiga fica marcada para inspeção, em vez de reenvio automático incerto. A rotina processa até 50 mensagens por chamada, interrompendo o lote para respeitar o tempo da função; pendências restantes ficam para a próxima execução. Falhas explicitamente recusadas pelo provedor têm no máximo cinco tentativas.

## Permissões e persistência

As tabelas têm RLS habilitado, sem acesso direto para `anon` ou `authenticated`. A API autentica a sessão e o servidor usa `service_role`; a função de mutação é `SECURITY INVOKER` e também confere perfil, equipe e revisão. O aluno recebe apenas suas atribuições e seus avisos. Gestores só atribuem e acompanham pessoas da equipe; administradores podem atuar entre setores. Clientes de cartório não participam deste módulo interno.

O aviso informativo do Supabase sobre RLS sem políticas é esperado neste padrão de acesso exclusivo pelo servidor. Foram conferidas também as permissões efetivas: navegação autenticada sem SELECT direto e serviço com acesso. Referência: [verificação de RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Edições usam revisão otimista. Atribuições em grupo são transacionais; repetição da mesma solicitação não duplica matrículas, e reutilizar seu identificador com conteúdo diferente é rejeitado. O histórico de confirmação e entrega permanece independente da atualização de cursos.

## Validação

- Testes de regras e persistência real em PostgreSQL/PGlite: prazos de São Paulo, datas inválidas, conclusão e aprovação, equipe, atribuição atômica, versões, preservação de atribuições e permissões.
- Testes de fila: deduplicação, cancelamento após conclusão, atualização de preferências, concorrência no envio e entrega incerta.
- Navegador com API simulada: criação, atribuição, configurações, avisos, foco do modal, limitação de frequência, acesso do aluno e largura de 375px.
- Integração real com o Supabase de homologação e navegador: login, gravação/leitura, conflito de revisão, privacidade, confirmação e cancelamento.
- Compilação de produção e verificação TypeScript.

Os resultados locais ficam em `platform/reports/trails-*.txt` e `platform/reports/trails-*-results.json`. Para repetir o teste real, executar `node scripts/test-trails-live.mjs` em `platform` com um servidor local apontado ao projeto isolado na porta 4175; o script recusa produção e remove os dados temporários. Não imprime credenciais nem envia e-mails reais.
