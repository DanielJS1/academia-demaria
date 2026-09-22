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
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" }
    ],
    shortcut: "/favicon.ico"
  }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AcademyProvider><AppShell>{children}</AppShell></AcademyProvider></body></html>;
}
