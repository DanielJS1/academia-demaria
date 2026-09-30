import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { initialState } from "./seed";
import { type Course, type Lesson } from "./model";

const admin = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";

let db: PGlite;
const cmd = (actor: string, command: unknown) =>
  db.query("select public.academy_mutate($1::uuid, $2::jsonb)", [actor, JSON.stringify(command)]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key);
    create role anon;
    create role authenticated;
    create role service_role;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  `);

  for (const name of [
    "202609150001_pilot.sql",
    "202609160001_learning_rewards.sql",
    "202609170001_activity_assessments.sql",
    "202609170002_fix_settings_where_clause.sql",
    "202609170003_cartorios_and_clients.sql",
    "202609170004_partial_reviews_and_proficiency.sql",
    "202609240006_video_progress.sql",
    "20260929130000_multiple_choice_quizzes.sql",
  ]) {
    const content = readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8").replace(/^\uFEFF/, "");
    await db.exec(content);
  }

  await db.query("insert into auth.users values ($1), ($2)", [admin, student]);
  await db.query(
    "insert into academy_profiles(id, name, email, role, status) values ($1, 'Admin', 'admin@example.test', 'admin', 'active'), ($2, 'Student', 'student@example.test', 'student', 'active')",
    [admin, student]
  );
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe("avaliações com questões de múltipla escolha (multiple: true)", () => {
  it("aceita respostas válidas em questões com múltiplas alternativas e rejeita alternativas desconhecidas", async () => {
    const course: Course = {
      ...initialState.courses[0],
      id: "course-multi",
      version: 1,
      retryPolicy: "free",
      questions: [],
      lessons: [
        {
          id: "r1",
          title: "Leitura preparatória",
          module: "",
          type: "reading",
          minutes: 5,
          content: "Conteúdo",
          videoUrl: "",
        },
        {
          id: "q1",
          title: "Prova com múltipla escolha",
          module: "",
          type: "quiz",
          minutes: 10,
          content: "",
          videoUrl: "",
          questions: [
            {
              id: "single-1",
              prompt: "Escolha única",
              type: "choice",
              multiple: false,
              options: ["Opção A", "Opção B", "Opção C"],
              correct: "Opção A",
            },
            {
              id: "multi-1",
              prompt: "Escolha múltipla",
              type: "choice",
              multiple: true,
              options: ["Item 1", "Item 2", "Item 3", "Item 4"],
              correct: JSON.stringify(["Item 1", "Item 3"]),
            },
          ],
        },
      ],
    };

    await cmd(admin, { type: "save-resource", kind: "course", data: course, publish: true, expectedVersion: 0 });
    await cmd(student, { type: "complete", courseId: course.id, version: 1, lessonId: "r1" });

    // 1. Alternativa desconhecida em múltipla escolha deve disparar 'Alternativa inválida'
    await expect(
      cmd(student, {
        type: "submit",
        courseId: course.id,
        version: 1,
        quizId: "q1",
        answers: {
          "single-1": "Opção A",
          "multi-1": JSON.stringify(["Item 1", "Opção Inexistente"]),
        },
      })
    ).rejects.toThrow("Alternativa inválida");

    // 2. Formato não-JSON ou vazio deve disparar 'Alternativa inválida'
    await expect(
      cmd(student, {
        type: "submit",
        courseId: course.id,
        version: 1,
        quizId: "q1",
        answers: {
          "single-1": "Opção A",
          "multi-1": "Item 1", // string crua em vez de array serializado
        },
      })
    ).rejects.toThrow("Alternativa inválida");

    // 3. Array válido com itens pertencentes a options deve ser aceito com sucesso
    await cmd(student, {
      type: "submit",
      courseId: course.id,
      version: 1,
      quizId: "q1",
      answers: {
        "single-1": "Opção A",
        "multi-1": JSON.stringify(["Item 1", "Item 3"]),
      },
    });

    const attempt = (await db.query<{ id: string }>("select id from academy_attempts where user_id=$1 and quiz_id='q1'", [student])).rows[0];
    expect(attempt).toBeDefined();

    // 4. Correção pelo admin deve validar acerto de múltipla escolha e conceder +5 XP
    await cmd(admin, {
      type: "review",
      id: attempt.id,
      score: 100,
      feedback: "Perfeito!",
      correctTextIds: [],
    });

    const xpRows = (await db.query<{ event_key: string; amount: number }>("select event_key, amount from academy_xp where user_id=$1", [student])).rows;
    expect(xpRows.some(x => x.event_key === "question:single-1" && Number(x.amount) === 5)).toBe(true);
    expect(xpRows.some(x => x.event_key === "question:multi-1" && Number(x.amount) === 5)).toBe(true);
  });
});
