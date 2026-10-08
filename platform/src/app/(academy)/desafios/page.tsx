import type { Metadata } from "next";
import { QuizCenter } from "@/components/quizzes/quiz-center";

export const metadata: Metadata = { title: "Desafios" };
export default function Page() { return <QuizCenter/>; }
