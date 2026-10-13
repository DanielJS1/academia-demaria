import { z } from "zod";
import { ApiError } from "../api-error";
import { courseSchema, attemptSchema, normalizeStoredCourseLevel, isCourseActive, type Course, type Attempt } from "../model";
import { deadlineKind } from "../trails";
import { assignedCoursePairs, courseLearningMetrics, percentage, selectGradedAttempts, assessmentAverages, type LearningRecords } from "./metrics";
import { assessmentDiagnostic } from "./diagnostics.server";
import { calendarDateSchema, isInReportPeriod, reportDay, type ResolvedReportPeriod } from "./periods";
import type { ReportQuery, ReportRow } from "./contracts";
import { chunks, readPages, metric, currentCoverage, unavailable, refineReport, REPORT_MAX_RECORDS, REPORT_MAX_ROWS, type ReportDB, type ReportPerson, type ReportDomain } from "./read.server";
import { completionHistory as readCompletionHistory } from "./history.server";

const assignmentSchema = z.object({ id: z.string(), user_id: z.string(), active: z.boolean(), course_ids: z.array(z.string()), due_date: calendarDateSchema });
const progressSchema = z.object({ user_id: z.string(), course_id: z.string(), version: z.number().int().positive(), lesson_id: z.string(), done: z.boolean() });
const storedAttemptSchema = z.object({ id: z.string(), user_id: z.string(), course_id: z.string(), version: z.number().int().positive(), quiz_id: z.string().nullable(), snapshot: z.record(z.string(), z.unknown()), answers: z.record(z.string(), z.string()), status: z.enum(["pending", "approved", "retry"]), feedback: z.string(), score: z.number().min(0).max(100).nullable(), submitted_at: z.iso.datetime({ offset: true }), correct_text_ids: z.array(z.string()).nullable(), partial_text_ids: z.array(z.string()).nullable() });
function parseRecords<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value); if (!result.success) throw new ApiError("Registros de aprendizagem inválidos.", 503); return result.data;
}
function mapAttempt(row: z.infer<typeof storedAttemptSchema>): Attempt {
  const snapshot = row.snapshot;
  const legacyLessons = z.array(z.object({ id: z.string(), type: z.string() })).safeParse(snapshot.lessons);
  return parseRecords(attemptSchema, { id: row.id, userId: row.user_id, courseId: row.course_id, courseTitle: snapshot.title, courseVersion: row.version,
    quizId: row.quiz_id ?? (snapshot.proficiency ? "proficiency" : snapshot.quizId ?? (legacyLessons.success ? legacyLessons.data.find(lesson => lesson.type === "quiz")?.id : undefined)), questions: snapshot.questions ?? [], answers: row.answers, status: row.status,
    feedback: row.feedback, score: row.score, submittedAt: row.submitted_at, passingScore: snapshot.passingScore ?? 70, xp: snapshot.xp ?? 0,
    retryPolicy: snapshot.retryPolicy ?? "free", correctTextIds: row.correct_text_ids ?? undefined, partialTextIds: row.partial_text_ids ?? undefined });
}

export async function learningReport(db: ReportDB, people: ReportPerson[], query: ReportQuery, period: ResolvedReportPeriod | null, now: Date): Promise<ReportDomain> {
  const ids = people.map(person => person.id), authorized = new Set(ids);
  const scope = query.learningScope ?? "assigned", assessments = query.learningDetail === "assessments";
  const assignmentRows = [];
  for (const batch of chunks(scope === "assigned" ? ids : [])) {
    assignmentRows.push(...await readPages((start, end) => db.from("academy_trail_assignments").select("id,user_id,active,course_ids,due_date").in("user_id", batch).eq("active", true).order("id").range(start, end)));
    if (assignmentRows.length > REPORT_MAX_RECORDS) refineReport();
  }
  const assignments = parseRecords(z.array(assignmentSchema), assignmentRows);
  const needed = [...new Set(assignments.flatMap(assignment => assignment.course_ids))];
  const resourceRows = [];
  if (scope === "catalog" && ids.length) resourceRows.push(...await readPages((start, end) => {
    const builder = db.from("academy_resources").select("id,published").eq("kind", "course").not("published", "is", null);
    return (query.courseId ? builder.eq("id", query.courseId) : builder).order("id").range(start, end);
  }));
  else for (const batch of chunks(needed)) resourceRows.push(...await readPages((start, end) => db.from("academy_resources").select("id,published").eq("kind", "course").in("id", batch).not("published", "is", null).order("id").range(start, end)));
  const courses: Course[] = resourceRows.flatMap(row => {
    if (!row.published || row.published.audience === "client") return [];
    const course = parseRecords(courseSchema, { ...row.published, id: row.id, level: normalizeStoredCourseLevel(row.published.level) });
    return [course];
  });
  const available = courses.filter(course => assessments || period ? course.status === "published" : isCourseActive(course));
  if (query.courseId && !available.some(course => course.id === query.courseId)) throw new ApiError("Curso fora do conjunto autorizado selecionado.", 403);
  const catalogCourses = available.filter(course => !query.courseId || course.id === query.courseId);
  if (!assessments && scope === "catalog" && people.length * catalogCourses.length > REPORT_MAX_ROWS) refineReport();
  const pairs = scope === "assigned" ? assignedCoursePairs(assignments.map(assignment => ({ userId: assignment.user_id, courseIds: assignment.course_ids, active: assignment.active })), courses, authorized) :
    people.flatMap(person => catalogCourses.map(course => ({ id: JSON.stringify([person.id, course.id, course.version]), userId: person.id, courseId: course.id, courseVersion: course.version })));
  const filteredPairs = pairs.filter(pair => !query.courseId || pair.courseId === query.courseId);
  if (period && !assessments) {
    const history = await readCompletionHistory(db, ids, period);
    const pairIds = new Set(filteredPairs.map(pair => JSON.stringify([pair.userId, pair.courseId])));
    const selected = history.rows.filter(row => pairIds.has(JSON.stringify([row.user_id, row.course_id])));
    if (selected.length > REPORT_MAX_ROWS) refineReport();
    const byPerson = new Map(people.map(person => [person.id, person]));
    const byCourse = new Map(courses.map(course => [course.id, course]));
    return { collectedSince: history.since, coverage: { periodCompletions: history.coverage },
      rows: selected.map(row => ({ type: "course", id: JSON.stringify([row.user_id, row.course_id, row.version]), userId: row.user_id, name: byPerson.get(row.user_id)!.name,
        department: byPerson.get(row.user_id)!.department, courseId: row.course_id, courseTitle: byCourse.get(row.course_id)!.title, courseVersion: row.version,
        completedAt: row.completed_at, status: "completed", metrics: [metric("period_completions", 1, "count", history.coverage)] })),
      kpis: [metric("period_completions", history.coverage.availability === "unavailable" ? null : selected.length, "count", history.coverage),
        metric("people_completing", history.coverage.availability === "unavailable" ? null : new Set(selected.map(row => row.user_id)).size, "count", history.coverage)],
      series: [{ id: "person_completions", metricId: "period_completions", points: people.map(person => ({ id: person.id, userId: person.id, label: person.name,
        value: history.coverage.availability === "unavailable" ? null : selected.filter(row => row.user_id === person.id).length })) }],
    };
  }
  if (!assessments && filteredPairs.length > REPORT_MAX_ROWS) refineReport();
  const courseIds = [...new Set((assessments || scope === "catalog" ? available.filter(course => !query.courseId || course.id === query.courseId) : courses).map(course => course.id))];
  const progressRows = [], attemptRows = [];
  // Every source query includes the authorized IDs, including when service_role is used.
  for (const batch of chunks(ids)) for (const courseBatch of chunks(courseIds)) {
    const [progress, attempts] = await Promise.all([
      assessments ? [] : readPages((start, end) => db.from("academy_progress").select("user_id,course_id,version,lesson_id,done").in("user_id", batch).in("course_id", courseBatch).order("user_id").order("course_id").order("version").order("lesson_id").range(start, end)),
      readPages((start, end) => {
        let builder = db.from("academy_attempts").select("id,user_id,course_id,version,quiz_id,snapshot,answers,status,feedback,score,submitted_at,correct_text_ids,partial_text_ids").in("user_id", batch).in("course_id", courseBatch);
        if (assessments && period) builder = builder.gte("submitted_at", period.startInclusive).lt("submitted_at", period.endExclusive);
        return builder.order("id").range(start, end);
      }),
    ]);
    progressRows.push(...progress); attemptRows.push(...attempts);
    if (progressRows.length + attemptRows.length + assignmentRows.length + resourceRows.length > REPORT_MAX_RECORDS) refineReport();
  }
  const attempts = parseRecords(z.array(storedAttemptSchema), attemptRows).map(mapAttempt);
  const records: LearningRecords = { completedByUser: {}, attempts };
  const byCourse = new Map(courses.map(course => [course.id, course]));
  for (const row of parseRecords(z.array(progressSchema), progressRows)) {
    if (row.done && byCourse.get(row.course_id)?.version === row.version) ((records.completedByUser[row.user_id] ??= {})[row.course_id] ??= []).push(row.lesson_id);
  }
  const byPerson = new Map(people.map(person => [person.id, person]));
  const coverage = currentCoverage();
  if (assessments) {
    const pairIds = new Set(pairs.map(pair => JSON.stringify([pair.userId, pair.courseId])));
    const eligible = attempts.filter(attempt => (!query.courseId || attempt.courseId === query.courseId) && (scope === "catalog" || pairIds.has(JSON.stringify([attempt.userId, attempt.courseId]))) && (!period || isInReportPeriod(attempt.submittedAt, period)));
    const graded = selectGradedAttempts(eligible, query.attemptPolicy ?? "latest", period ?? undefined);
    // Pending submissions are separate records, never candidates for a graded-attempt policy.
    const selected = [...graded, ...eligible.filter(attempt => attempt.status === "pending" || attempt.score === null)].filter(attempt => !query.status || attempt.status === query.status);
    if (selected.length > REPORT_MAX_ROWS) refineReport();
    const gradeCoverage = period ? { ...coverage, semantics: "period" as const, observedFrom: period.startInclusive, observedUntil: period.endExclusive } : coverage;
    const rows: ReportRow[] = selected.map(attempt => {
      const person = byPerson.get(attempt.userId!)!;
      return { type: "assessment", id: attempt.id, userId: person.id, name: person.name, department: person.department,
        courseId: attempt.courseId, courseTitle: attempt.courseTitle, courseVersion: attempt.courseVersion,
        activityId: attempt.quizId ?? "legacy", submittedAt: attempt.submittedAt, feedback: attempt.feedback, attemptId: attempt.id, status: attempt.status,
        diagnostic: assessmentDiagnostic(attempt), metrics: [metric("score", attempt.status === "pending" || attempt.score === null ? null : attempt.score, "percent",
          attempt.status === "pending" || attempt.score === null ? unavailable(gradeCoverage.semantics, "Avaliação aguardando nota oficial.") : gradeCoverage)] };
    });
    const averages = assessmentAverages(selected, "all");
    return { coverage: { assessments: gradeCoverage }, rows,
      kpis: [metric("grade_average", averages.average, "percent", gradeCoverage, averages.peopleWithGrades), metric("people_with_grades", averages.peopleWithGrades, "count", gradeCoverage),
        metric("graded_attempts", averages.gradedAttempts, "count", gradeCoverage), metric("pending_attempts", selected.filter(attempt => attempt.status === "pending" || attempt.score === null).length, "count", gradeCoverage)],
      series: [{ id: "person_grades", metricId: "grade_average", points: averages.people.map(person => ({ id: person.userId, userId: person.userId, label: byPerson.get(person.userId)!.name, value: person.average })) }],
    };
  }
  const attemptsByUser = new Map<string, Attempt[]>();
  for (const attempt of attempts) { const records = attemptsByUser.get(attempt.userId!) ?? []; records.push(attempt); attemptsByUser.set(attempt.userId!, records); }
  const learningCache = new Map<string, ReturnType<typeof courseLearningMetrics>>();
  const learning = (course: Course, userId: string) => {
    const key = JSON.stringify([userId, course.id]);
    let result = learningCache.get(key);
    if (!result) { result = courseLearningMetrics(course, userId, { completedByUser: records.completedByUser, attempts: attemptsByUser.get(userId) ?? [] }); learningCache.set(key, result); }
    return result;
  };
  const assignmentsByUser = new Map<string, typeof assignments>();
  for (const assignment of assignments) { const records = assignmentsByUser.get(assignment.user_id) ?? []; records.push(assignment); assignmentsByUser.set(assignment.user_id, records); }
  const assignmentStatus = new Map(assignments.map(assignment => {
    const complete = assignment.course_ids.length > 0 && assignment.course_ids.every(id => {
      const course = byCourse.get(id); return !!course && learning(course, assignment.user_id).complete;
    });
    return [assignment.id, deadlineKind({ active: assignment.active, complete, dueDate: assignment.due_date, learnerDays: 0, managerDays: 0 }, true, reportDay(now)) === "overdue"];
  }));
  const rows: ReportRow[] = filteredPairs.map<ReportRow>(pair => {
    const course = byCourse.get(pair.courseId)!, person = byPerson.get(pair.userId)!;
    const result = learning(course, pair.userId);
    return { type: "course", id: pair.id, userId: pair.userId, name: person.name, department: person.department,
      courseId: course.id, courseTitle: course.title, courseVersion: course.version, status: result.status,
      assignments: scope === "catalog" ? [] : (assignmentsByUser.get(pair.userId) ?? []).filter(assignment => assignment.course_ids.includes(course.id)).map(assignment => ({ id: assignment.id, dueDate: assignment.due_date, overdue: assignmentStatus.get(assignment.id)! })),
      metrics: [metric("lesson_progress", result.progress, "percent", coverage, result.totalLessons), metric("completed_lessons", result.completedLessons, "count", coverage),
        metric("total_lessons", result.totalLessons, "count", coverage), metric("course_complete", result.complete ? 1 : 0, "count", coverage)] };
  }).filter(row => !query.status || (row.type === "course" && row.status === query.status));
  const complete = rows.filter(row => row.type === "course" && row.status === "completed").length;
  const overdueIds = new Set(rows.flatMap(row => row.type === "course" ? row.assignments?.filter(assignment => assignment.overdue).map(assignment => assignment.id) ?? [] : []));
  const lessonCount = rows.reduce((sum, row) => sum + (row.metrics.find(item => item.id === "total_lessons")?.value ?? 0), 0);
  const completedLessons = rows.reduce((sum, row) => sum + (row.metrics.find(item => item.id === "completed_lessons")?.value ?? 0), 0);
  return { coverage: { learning: coverage }, rows,
    kpis: [metric("course_pairs", rows.length, "count", coverage), metric("completed_courses", complete, "count", coverage), metric("completion_rate", percentage(complete, rows.length), "percent", coverage, rows.length),
      metric("lesson_progress", percentage(completedLessons, lessonCount), "percent", coverage, lessonCount),
      metric("overdue_assignments", scope === "catalog" ? null : overdueIds.size, "count", scope === "catalog" ? unavailable("current", "Catálogo não representa obrigações atribuídas.") : coverage),
      metric("overdue_people", scope === "catalog" ? null : new Set(rows.filter(row => row.type === "course" && row.assignments?.some(assignment => assignment.overdue)).map(row => row.userId)).size, "count", scope === "catalog" ? unavailable("current", "Catálogo não representa obrigações atribuídas.") : coverage)],
    series: [{ id: "course_status", metricId: "course_pairs", points: ["not_started", "in_progress", "awaiting_assessment", "completed"].map(status => ({ id: status, label: status, value: rows.filter(row => row.type === "course" && row.status === status).length })) }],
  };
}
