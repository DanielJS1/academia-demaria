import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { courseSchema, normalizeStoredCourseLevel } from "./model";
import { commandSchema } from "./pilot-contract";
import { initialState } from "./seed";

const course = initialState.courses[0];
describe("classificação corporativa", () => {
  it.each(["essencial", "recomendado", "facultativo"])("aceita %s independentemente do destaque", level => {
    for (const required of [true, false]) {
      const data = { ...course, level, required };
      expect(courseSchema.parse(data)).toMatchObject({ level, required });
      expect(commandSchema.safeParse({ type: "save-resource", kind: "course", data, publish: true, expectedVersion: 1 }).success).toBe(true);
    }
  });
  it.each(["Essencial", "intermediario", "Intermediário", "avancado", "Avançado", "livre", "", null])("rejeita escrita de %s", level => {
    expect(courseSchema.safeParse({ ...course, level }).success).toBe(false);
    expect(commandSchema.safeParse({ type: "save-resource", kind: "course", data: { ...course, level }, publish: false, expectedVersion: 1 }).success).toBe(false);
  });
  it.each([
    ["Essencial", "essencial"], ["essencial", "essencial"],
    ["Intermediário", "recomendado"], ["intermediario", "recomendado"],
    ["Avançado", "facultativo"], ["avancado", "facultativo"],
    ["recomendado", "recomendado"], ["facultativo", "facultativo"],
  ])("normaliza leitura de %s", (legacy, expected) => {
    expect(normalizeStoredCourseLevel(legacy)).toBe(expected);
  });
  it("não converte silenciosamente classificações desconhecidas", () => {
    expect(() => normalizeStoredCourseLevel("desconhecido")).toThrow();
  });
  it("migra publicados e rascunhos, preserva destaque/revisão e impõe enum no banco", async () => {
    const db = new PGlite();
    try {
      await db.exec("create table academy_resources(id text primary key, kind text, published jsonb, draft jsonb, revision integer)");
      const legacy = ["Essencial", "essencial", "Intermediário", "intermediario", "Avançado", "avancado"];
      for (const [i, level] of legacy.entries()) {
        const value = { ...course, level, required: i % 2 === 0 };
        await db.query("insert into academy_resources values ($1, 'course', $2, $2, 3)", [String(i), JSON.stringify(value)]);
      }
      await db.exec("insert into academy_resources values ('article', 'article', '{}', null, 2), ('empty', 'course', null, null, 0)");
      await db.exec(readFileSync(new URL("../../supabase/migrations/20260929120000_course_classification.sql", import.meta.url), "utf8"));
      const { rows } = await db.query<{ id: string; published: typeof course; draft: typeof course; revision: number }>("select * from academy_resources where id not in ('article', 'empty') order by id");
      for (const [i, row] of rows.entries()) {
        const expected = { ...course, level: normalizeStoredCourseLevel(legacy[i]), required: i % 2 === 0 };
        expect(row.published).toEqual(expected);
        expect(row.draft).toEqual(expected);
        expect(row.revision).toBe(3);
      }
      for (const column of ["published", "draft"]) {
        for (const invalid of ['{"level":"intermediario"}', '{}', '{"level":null}']) {
          await expect(db.query(`update academy_resources set ${column}=$1 where id='0'`, [invalid])).rejects.toThrow(/academy_course_/);
        }
      }
    } finally { await db.close(); }
  }, 30000);
});
