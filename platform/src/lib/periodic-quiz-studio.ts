import type { Question } from "./model";

export type PeriodicQuizQuestion = {
  id?: string; prompt: string; options: { id: string; text: string }[]; correctOptionId: string;
  explanation: string; imageUrl: string; imageAlt: string;
};
type StudioQuestion = Question & { explanation?: string; imageUrl?: string; imageAlt?: string;
  periodicOptions?: { id: string; text: string }[]; periodicCorrectOptionId?: string };

export function toStudioQuestions(questions: PeriodicQuizQuestion[]): StudioQuestion[] {
  return questions.map(question => ({
    id: question.id ?? crypto.randomUUID(), periodicOptions: question.options, periodicCorrectOptionId: question.correctOptionId,
    prompt: question.prompt, type: "choice", multiple: false,
    options: question.options.map(option => option.text),
    correct: question.options.find(option => option.id === question.correctOptionId)?.text ?? "",
    explanation: question.explanation, imageUrl: question.imageUrl, imageAlt: question.imageAlt,
  }));
}

export function fromStudioQuestions(questions: StudioQuestion[]): PeriodicQuizQuestion[] {
  return questions.map(question => {
    const originals = question.periodicOptions ?? [];
    const used = new Set<string>();
    const retained = question.options.map(text => {
      const original = originals.find(option => option.text === text && !used.has(option.id));
      if (original) used.add(original.id);
      return original?.id;
    });
    const options = question.options.map((text, index) => {
      const id = retained[index] ?? "abcdef".split("").find(candidate => !used.has(candidate))!;
      used.add(id);
      return { id, text };
    });
    const originalCorrect = options.find(option => option.id === question.periodicCorrectOptionId && option.text === question.correct);
    return { id: question.id, prompt: question.prompt, options,
      correctOptionId: originalCorrect?.id ?? options.find(option => option.text === question.correct)?.id ?? "",
      explanation: question.explanation ?? "", imageUrl: question.imageUrl ?? "", imageAlt: question.imageAlt ?? "" };
  });
}
