import { isCourseActive, type AcademyState, type Attempt, type Course } from "../model";
import { isCourseComplete } from "../rewards";
import { isInReportPeriod, type ResolvedReportPeriod } from "./periods";

export type LearningRecords = {
  completedByUser: Record<string, Record<string, string[]>>;
  attempts: readonly Attempt[];
};

/** The actor ID is explicit because AcademyState.completed belongs to that actor only. */
export function learningRecordsFromAcademy(state: Pick<AcademyState, "completed" | "teamProgress" | "attempts">, actorId: string): LearningRecords {
  return { completedByUser: { ...state.teamProgress, [actorId]: state.completed }, attempts: state.attempts };
}

export function percentage(numerator: number, denominator: number | null): number | null {
  if (!Number.isFinite(numerator) || numerator < 0 || (denominator !== null && (!Number.isFinite(denominator) || denominator < 0 || numerator > denominator))) throw new Error("Numerador ou denominador inválido.");
  return denominator === null || denominator === 0 ? null : numerator / denominator * 100;
}

export function courseLearningMetrics(course: Course, userId: string, records: LearningRecords) {
  const completed = records.completedByUser[userId]?.[course.id] ?? [];
  const lessons = course.lessons.filter(lesson => lesson.type !== "quiz");
  const completedIds = new Set(completed);
  const completedLessons = lessons.filter(lesson => completedIds.has(lesson.id)).length;
  const progress = percentage(completedLessons, lessons.length);
  const complete = isCourseComplete(course, {
    completed: { [course.id]: completed }, attempts: records.attempts.filter(attempt => attempt.userId === userId),
  }, userId);
  const status = complete ? "completed" : progress === 100 ? "awaiting_assessment" : completedLessons > 0 ? "in_progress" : "not_started";
  return { userId, courseId: course.id, courseVersion: course.version, completedLessons, totalLessons: lessons.length, progress, complete, status } as const;
}

export type CourseAssignment = { userId: string; active: boolean; courseIds: readonly string[] };
export function assignedCoursePairs(assignments: readonly CourseAssignment[], courses: readonly Course[], authorizedUserIds: ReadonlySet<string>) {
  const eligible = new Map(courses.filter(course => isCourseActive(course) && course.audience !== "client").map(course => [course.id, course]));
  const pairs = new Map<string, { id: string; userId: string; courseId: string; courseVersion: number }>();
  for (const assignment of assignments) {
    if (!assignment.active || !authorizedUserIds.has(assignment.userId)) continue;
    for (const courseId of assignment.courseIds) {
      const course = eligible.get(courseId);
      if (!course) continue;
      const id = JSON.stringify([assignment.userId, courseId, course.version]);
      pairs.set(id, { id, userId: assignment.userId, courseId, courseVersion: course.version });
    }
  }
  return [...pairs.values()];
}

export function assignedCompletion(assignments: readonly CourseAssignment[], courses: readonly Course[], authorizedUserIds: ReadonlySet<string>, records: LearningRecords) {
  const pairs = assignedCoursePairs(assignments, courses, authorizedUserIds);
  const byId = new Map(courses.map(course => [course.id, course]));
  const completed = pairs.filter(pair => courseLearningMetrics(byId.get(pair.courseId)!, pair.userId, records).complete).length;
  return { completed, total: pairs.length, percent: percentage(completed, pairs.length) };
}

export type AttemptPolicy = "latest" | "best" | "all";
export function selectGradedAttempts(attempts: readonly Attempt[], policy: AttemptPolicy = "latest", period?: ResolvedReportPeriod): Attempt[] {
  const graded = attempts.filter(attempt => attempt.userId && attempt.status !== "pending" && attempt.score !== null &&
    Number.isFinite(attempt.score) && attempt.score >= 0 && attempt.score <= 100 && Number.isFinite(Date.parse(attempt.submittedAt)) &&
    (!period || isInReportPeriod(attempt.submittedAt, period)));
  const ordered = [...graded].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || b.id.localeCompare(a.id));
  if (policy === "all") return ordered;
  const groups = new Map<string, Attempt>();
  for (const attempt of ordered) {
    const key = JSON.stringify([attempt.userId, attempt.courseId, attempt.quizId ?? "legacy", attempt.courseVersion]);
    const prior = groups.get(key);
    if (!prior || (policy === "best" && attempt.score! > prior.score!)) groups.set(key, attempt);
  }
  return [...groups.values()];
}

export function assessmentAverages(attempts: readonly Attempt[], policy: AttemptPolicy = "latest", period?: ResolvedReportPeriod) {
  const selected = selectGradedAttempts(attempts, policy, period);
  const totals = new Map<string, { sum: number; count: number }>();
  for (const attempt of selected) {
    const total = totals.get(attempt.userId!) ?? { sum: 0, count: 0 };
    total.sum += attempt.score!; total.count += 1; totals.set(attempt.userId!, total);
  }
  const people = [...totals].map(([userId, total]) => ({ userId, average: total.sum / total.count, gradedAttempts: total.count }));
  return { people, average: people.length ? people.reduce((sum, person) => sum + person.average, 0) / people.length : null,
    peopleWithGrades: people.length, gradedAttempts: selected.length };
}
