# E2E em staging

Execute em `platform/` com `pnpm test:e2e`. A suíte exige uma implantação de staging com as migrações recentes aplicadas, Vimeo incorporável e as seguintes variáveis. O comando falha quando `E2E_BASE_URL` não está definido; não aponta implicitamente para produção.

| Variável | Uso |
| --- | --- |
| `E2E_BASE_URL` | URL HTTPS da implantação de staging |
| `E2E_COLABORADOR_EMAIL`, `E2E_COLABORADOR_PASSWORD` | Conta interna ativa com perfil `student` |
| `E2E_GESTOR_EMAIL`, `E2E_GESTOR_PASSWORD` | Conta interna ativa com perfil `manager` |
| `E2E_CARTORIO_EMAIL`, `E2E_CARTORIO_PASSWORD` | Conta cliente ativa vinculada a cartório |
| `E2E_INTERNAL_COURSE_ID` | Curso publicado com audiência `internal` |
| `E2E_VIDEO_COURSE_ID` | Curso cuja primeira aula é vídeo Vimeo incorporável de pelo menos 2 minutos |
| `E2E_XP_COURSE_ID` | Curso publicado com leitura; use título de aula exclusivo para contar XP |
| `E2E_ATTACHMENT_COURSE_ID` | Curso publicado com leitura e PDF no bucket privado |
| `E2E_NOTES_COURSE_ID` | Curso publicado com leitura e bloco de notas |

Use dados dedicados: os testes gravam progresso, XP e uma anotação. As contas e cursos precisam estar acessíveis apenas no staging. Configure `E2E_BASE_URL` e os IDs como GitHub Actions variables e as credenciais como secrets. As contas de colaborador e cartório devem permanecer distintas. O workflow executa `typecheck`, Vitest e Playwright sem ignorar falhas. Para impedir o merge no GitHub, marque os checks `Semgrep SAST & Secrets Scan` e `Types, Vitest and Playwright` como obrigatórios nas regras da branch `main` (e `dev`, caso receba PRs).
