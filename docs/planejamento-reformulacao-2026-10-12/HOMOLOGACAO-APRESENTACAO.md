# Homologação e apresentação

Ambiente: https://academia-demaria-homologacao.vercel.app

## Entrar na demonstração

Na tela de acesso, os atalhos **Administrador**, **Gestor**, **Colaborador** e **Cartório** iniciam uma sessão com perfis fictícios de apresentação, sem digitar senha. Use **Sair** para voltar à tela de acesso e trocar de perfil. Os perfis internos usam a massa de apresentação; o cliente usa um cartório fictício próprio.

Os atalhos exigem `DEMO_LOGIN_ENABLED=true` no projeto Vercel de homologação, `NEXT_PUBLIC_APP_ENV=homologacao` e o Supabase isolado `attnodzrjlhqydhrgqtr`. A API recusa produção mesmo que a flag seja habilitada por engano. As sessões são emitidas no servidor para uma lista fixa de contas ativas e o recurso não publica senhas nem envia emails.

Projeto Vercel `academia-demaria-homologacao` (`prj_ohoQgLGFpsXAt0yphtEcNaVSzP3t`), raiz `platform`, Node 24, conectado ao mesmo repositório e branch `main` de produção. Ambos foram conferidos em `bdd0f0806a5522c0d39593547dc25a1eaeaf37a1`, com deploy READY. Assim, correções integradas em main publicam nos dois ambientes. O build de homologação recebe `NEXT_PUBLIC_APP_ENV=homologacao` e exibe identificação própria.

Supabase exclusivo: `attnodzrjlhqydhrgqtr`. As 40 tabelas `academy_*` existem nos dois projetos; a migração de eventos analíticos foi aplicada em ambos. Segredos, sessões e dados de produção não foram copiados. Não se configuraram canais externos de email/Discord na homologação; políticas demo mantêm esses envios desligados. Integrações externas exigem credenciais de teste próprias para serem homologadas.

## Massa fictícia

A conferência detalhada também detectou a rotina legada de reconhecimento em produção. A migração de idempotência que já existia em homologação foi aplicada em produção. Após essa correção, as definições de colunas e as 41 rotinas `academy_*` foram comparadas, desconsiderando espaços em seus corpos. O contrato de reconhecimento agora é o mesmo nos dois ambientes.

151 contas novas: administrador, seis gestores e 144 colaboradores. São 127 contas ativas no total, 12 inativas e 12 pendentes. Quatro contas E2E preexistentes foram preservadas, totalizando 155 perfis. Setores: Suporte, Desenvolvimento, Comercial, Recursos Humanos, Financeiro e Operações; administrador em Diretoria.

As contas usam nomes marcados com `(Demo)` e endereços `demo.*@demaria.com.br`, criados diretamente pelo administrador Auth sem convites ou emails. Estes endereços são fictícios e não pressupõem caixas de correio reais.

| Fonte | Registros gerados |
| --- | ---: |
| Cursos novos | 18 |
| Trilhas / atribuições | 12 / 264 |
| Avaliações de cursos | 210 |
| Desafios / resultados oficiais | 4 / 300 |
| Artigos / comentários / reações atuais | 18 / 108 / 216 |
| Histórico diário de atividade | 3.534 |
| Eventos de XP | 1.746 |
| PDIs / reconhecimentos | 120 / 30 |
| Anotações de aula | 132 |

Inclui pessoas sem acesso recente, baixa frequência, prazos vencidos e futuros, cursos não iniciados, em progresso, aprovados, aguardando correção e para refazer; também aprovação por proficiência e XP de temporada anterior. Recursos de testes já existentes permanecem disponíveis.

Datas são simuladas em relação ao dia da carga. Somente neste banco de demonstração, o início de coleta foi situado 60 dias atrás, permitindo explorar gráficos de período. Esses registros não representam telemetria real, e não alteram o início real de coleta da produção. Triggers analíticos continuam habilitados; eventos sintéticos e eventos produzidos por interações de apresentação coexistem. Os relatórios aplicam suas regras de deduplicação.

## Acessos e roteiro

Credenciais estão exclusivamente no arquivo local ignorado `platform/.env.demo-homologacao.local`: URL, emails de administrador/gestor/colaborador e senha. Não publicar esse arquivo, screenshots de senha ou estados de sessão. Os demais gestores usam `demo.gestor.2@demaria.com.br` até `demo.gestor.6@demaria.com.br`, com a mesma senha demo. A ordem segue a lista de setores acima.

1. Entrar como gestor de Suporte e abrir Minha Gestão: observar alertas, prazos e ficha operacional; consultar PDI e reconhecimento.
2. Abrir Relatórios e percorrer Visão geral, Presença, Aprendizagem, Desafios, Comunidade e XP; variar períodos e colaborador. Na aprendizagem, comparar cursos e avaliações.
3. Entrar como administrador e comparar setores; abrir Pessoas para visualizar ativos, inativos e pendentes. Os relatórios analíticos trabalham com equipe ativa, conforme contrato do produto.
4. Entrar como colaborador e explorar catálogo, Trilhas, conteúdo de aula, anotações, desafios disponíveis/históricos, Conhecimento e Conquistas.
5. Mostrar CSV/PDF após explorar as visualizações em tela; os mesmos filtros determinam a exportação.

## Manutenção e verificação

Na raiz do repositório, com Node 24 e dependências instaladas:

```powershell
node --test platform/scripts/presentation-data.test.mjs
node platform/scripts/seed-presentation-data.mjs
node platform/scripts/seed-presentation-data.mjs --apply
```

Sem `--apply`, apenas gera contagens em memória. A aplicação exige `.env.homologacao.local`, ref de isolamento correto e URL do Supabase de homologação; rejeita produção e destinos divergentes. IDs determinísticos permitem reaplicar a massa sem duplicar suas contas/fontes. A senha é salva antes da criação das contas para retomada após interrupção. Reaplicar restaura os cenários demo e desloca suas datas; faça isso antes da apresentação, não durante uma sessão. Não apaga perfis E2E nem recursos fora do namespace demo.

Manifesto e evidências locais: `output/homologacao-presentation/`. Os três testes do gerador passaram, incluindo bloqueio de produção. No domínio remoto, login de administrador/gestor/colaborador e as seis fontes de relatório foram consultados com sucesso; a equipe do gestor permaneceu no setor Suporte. Evidências de navegador cobrem Minha Gestão, Relatórios, Conhecimento, catálogo, Trilhas, desafios e Conquistas, incluindo viewport móvel.

Conferência visual adicional: seis visões de relatório efetivamente carregadas, com gráficos/tabelas e exportação habilitada; dois desafios históricos do colaborador responderam 200, e o acesso desse colaborador à API de relatórios foi recusado com 403. O gate Vimeo real também passou após a inclusão das ferramentas de apresentação.
