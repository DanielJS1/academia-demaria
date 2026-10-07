import type { database, Profile } from "./pilot-server";
import { quizAdminDatabaseError } from "./quiz-admin-errors";
import { quizNoticesSchema } from "./quiz-notifications";

export async function readQuizNotifications(db: ReturnType<typeof database>, me: Profile) {
  const { data, error } = await db.rpc("academy_read_quiz_notifications", { actor: me.id });
  if (error) throw quizAdminDatabaseError(error, "read-notifications");
  return quizNoticesSchema.parse(data);
}
export async function setQuizNotifications(db: ReturnType<typeof database>, me: Profile, enabled: boolean) {
  const { error } = await db.rpc("academy_set_quiz_notifications", { actor: me.id, enabled });
  if (error) throw quizAdminDatabaseError(error, "set-notifications");
}
