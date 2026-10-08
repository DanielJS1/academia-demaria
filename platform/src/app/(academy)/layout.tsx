import { AcademyProvider } from "@/components/academy-provider";
import { AppShell } from "@/components/app-shell";
import { QuizSummaryProvider } from "@/components/quizzes/quiz-summary-provider";
import { LiveProvider } from "@/components/live/live-provider";
export const metadata={robots:{index:false,follow:false}};
export default function AcademyLayout({children}:{children:React.ReactNode}){return <AcademyProvider><QuizSummaryProvider><LiveProvider><AppShell>{children}</AppShell></LiveProvider></QuizSummaryProvider></AcademyProvider>;}
