import { academyIcon } from "@/lib/site-icons";

export function GET() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/icons/${academyIcon}/favicon.ico`,
      "Cache-Control": "no-cache",
    },
  });
}
