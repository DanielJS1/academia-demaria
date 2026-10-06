import type { NextConfig } from "next";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://www.youtube.com https://s.ytimg.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${supabaseOrigin} https://*.vimeo.com https://*.youtube.com https://*.googlevideo.com https://challenges.cloudflare.com`,
  `img-src 'self' data: blob: https:`,
  `frame-src 'self' ${supabaseOrigin} https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com`,
  "font-src 'self' data:",
  "upgrade-insecure-requests",
].join("; ");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};
export default nextConfig;
