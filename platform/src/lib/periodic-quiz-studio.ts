import type { Question } from "./model";

export type PeriodicQuizQuestion = {
  prompt: string; options: { id: string; text: string }[]; correctOptionId: string;
  explanation: string; imageUrl: string; imageAlt: string;
};
type StudioQuestion = Question & { explanation?: string; imageUrl?: string; imageAlt?: string };

export function toStudioQuestions(questions: PeriodicQuizQuestion[]): StudioQuestion[] {
  return questions.map(question => ({
    id: crypto.randomUUID(), prompt: question.prompt, type: "choice", multiple: false,
    options: question.options.map(option => option.text),
    correct: question.options.find(option => option.id === question.correctOptionId)?.text ?? "",
    explanation: question.explanation, imageUrl: question.imageUrl, imageAlt: question.imageAlt,
  }));
}

export function fromStudioQuestions(questions: StudioQuestion[]): PeriodicQuizQuestion[] {
  return questions.map(question => {
    // The administrative RPC replaces unanswered quiz questions atomically.
    const options = question.options.map((text, index) => ({ id: String.fromCharCode(97 + index), text }));
    return { prompt: question.prompt, options,
      correctOptionId: options.find(option => option.text === question.correct)?.id ?? "",
      explanation: question.explanation ?? "", imageUrl: question.imageUrl ?? "", imageAlt: question.imageAlt ?? "" };
  });
}
