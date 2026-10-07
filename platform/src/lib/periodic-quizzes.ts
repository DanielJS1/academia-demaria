import { z } from "zod";

const optionSchema = z.object({ id: z.string().regex(/^[a-z0-9_-]{1,12}$/), text: z.string().trim().min(1).max(500) }).strict();
export const periodicQuizQuestionSchema = z.object({
  id: z.uuid().optional(), prompt: z.string().trim().min(5).max(3000), options: z.array(optionSchema).min(2).max(6),
  correctOptionId: z.string().min(1).max(12), explanation: z.string().trim().min(5).max(3000),
  imageUrl: z.union([z.url().startsWith("https://"), z.literal("")]).default(""), imageAlt: z.string().trim().max(300).default(""),
}).strict().superRefine((question, context) => {
  const ids = question.options.map(option => option.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Alternativas repetidas." });
  if (!ids.includes(question.correctOptionId)) context.addIssue({ code: "custom", message: "Escolha um gabarito válido." });
  if (question.imageUrl && !question.imageAlt) context.addIssue({ code: "custom", message: "Descreva a imagem de apoio." });
});
export const periodicQuizDraftSchema = z.object({
  id: z.uuid().optional(), expectedRevision: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  description: z.string().trim().max(2000), category: z.enum(["legislacao", "sistema", "suporte", "pro", "fiscal"]),
  xpReward: z.number().int().min(0).max(500), passingScore: z.number().int().min(0).max(100),
  periodType: z.enum(["weekly", "biweekly", "monthly"]), targetAudience: z.enum(["internal", "client"]),
  isActive: z.boolean(), isFeatured: z.boolean(), availableFrom: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(), questions: z.array(periodicQuizQuestionSchema).min(2).max(30),
}).strict().superRefine((value, context) => {
  if (value.expiresAt && Date.parse(value.expiresAt) <= Date.parse(value.availableFrom))
    context.addIssue({ code: "custom", message: "O prazo final precisa ser posterior à liberação.", path: ["expiresAt"] });
  const ids = value.questions.flatMap(question => question.id ? [question.id] : []);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Perguntas repetidas." });
});
export const periodicQuizSubmissionSchema = z.object({
  answers: z.record(z.uuid(), z.string().min(1).max(40)), expectedRevision: z.number().int().positive().optional(),
}).strict();
export const periodicQuizStatusSchema = z.object({ id: z.uuid(), active: z.boolean(), expectedRevision: z.number().int().positive().optional() }).strict();
export const periodicQuizDeleteSchema = periodicQuizStatusSchema.omit({ active: true });

export function requiredCorrect(questionCount: number, passingScore: number) {
  return Math.ceil(questionCount * passingScore / 100);
}

const publicQuestionSchema = z.object({ id: z.uuid(), prompt: z.string(), options: z.array(optionSchema),
  image_url: z.string().nullable(), image_alt: z.string().nullable() });
export const periodicQuizSchema = z.object({ id: z.uuid(), title: z.string(), description: z.string(), category: z.string(),
  xp_reward: z.number(), passing_score: z.number(), revision: z.number(), questions: z.array(publicQuestionSchema) });
export const periodicQuizResultSchema = z.object({
  attemptId: z.uuid(), scorePercentage: z.number(), passed: z.boolean(), xpGranted: z.number(), newlyGrantedXp: z.number(),
  correctCount: z.number().nullable(), questionCount: z.number().nullable(), passingScore: z.number().nullable(), xpReward: z.number().nullable(),
  revision: z.number().nullable(), scoringVersion: z.number(), completedAt: z.string(), replayed: z.boolean(), reviewAvailable: z.boolean(),
  results: z.array(z.object({ questionId: z.uuid(), selectedOptionId: z.string(), correctOptionId: z.string(), correct: z.boolean(), explanation: z.string() })),
});
export const periodicQuizDetailSchema = z.object({ quiz: periodicQuizSchema.nullable(), result: periodicQuizResultSchema.nullable() });
export const periodicQuizSummarySchema = z.object({ id: z.uuid(), title: z.string(), description: z.string(), category: z.string(),
  xp_reward: z.number(), passing_score: z.number(), revision: z.number(), period_type: z.string(), is_featured: z.boolean(),
  available_from: z.string(), expires_at: z.string().nullable(), questionCount: z.number(), requiredCorrect: z.number() });
export const periodicQuizListSchema = z.object({ available: z.array(periodicQuizSummarySchema),
  completed: z.array(z.object({ id: z.uuid(), title: z.string(), result: periodicQuizResultSchema.omit({ results: true }) })) });
export type PeriodicQuiz = z.infer<typeof periodicQuizSchema>;
export type PeriodicQuizResult = z.infer<typeof periodicQuizResultSchema>;
export type PeriodicQuizDetail = z.infer<typeof periodicQuizDetailSchema>;
export type PeriodicQuizList = z.infer<typeof periodicQuizListSchema>;
