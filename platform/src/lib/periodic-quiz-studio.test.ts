import { describe, expect, it } from "vitest";
import { fromStudioQuestions, toStudioQuestions, type PeriodicQuizQuestion } from "./periodic-quiz-studio";

const question: PeriodicQuizQuestion = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", prompt: "Qual alternativa está correta?", options: [{ id: "x", text: "Primeira" }, { id: "y", text: "Segunda" }, { id: "z", text: "Terceira" }],
  correctOptionId: "z", explanation: "A terceira alternativa é a correta.",
  imageUrl: "https://example.com/apoio.png", imageAlt: "Diagrama de apoio",
};

describe("Question Studio dos desafios", () => {
  it("preserva gabarito, explicação e imagem e IDs ao passar pelo Studio", () => {
    const [restored] = fromStudioQuestions(toStudioQuestions([question]));
    expect(restored.correctOptionId).toBe("z");
    expect(restored.options.find(option => option.id === restored.correctOptionId)?.text).toBe("Terceira");
    expect(restored).toMatchObject({ id: question.id, options: question.options, prompt: question.prompt, explanation: question.explanation, imageUrl: question.imageUrl, imageAlt: question.imageAlt });
  });
  it("mantém a alternativa correta depois de remover e reordenar outras opções", () => {
    const [studio] = toStudioQuestions([question]);
    studio.options = ["Terceira", "Segunda"];
    expect(fromStudioQuestions([studio])[0].correctOptionId).toBe("z");
  });
  it("não atribui um gabarito quando a resposta correta foi removida", () => {
    const [studio] = toStudioQuestions([question]);
    studio.options = ["Primeira", "Segunda"];
    expect(fromStudioQuestions([studio])[0].correctOptionId).toBe("");
  });
  it("preserva o gabarito original quando alternativas têm o mesmo texto", () => {
    const duplicate = { ...question, options: [{ id: "a", text: "Igual" }, { id: "b", text: "Igual" }], correctOptionId: "b" };
    expect(fromStudioQuestions(toStudioQuestions([duplicate]))[0]).toEqual(duplicate);
  });
  it("atribui IDs distintos a novas opções mesmo com textos repetidos nas anteriores", () => {
    const duplicate = { ...question, options: "abcdef".split("").map(id => ({ id, text: "Igual" })), correctOptionId: "a" };
    const [studio] = toStudioQuestions([duplicate]);
    studio.options = ["Igual", "Nova 1", "Nova 2", "Nova 3", "Nova 4", "Nova 5"];
    expect(new Set(fromStudioQuestions([studio])[0].options.map(option => option.id)).size).toBe(6);
  });
});
