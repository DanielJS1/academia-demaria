import type { Metadata } from "next";

export type SiteIcon = "academia" | "homologacao" | "conhecimento";

export const academyIcon: SiteIcon = process.env.NEXT_PUBLIC_APP_ENV === "homologacao"
  ? "homologacao"
  : "academia";

export function siteIcons(site: SiteIcon): Metadata["icons"] {
  const base = `/icons/${site}`;
  return {
    icon: [
      { url: `${base}/favicon.ico`, type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: `${base}/icon-32.png`, type: "image/png", sizes: "32x32" },
      { url: `${base}/icon-48.png`, type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: `${base}/apple-touch-icon.png`, type: "image/png", sizes: "180x180" }],
    shortcut: `${base}/favicon.ico`,
  };
}
