import { describe, expect, it } from "vitest";
import { initialState } from "./seed";
import { completeActivity, courseProgress, publishReview, stateSchema, vimeoEmbed, type Attempt } from "./model";
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
});
