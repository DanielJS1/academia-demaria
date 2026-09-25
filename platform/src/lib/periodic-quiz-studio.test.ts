import { describe, expect, it } from "vitest";
import { fromStudioQuestions, toStudioQuestions, type PeriodicQuizQuestion } from "./periodic-quiz-studio";

const question: PeriodicQuizQuestion = {
  prompt: "Qual alternativa está correta?", options: [{ id: "x", text: "Primeira" }, { id: "y", text: "Segunda" }, { id: "z", text: "Terceira" }],
  correctOptionId: "z", explanation: "A terceira alternativa é a correta.",
  imageUrl: "https://example.com/apoio.png", imageAlt: "Diagrama de apoio",
};

describe("Question Studio dos desafios", () => {
  it("preserva gabarito, explicação e imagem ao adaptar IDs de alternativas", () => {
    const [restored] = fromStudioQuestions(toStudioQuestions([question]));
    expect(restored.correctOptionId).toBe("c");
    expect(restored.options.find(option => option.id === restored.correctOptionId)?.text).toBe("Terceira");
    expect(restored).toMatchObject({ prompt: question.prompt, explanation: question.explanation, imageUrl: question.imageUrl, imageAlt: question.imageAlt });
  });
  it("mantém a alternativa correta depois de remover e reordenar outras opções", () => {
    const [studio] = toStudioQuestions([question]);
    studio.options = ["Terceira", "Segunda"];
    expect(fromStudioQuestions([studio])[0].correctOptionId).toBe("a");
  });
  it("não atribui um gabarito quando a resposta correta foi removida", () => {
    const [studio] = toStudioQuestions([question]);
    studio.options = ["Primeira", "Segunda"];
    expect(fromStudioQuestions([studio])[0].correctOptionId).toBe("");
  });
});
