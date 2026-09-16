# 🤖 CODEX_CONTEXT.md — Resumo para OpenAI Codex / ChatGPT

Copie este texto e cole na conversa com o GPT/Codex quando precisar que ele trabalhe no DOC-Academy:

---

> **Contexto Atualizado do DOC-Academy (DeMaria):**
> 
> - **Stack:** Next.js (App Router), React 19, TypeScript, Supabase (PostgreSQL + RLS + Storage), Tailwind v4 + CSS Modules em `platform/src/styles/`.
> - **Documentação Completa:** Consulte `ARCHITECTURE.md` para fluxos e `AGENTS.md` para regras de economia de tokens.
> 
> **Módulos Chave e Localizações:**
> 1. **Modelos Zod:** `platform/src/lib/model.ts` (possui `courseSchema` com `logoUrl?: string`, `lessonSchema` com `attachmentPath`, `attemptSchema`, `personSchema`).
> 2. **Arte e Cards de Curso:** `platform/src/components/shared.tsx` (`CourseArt` renderiza `"DOC-Academy"` e o logo PNG customizado `course.logoUrl` no lugar das folhas quando fornecido).
> 3. **Editor de Cursos:** `platform/src/components/editors/course-editor.tsx` (permite editar título, descrição, banner, logo PNG central, aulas, anexos PDF e avaliações com prévia imediata).
> 4. **Sala de Aula / Player:** `platform/src/components/classroom.tsx` e `platform/src/components/vimeo-lesson.tsx` (suporta modo foco para expandir vídeo/leitura, acompanhamento de conclusão e anexos PDF via `platform/src/components/lesson-pdf.tsx`).
> 5. **Gestão de Usuários e Aprovação:** `platform/src/components/admin/admin-people.tsx` (aprovar com 1 clique, reprovar cadastro pendente ou excluir usuário).
> 6. **Cadastro Seguro:** `platform/src/app/api/auth/register/route.ts` (restrito a `@demaria.com.br` e `@sacdemaria.com.br`, 12 setores oficiais, cria perfil `pending` para aprovação do admin).
> 7. **Segurança Automatizada:** `.github/workflows/security.yml` executa scan do Semgrep (OWASP/CWE/Secrets) no GitHub Actions.
> 
> **Instrução para você (Codex):** Realize apenas edições cirúrgicas e modulares nos arquivos específicos, sem reescrever arquivos inteiros.

---
