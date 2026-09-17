import { describe, expect, it } from "vitest";
import { initialState } from "./seed";
import { completeActivity, courseProgress, getCartorioLessons, isCourseAvailableForCartorio, publishReview, stateSchema, vimeoEmbed, type Attempt } from "./model";
import { experience } from "./gamification";

describe("regras da demonstração", () => {
  it("não duplica conclusão nem conclui avaliação como aula", () => {
    const course = initialState.courses[0];
    const lesson = course.lessons.find(item => item.type !== "quiz")!;
    const state = completeActivity(initialState, course.id, lesson.id);
    expect(completeActivity(state, course.id, lesson.id)).toBe(state);
    expect(completeActivity(state, course.id, "inexistente")).toBe(state);
    expect(courseProgress(course, ["inexistente"])).toBe(0);
  });
  it("preserva a nota mínima da tentativa e concede XP uma única vez", () => {
    const course = initialState.courses[0];
    const attempt: Attempt = { id: "test", courseId: course.id, courseTitle: course.title, courseVersion: 1, questions: [], answers: {}, status: "pending", feedback: "", score: null, passingScore: 70, xp: 200, submittedAt: "2026-09-15", retryPolicy: "review", retryAllowed: false };
    const state = { ...initialState, attempts: [attempt] };
    expect(publishReview(state, "test", NaN, "")).toBe(state);
    const approved = publishReview(state, "test", 80, "Muito bem");
    expect(approved.attempts[0].status).toBe("approved");
    expect(approved.xpEvents.length).toBe(state.xpEvents.length + 1);
    expect(publishReview(approved, "test", 100, "")).toBe(approved);
    const repeat = publishReview({ ...approved, attempts: [{ ...attempt, id: "second" }] }, "second", 100, "");
    expect(repeat.xpEvents).toEqual(approved.xpEvents);
    expect(publishReview(state, "test", 60, "Revisar").completed[course.id]).toEqual([]);
  });
  it("separa experiência histórica da temporada", () => {
    const state = { ...initialState, xpEvents: [{ id: "old", amount: 5000, season: "2025", label: "Histórico" }] };
    expect(experience(state).total).toBe(5000);
    expect(experience(state).tier.name).toBe("Bronze");
  });
  it("valida dados persistidos e aceita versões sem rascunhos", () => {
    expect(stateSchema.safeParse(initialState).success).toBe(true);
    expect(stateSchema.parse({ ...initialState, courseDrafts: undefined }).courseDrafts).toEqual([]);
    expect(stateSchema.safeParse({ schema: 1 }).success).toBe(false);
  });
  it("aceita somente vídeos Vimeo HTTPS e preserva hash privado", () => {
    expect(vimeoEmbed("https://vimeo.com/123456/abc123")).toBe("https://player.vimeo.com/video/123456?h=abc123");
    expect(vimeoEmbed("https://vimeo.com.evil.example/123")).toBeNull();
    expect(vimeoEmbed("javascript:alert(1)")).toBeNull();
    expect(vimeoEmbed("http://vimeo.com/123")).toBeNull();
  });
  it("filtra cursos por módulos contratados do cartório", () => {
    const mockCartorio = {
      id: "cart-teste",
      name: "1º Oficial de Registro",
      code: "12345",
      uf: "SP" as const,
      city: "Santos",
      modules: ["WIN:C", "WIN:E", "AOL:D"],
      createdAt: "2026-09-17",
      updatedAt: "2026-09-17",
    };
    const internalCourse = { ...initialState.courses[0], audience: "internal" as const };
    const matchingCourse = { ...initialState.courses[0], audience: "client" as const, requiredModules: ["WIN:C"] };
    const nonMatchingCourse = { ...initialState.courses[0], audience: "client" as const, requiredModules: ["ESP:0"] };
    const openCourse = { ...initialState.courses[0], audience: "both" as const, requiredModules: [] };

    expect(isCourseAvailableForCartorio(internalCourse, mockCartorio)).toBe(false);
    expect(isCourseAvailableForCartorio(matchingCourse, mockCartorio)).toBe(true);
    expect(isCourseAvailableForCartorio(nonMatchingCourse, mockCartorio)).toBe(false);
    expect(isCourseAvailableForCartorio(openCourse, mockCartorio)).toBe(true);
  });
  it("isola aulas por UF para Selagem mantendo aulas comuns", () => {
    const courseWithUfLessons = {
      ...initialState.courses[0],
      lessons: [
        { id: "intro", title: "Introdução Comum", module: "Geral", content: "", videoUrl: "", minutes: 5, type: "video" as const, vimeoUrl: "https://vimeo.com/1" },
        { id: "selagem-sp", title: "Selagem SP", module: "Geral", content: "", videoUrl: "", minutes: 10, type: "video" as const, vimeoUrl: "https://vimeo.com/2", ufFilter: ["SP"] },
        { id: "selagem-rj", title: "Selagem RJ", module: "Geral", content: "", videoUrl: "", minutes: 10, type: "video" as const, vimeoUrl: "https://vimeo.com/3", ufFilter: ["RJ"] },
      ],
    };

    const spLessons = getCartorioLessons(courseWithUfLessons, "SP");
    expect(spLessons.map(l => l.id)).toEqual(["intro", "selagem-sp"]);

    const rjLessons = getCartorioLessons(courseWithUfLessons, "RJ");
    expect(rjLessons.map(l => l.id)).toEqual(["intro", "selagem-rj"]);

    // Progresso calcula sobre as aulas visíveis do estado
    expect(courseProgress(courseWithUfLessons, ["intro", "selagem-sp"], "SP")).toBe(100);
    expect(courseProgress(courseWithUfLessons, ["intro"], "SP")).toBe(50);
  });
});
