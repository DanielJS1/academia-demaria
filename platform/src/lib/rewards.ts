import { courseProgress, type AcademyState, type Course } from "./model";

export const COURSE_BONUS = 30;
export const APPROVAL_BONUS = 30;
export const RETRY_BONUS = 10;
export const isCourseComplete = (course: Course, state: AcademyState, userId: string) =>
  course.questions.length
    ? state.attempts.some(a => a.courseId === course.id && a.courseVersion === course.version && a.userId === userId && a.status === "approved")
    : courseProgress(course, state.completed[course.id] || []) === 100;
export const lessonXp = (minutes: number) => 10 + 5 * Math.max(1, Math.ceil(minutes / 5));
export const courseXp = (course: Pick<Course, "lessons" | "questions">) =>
  course.lessons.filter(l => l.type !== "quiz").reduce((sum, l) => sum + lessonXp(l.minutes), 0)
  + COURSE_BONUS + (course.questions.length ? APPROVAL_BONUS : 0)
  + course.questions.reduce((sum, q) => sum + (q.type === "choice" ? 5 : 8), 0);
