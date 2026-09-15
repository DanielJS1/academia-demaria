import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AcademyProvider } from "@/components/academy-provider";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: { default: "DOC-Academy · Seu próximo nível", template: "%s · DOC-Academy" },
  description: "Um novo espaço para aprender, compartilhar conhecimento e evoluir com a DeMaria.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/doc-academy-logo-oficial.png", type: "image/png", sizes: "192x192" }
    ],
    apple: "/doc-academy-logo-oficial.png",
    shortcut: "/favicon.svg"
  }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AcademyProvider><AppShell>{children}</AppShell></AcademyProvider></body></html>;
}
