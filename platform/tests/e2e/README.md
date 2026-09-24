# E2E em staging

Execute em `platform/` com `pnpm test:e2e`. A suíte exige um ambiente de homologação com as migrações recentes aplicadas, Vimeo incorporável e as seguintes variáveis. Localmente, use `E2E_BASE_URL=http://127.0.0.1:4174` com `pnpm dev`. No CI, o workflow inicia esse servidor e lê a configuração do Supabase dos secrets do repositório.

| Variável | Uso |
| --- | --- |
| `E2E_BASE_URL` | URL HTTPS de homologação ou localhost |
| `E2E_COLABORADOR_EMAIL`, `E2E_COLABORADOR_PASSWORD` | Conta interna ativa com perfil `student` |
| `E2E_GESTOR_EMAIL`, `E2E_GESTOR_PASSWORD` | Conta interna ativa com perfil `manager` |
| `E2E_CARTORIO_EMAIL`, `E2E_CARTORIO_PASSWORD` | Conta cliente ativa vinculada a cartório |
| `E2E_INTERNAL_COURSE_ID` | Curso publicado com audiência `internal` |
| `E2E_VIDEO_COURSE_ID` | Curso cuja primeira aula é vídeo Vimeo incorporável de pelo menos 2 minutos |
| `E2E_XP_COURSE_ID` | Curso publicado com leitura; use título de aula exclusivo para contar XP |
| `E2E_ATTACHMENT_COURSE_ID` | Curso publicado com leitura e PDF no bucket privado |
| `E2E_NOTES_COURSE_ID` | Curso publicado com leitura e bloco de notas |

Use dados dedicados: os testes gravam progresso, XP e uma anotação. Configure os IDs como GitHub Actions variables e as credenciais e chaves Supabase como secrets. As contas de colaborador e cartório devem permanecer distintas. O workflow executa `typecheck`, Vitest e Playwright sem ignorar falhas. Para impedir o merge no GitHub, marque os checks `Semgrep SAST & Secrets Scan` e `Types, Vitest and Playwright` como obrigatórios nas regras da branch `main` (e `dev`, caso receba PRs).
