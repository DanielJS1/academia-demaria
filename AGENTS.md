# AGENTS.md — Diretrizes para OpenAI Codex & Assistentes de IA

Este documento orienta assistentes de IA (Codex, Copilot, etc.) a trabalhar no **DOC-Academy** com máxima eficiência e consumo mínimo de tokens.

---

## 1. Arquitetura e Stack
- **Framework:** Next.js (App Router), React 19, TypeScript.
- **Backend & Banco de Dados:** Supabase (Auth, PostgreSQL, Row Level Security, Storage).
- **Estilização:** Tailwind CSS v4 + módulos CSS temáticos em `platform/src/styles/`.
- **Validação de Dados:** Zod schemas centralizados em `platform/src/lib/model.ts` e contratos em `platform/src/lib/pilot-contract.ts`.
- **Estado da Aplicação:** `AcademyProvider` (`platform/src/components/academy-provider.tsx`) conectado à API Supabase (`/api/academy`) com fallback local.

---

## 2. Mapa dos Menus e Telas
O app principal reside dentro da pasta `platform/`:
- **Início / Dashboard:** `platform/src/components/dashboard.tsx` (rota `/`)
- **Aprender / Catálogo:** `platform/src/components/catalog.tsx` (rota `/aprender`)
- **Sala de Aula / Player:** `platform/src/components/classroom.tsx` e `platform/src/components/vimeo-lesson.tsx` (rota `/aprender/[id]/aula`)
- **Base de Conhecimento:** `platform/src/components/knowledge.tsx` (rota `/conhecimento`)
- **Conquistas / Evolução:** `platform/src/components/evolution.tsx` (rota `/conquistas`)
- **Equipe:** `platform/src/components/team.tsx` (rota `/equipe`)
- **Painel de Administração:** `platform/src/components/admin/` (rota `/admin`)
  - Cursos: `src/components/admin/admin-courses.tsx`
  - Artigos: `src/components/admin/admin-articles.tsx`
  - Pessoas (Aprovação/Reprovação/Exclusão): `src/components/admin/admin-people.tsx`
  - Correções de Provas: `src/components/admin/admin-reviews.tsx`
  - Configurações: `src/components/admin/admin-config.tsx`
- **Editores de Recursos:** `platform/src/components/editors/` (rota `/admin/[kind]/[id]`)
  - Curso & Banners/Logos: `src/components/editors/course-editor.tsx`
  - Avaliação por Atividade: `src/components/editors/activity-questions.tsx`
  - Anexos PDF de Aula: `src/components/editors/pdf-attachment-editor.tsx`
- **Acesso / Login:** `platform/src/app/acesso/page.tsx` (rota `/acesso`)

---

## 3. Regras de Ouro para Economizar Tokens
1. **Edição Cirúrgica:** Nunca reescreva um arquivo inteiro quando for alterar apenas uma função ou elemento JSX. Utilize diffs mínimos.
2. **Componentes Modulares:** Edite os submódulos específicos em `src/components/editors/` ou `src/components/admin/` em vez de carregar arquivos orquestradores completos.
3. **Estilos Específicos:** Ao mexer em estilos, edite apenas a folha correspondente em `platform/src/styles/` (ex: `classroom.css`, `cards.css`, `navigation.css`), nunca altere tudo de uma vez.
4. **Respostas Concisas:** Responda direto ao ponto com o código alterado. Evite explicações redundantes sobre o que o código faz.
5. **Consulte ARCHITECTURE.md:** Para entender o fluxo completo de dados e regras de negócio antes de propor refatorações.
