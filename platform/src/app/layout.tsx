import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AcademyProvider } from "@/components/academy-provider";
import { AppShell } from "@/components/app-shell";
import { QuizSummaryProvider } from "@/components/quizzes/quiz-summary-provider";
export const metadata: Metadata = {
  title: { default: process.env.NEXT_PUBLIC_APP_ENV === "homologacao" ? "Homologação · Academia DeMaria" : "Academia DeMaria · Seu próximo nível", template: process.env.NEXT_PUBLIC_APP_ENV === "homologacao" ? "%s · Homologação DeMaria" : "%s · Academia DeMaria" },
  description: "Um novo espaço para aprender, compartilhar conhecimento e evoluir com a DeMaria.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/academia-demaria-app-icon.png", type: "image/png" }
    ],
    apple: [
      { url: "/academia-demaria-app-icon.png" }
    ],
    shortcut: "/academia-demaria-app-icon.png"
  }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AcademyProvider><QuizSummaryProvider><AppShell>{children}</AppShell></QuizSummaryProvider></AcademyProvider></body></html>;
}
