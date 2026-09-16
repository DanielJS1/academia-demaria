import { z } from "zod";

export const questionSchema = z.object({ id: z.string(), prompt: z.string().min(1), type: z.enum(["choice", "text"]), options: z.array(z.string()), correct: z.string() });
export const lessonSchema = z.object({ id: z.string(), title: z.string().min(1), module: z.string(), minutes: z.number().nonnegative(), type: z.enum(["video", "reading", "quiz"]), content: z.string(), videoUrl: z.string(), questions: z.array(questionSchema).optional(), attachmentPath: z.string().regex(/^pdf\/[a-f0-9-]+\.pdf$/).optional(), attachmentName: z.string().max(200).optional() });
export const courseSchema = z.object({
  id: z.string(), title: z.string().min(3).max(120), description: z.string(), product: z.string().min(1), category: z.string(), level: z.string(),
  accent: z.enum(["violet", "mint", "peach", "blue", "pink", "slate"]), status: z.enum(["draft", "published"]),
  xp: z.number().int().min(0).max(10000), required: z.boolean(), banner: z.string(), author: z.string(),
  lessons: z.array(lessonSchema), questions: z.array(questionSchema), passingScore: z.number().int().min(0).max(100),
  retryPolicy: z.enum(["free", "review", "admin"]), version: z.number().int().positive(),
});
export const articleSchema = z.object({ id: z.string(), title: z.string().min(3), product: z.string(), category: z.string(), content: z.string(), status: z.enum(["draft", "published"]), revision: z.number().int().positive(), updatedAt: z.string(), author: z.string() });
export const personSchema = z.object({ id: z.string(), name: z.string().min(2), email: z.union([z.string().email(), z.literal("")]), department: z.string(), managerId: z.string(), role: z.enum(["student", "manager", "admin"]), status: z.enum(["active", "pending", "inactive"]), xp: z.number().nonnegative(), progress: z.number().min(0).max(100) });
export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string().default(""),
  title: z.string(),
  message: z.string(),
  link: z.string().default(""),
  read: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export const attemptSchema = z.object({ id: z.string(), userId: z.string().optional(), courseId: z.string(), courseTitle: z.string(), courseVersion: z.number(), quizId: z.string().optional(), questions: z.array(questionSchema), answers: z.record(z.string(), z.string()), status: z.enum(["pending", "approved", "retry"]), feedback: z.string(), score: z.number().nullable(), passingScore: z.number(), xp: z.number(), submittedAt: z.string(), retryPolicy: z.enum(["free", "review", "admin"]).default("free"), retryAllowed: z.boolean().default(false), correctTextIds: z.array(z.string()).optional() });
export const stateSchema = z.object({
  schema: z.literal(1), courses: z.array(courseSchema), articles: z.array(articleSchema), people: z.array(personSchema),
  courseDrafts: z.array(courseSchema).default([]), articleDrafts: z.array(articleSchema).default([]),
  departments: z.array(z.string()), products: z.array(z.string()), completed: z.record(z.string(), z.array(z.string())),
  bookmarks: z.array(z.string()), attempts: z.array(attemptSchema), xpEvents: z.array(z.object({ id: z.string(), amount: z.number(), season: z.string(), label: z.string() })),
  readNotices: z.array(z.string()),
  notifications: z.array(notificationSchema).default([]),
});
export type Notification = z.infer<typeof notificationSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Person = z.infer<typeof personSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AcademyState = z.infer<typeof stateSchema>;

export function courseProgress(course: Course, completed: string[]) {
  const activities = course.lessons.filter(lesson => lesson.type !== "quiz");
  return activities.length ? Math.round(activities.filter(lesson => completed.includes(lesson.id)).length / activities.length * 100) : 0;
}
export const minutes = (course: Course) => course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
export function vimeoEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
    if (!match) return null;
    const hash = match[2] || parsed.searchParams.get("h");
    return `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${encodeURIComponent(hash)}` : ""}`;
  } catch { return null; }
}
export function safeImage(url: string) {
  if (!url) return true;
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}
export function completeActivity(state: AcademyState, courseId: string, lessonId: string): AcademyState {
  const lesson = state.courses.find(course => course.id === courseId)?.lessons.find(item => item.id === lessonId);
  if (!lesson || lesson.type === "quiz" || state.completed[courseId]?.includes(lessonId)) return state;
  return { ...state, completed: { ...state.completed, [courseId]: [...(state.completed[courseId] || []), lessonId] } };
}
export function publishReview(state: AcademyState, id: string, score: number, feedback: string): AcademyState {
  const attempt = state.attempts.find(item => item.id === id);
  if (!attempt || attempt.status !== "pending" || score < 0 || score > 100 || !Number.isFinite(score)) return state;
  const approved = score >= attempt.passingScore;
  const rewardId = `approval:${attempt.courseId}:initial`;
  const reward = approved && !state.xpEvents.some(event => event.id === rewardId);
  return {
    ...state,
    attempts: state.attempts.map(item => item.id === id ? { ...item, status: approved ? "approved" : "retry", score, feedback } : item),
    completed: !approved && attempt.retryPolicy === "review" ? { ...state.completed, [attempt.courseId]: [] } : state.completed,
    xpEvents: reward ? [...state.xpEvents, { id: rewardId, amount: attempt.xp, season: attempt.submittedAt.slice(0, 4), label: attempt.courseTitle }] : state.xpEvents,
    notifications: [
      {
        id: `rev-${id}-${Date.now()}`,
        userId: attempt.userId || "daniel",
        title: approved ? `Parabéns! Avaliação aprovada: ${attempt.courseTitle}` : `Avaliação corrigida: ${attempt.courseTitle}`,
        message: `Sua avaliação foi revisada com nota ${score}%. Clique para conferir o feedback.`,
        link: `/aprender/${attempt.courseId}/aula`,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...(state.notifications || []),
    ],
  };
}
