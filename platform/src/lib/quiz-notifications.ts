import { z } from "zod";
import { notificationSchema, quizNotificationPreferenceSchema, type Notification } from "./model";

export const quizNoticesSchema = z.object({
  userId: z.string().uuid(), quizNotifications: quizNotificationPreferenceSchema,
  readNotices: z.array(z.string()), notifications: z.array(notificationSchema),
});
export type QuizNotices = z.infer<typeof quizNoticesSchema>;
export function mergeQuizNotices(existing: Notification[], incoming: Notification[]) {
  return [...new Map([...existing.filter(item => !item.id.startsWith("quiz-published:")), ...incoming].map(item => [item.id, item])).values()];
}
