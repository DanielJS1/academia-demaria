import { QuizRunner } from "@/components/quizzes/quiz-runner";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizRunner id={id} />;
}
