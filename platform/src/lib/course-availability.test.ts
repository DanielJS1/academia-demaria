import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { initialState } from "./seed";
import { courseValidationError } from "./course-activities";
import { courseSchema, getCourseAvailability, isCourseActive } from "./model";

const admin = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const course = { ...initialState.courses[0], id: "availability-course", questions: [],
  lessons: [{ id: "reading", title: "Leitura", module: "", type: "reading", content: "Conteúdo", minutes: 5, videoUrl: "" }] };
let db: PGlite;
const change = (availability: string, expectedAvailability = "active", actor = admin, courseId = course.id, expectedVersion = 1) =>
  db.query("select academy_set_course_availability($1::uuid,$2::jsonb)", [actor, JSON.stringify({ courseId, availability, expectedAvailability, expectedVersion })]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])");
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter(name => name.endsWith(".sql") && (name <= "202609240005_private_article_files.sql" || name === "20260929130000_multiple_choice_quizzes.sql" || name.endsWith("_course_availability.sql"))).sort()) {
    await db.exec(readFileSync(new URL(name, dir), "utf8").replace(/^\uFEFF/, ""));
  }
  await db.query("insert into auth.users values($1),($2)", [admin, student]);
  await db.query("insert into academy_profiles(id,name,email,role) values($1,'Admin','admin@example.test','admin'),($2,'Aluno','student@example.test','student')", [admin, student]);
}, 30000);
afterAll(async () => { await db?.close(); });

describe("disponibilidade dos cursos", () => {
  it("preserva cursos legados ativos e identifica rascunhos em desenvolvimento", () => {
    expect(isCourseActive(course)).toBe(true);
    expect(getCourseAvailability({ status: "draft" })).toBe("development");
  });
  it.each(["inactive", "development"] as const)("permite salvar %s sem aulas e sem vídeos prontos", availability => {
    expect(courseValidationError({ ...course, availability, lessons: [] }, true)).toBeNull();
    expect(courseValidationError({ ...course, availability, lessons: [{ ...course.lessons[0], type: "video", videoUrl: "" }] }, true)).toBeNull();
    expect(isCourseActive({ ...course, availability })).toBe(false);
  });
  it("exige aula válida para publicar um curso ativo", () => {
    expect(courseValidationError({ ...course, availability: "active", lessons: [] }, true)).toContain("Adicione ao menos uma aula");
    expect(courseSchema.safeParse({ ...course, availability: "unknown" }).success).toBe(false);
  });
  it("suspende e reativa sem perder edição, rascunho ou progresso", async () => {
    await db.query("insert into academy_resources(id,kind,published,draft,revision) values($1,'course',$2,$3,1)", [course.id, JSON.stringify(course), JSON.stringify({ ...course, status: "draft", title: "Alterações pendentes" })]);
    await db.query("insert into academy_progress(user_id,course_id,version,lesson_id,done) values($1,$2,1,'reading',true)", [student, course.id]);
    await expect(change("inactive", "active", student)).rejects.toThrow("Apenas administradores");
    await change("inactive");
    expect((await db.query<{ allowed: boolean }>("select academy_course_allowed($1,published) as allowed from academy_resources where id=$2", [student, course.id])).rows[0].allowed).toBe(false);
    await expect(db.query("select academy_mutate($1,$2)", [student, JSON.stringify({ type: "complete", courseId: course.id, version: 1, lessonId: "reading" })])).rejects.toThrow("Curso não autorizado");
    await expect(change("development", "active")).rejects.toThrow("outra sessão");
    await change("development", "inactive");
    await change("active", "development");
    const row = (await db.query<{ published: typeof course; draft: { availability: string; title: string }; revision: number }>("select * from academy_resources where id=$1", [course.id])).rows[0];
    expect(row.published).toEqual({ ...course, availability: "active" });
    expect(row.draft).toMatchObject({ title: "Alterações pendentes", availability: "active" });
    expect(row.revision).toBe(1);
    expect((await db.query("select * from academy_progress where course_id=$1 and done", [course.id])).rows).toHaveLength(1);
    expect((await db.query<{ allowed: boolean }>("select academy_course_allowed($1,published) as allowed from academy_resources where id=$2", [student, course.id])).rows[0].allowed).toBe(true);
  });
  it("permite marcar rascunhos vazios e impede sua ativação sem publicação", async () => {
    await db.query("insert into academy_resources(id,kind,draft) values('empty','course',$1)", [JSON.stringify({ ...course, id: "empty", status: "draft", lessons: [] })]);
    await change("inactive", "development", admin, "empty", 0);
    await expect(change("active", "inactive", admin, "empty", 0)).rejects.toThrow("Publique o curso");
    await expect(db.query("update academy_resources set draft=jsonb_set(draft,'{availability}','null') where id='empty'")).rejects.toThrow("academy_course_availability_valid");
  });
});
