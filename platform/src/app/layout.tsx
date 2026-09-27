import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AcademyProvider } from "@/components/academy-provider";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: { default: "Academia DeMaria · Seu próximo nível", template: "%s · Academia DeMaria" },
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
  return <html lang="pt-BR"><body><AcademyProvider><AppShell>{children}</AppShell></AcademyProvider></body></html>;
}
