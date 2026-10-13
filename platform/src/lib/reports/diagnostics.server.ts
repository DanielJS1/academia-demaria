import { isChoiceAnswerCorrect } from "../course-activities";
import type { Attempt } from "../model";
import { assessmentDiagnosticSchema, type AssessmentDiagnostic } from "./contracts";

/** Server-side input must be the persisted attempt snapshot, before answer keys are redacted.
 * Call only after authenticating and checking the target's scope. Never serialize this input.
 */
export function assessmentDiagnostic(attempt: Pick<Attempt, "id" | "score" | "status" | "questions" | "answers" | "correctTextIds" | "partialTextIds">): AssessmentDiagnostic {
  const counts = { correct: 0, incorrect: 0, partial: 0, pending: 0, unavailable: 0 };
  const questions = attempt.questions.map(question => {
    let outcome: AssessmentDiagnostic["questions"][number]["outcome"];
    if (attempt.status === "pending" || attempt.score === null) outcome = "pending";
    else if (question.type === "choice") {
      outcome = !question.correct ? "unavailable" : isChoiceAnswerCorrect(attempt.answers[question.id], question.correct, question.multiple) ? "correct" : "incorrect";
    } else if (attempt.correctTextIds?.includes(question.id)) outcome = "correct";
    else if (attempt.partialTextIds?.includes(question.id)) outcome = "partial";
    else if (attempt.correctTextIds === undefined || attempt.partialTextIds === undefined) outcome = "unavailable";
    else outcome = "incorrect";
    counts[outcome] += 1;
    return { questionId: question.id, outcome };
  });
  // Only IDs/outcomes/counts/official score cross the server boundary, never correct answers.
  return assessmentDiagnosticSchema.parse({ attemptId: attempt.id, score: attempt.status === "pending" ? null : attempt.score, questions, counts });
}
