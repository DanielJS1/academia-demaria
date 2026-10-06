# Homologação da Academia DeMaria

## Ambientes

Link permanente: https://academia-demaria-git-codex-homologacao-daniel-js.vercel.app

Esse alias acompanha automaticamente os deployments da branch `codex/homologacao`. Pode ser necessário entrar na Vercel com a conta DanielJS antes do login da academia. As contas dedicadas e senhas estão no arquivo privado de acessos entregue ao responsável, fora do repositório.

| Ambiente | Código | Banco | Finalidade |
| --- | --- | --- | --- |
| Produção | `main` | `ktmymzokgxmmkleacclq` | Uso real da academia |
| Homologação | `codex/homologacao` | `attnodzrjlhqydhrgqtr` | Aprovação e testes com dados fictícios |
| Preview de feature | Branch da feature | Banco de homologação | Conferir a mudança antes de integrá-la |

O projeto Supabase **Academia DeMaria Homologacao** pertence à organização DanielJS, região São Paulo. Criação autorizada com custo informado de US$ 0/mês, sujeito aos limites do plano gratuito. Não foi copiado nenhum usuário, senha, conteúdo, tentativa ou XP de produção. As contas dos dois ambientes são independentes.

As variáveis **Preview** da Vercel apontam para esse banco. As variáveis de produção continuam no projeto original. Uma prévia exige a proteção de acesso da Vercel quando aplicável, além do login da academia com conta de homologação. O login mostra o aviso de homologação; a aba e o cabeçalho desktop também identificam o ambiente.

## Aprovar uma feature

1. Criar uma branch `codex/nome-da-feature` a partir da base aprovada e implementar a mudança.
2. Aplicar migrations novas primeiro em homologação e executar testes. Não usar `db push` cegamente em produção: o histórico remoto original está incompleto.
3. Enviar a branch ao GitHub. A Vercel gera uma URL de Preview usando o banco de homologação. O PR para `main` executa os checks obrigatórios de segurança, tipos, testes e E2E.
4. Testar o link com as contas fictícias. Registrar o que funcionou e o que precisa de correção. Pedir ajustes enquanto a feature não estiver aprovada.
5. Após os checks e sua aprovação, integrar a feature em `codex/homologacao` quando for preciso validar o conjunto de mudanças. Conferir novamente o link permanente de homologação.
6. Revisar o PR para `main` e a lista de migrations de produção. Aplicar apenas as migrations novas aprovadas, verificar schema, histórico e ledger; depois mesclar o código em `main`.
7. A integração Git da Vercel publica `main` em produção. Conferir a versão publicada. Nunca promover diretamente uma Preview construída com variáveis de homologação para produção: deve haver um novo build com as variáveis corretas.

A aprovação é uma decisão sua. O processo não faz merge automático de features. Testes, contas, XP e preferências de homologação não são mesclados ou copiados para produção; somente código e migrations revisadas são publicados.

O Supabase de homologação é compartilhado pelas prévias das features. Migrations incompatíveis entre branches precisam de coordenação; alterações arriscadas podem exigir outro banco/branch isolado com custo aprovado antes da criação. Enquanto uma alteração de schema não estiver pronta, não aplicar em produção.

## Testes e configuração

O job de qualidade do GitHub usa o Environment **homologacao**, com suas próprias chaves Supabase e quatro contas dedicadas: administrador, colaborador, gestor e cartório. `scripts/assert-e2e-isolation.mjs` impede execução com referência de produção ou URL divergente.

Localmente, os valores ficam em `platform/.env.homologacao.local`, ignorado pelo Git. Para executar sem substituir o `.env.local` de produção:

```powershell
cd platform
node scripts/run-homologacao.mjs dev
# Em outro terminal:
node scripts/run-homologacao.mjs e2e
```

`scripts/seed-homologacao.mjs` prepara contas confirmadas sem enviar convite por e-mail, perfis, cartório fictício, seis cursos, PDF privado e desafio de exemplo. É limitado a Supabase explicitamente isolado. Senhas geradas ficam somente no arquivo privado; uma execução posterior usa as contas existentes e não redefine suas senhas. Usar seeding de novo sobrescreve esses recursos fictícios, por isso não executar durante uma aprovação em andamento.

O vídeo de teste do player é o vídeo público **Big Buck Bunny** do Vimeo (`1084537`, 597 segundos), sem vínculo com conteúdo da academia em produção.

Os E2E gravam XP, notas, progresso e tentativas nas contas dedicadas. Testes de desafios criam uma edição exclusiva e a excluem logicamente ao terminar; o histórico pode permanecer para auditoria. Não compartilhar uma conta que esteja sendo usada por um E2E durante sua execução.

## Publicação e segurança

- `.vercelignore` exclui envs locais, testes e artefatos de execução; publicar a partir de código versionado.
- Chave `service_role` existe apenas no servidor e nos secrets do CI; nunca colocar em `NEXT_PUBLIC_*`.
- Produção mantém a CSP sem `unsafe-eval`. O modo de desenvolvimento permite esse recurso porque o Next.js precisa dele para seu runtime local.
- Desafios não têm fallback local. Falha de Auth/API/schema deve ser corrigida no ambiente, sem simular tentativas ou crédito de XP.
- Rollout dos desafios: consultar `supabase/periodic-quizzes-rollout.md` e o SQL de verificação de schema antes/depois.
- Em falha da aplicação, preservar tentativas e XP e publicar uma versão compatível; não reverter migrations destrutivamente.

## Base desta entrega

A branch de homologação foi preparada a partir do checkout `feat/security-hardening`, cujo HEAD `4ff505c` estava um commit à frente de `origin/main`. Portanto uma integração desta entrega em `main` também inclui esse reforço de segurança existente, além das etapas 1–4 dos desafios, revisão integrada e configuração de homologação. Conferir esse conjunto no diff antes da aprovação de produção.
