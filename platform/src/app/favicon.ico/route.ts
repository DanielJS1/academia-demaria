import { academyIcon } from "@/lib/site-icons";
import { KB_PUBLIC_SITE } from "@/lib/kb/public-links";

export function GET(request: Request) {
  const host = request.headers.get("host") || new URL(request.url).host;
  const kbHost = new URL(process.env.KB_PUBLIC_ORIGIN || KB_PUBLIC_SITE).host;
  const site = host === kbHost ? "conhecimento" : academyIcon;
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/icons/${site}/favicon.ico`,
      "Cache-Control": "no-cache",
    },
  });
}
