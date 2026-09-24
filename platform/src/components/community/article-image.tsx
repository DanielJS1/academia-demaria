"use client";

import { useEffect, useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";

export function ArticleImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState(src.includes("/academy-articles/") ? "" : src);
  useEffect(() => {
    if (!src.includes("/academy-articles/")) return;
    let active = true;
    void (async () => {
      const token = (await browserAuth()?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      const response = await fetch(`/api/media?url=${encodeURIComponent(src)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.ok && active) setUrl((await response.json()).url);
    })().catch(() => {});
    return () => { active = false; };
  }, [src]);
  return url ? <img src={url} alt={alt} loading="lazy" decoding="async" /> : null;
}
