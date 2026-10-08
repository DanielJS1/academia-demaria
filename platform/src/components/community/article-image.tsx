"use client";

import { useEffect, useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";
import { isStoredMediaUrl } from "@/lib/storage-service";

export function ArticleImage({ src, alt }: { src: string; alt: string }) {
  const privateImage=isStoredMediaUrl(src,"academy-articles")||isStoredMediaUrl(src,"academy-article-images");
  const [url, setUrl] = useState(privateImage ? "" : src);
  useEffect(() => {
    if (!privateImage) { setUrl(src); return; }
    setUrl("");
    let active = true;
    void (async () => {
      const token = (await browserAuth()?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      const response = await fetch(`/api/media?url=${encodeURIComponent(src)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.ok && active) setUrl((await response.json()).url);
    })().catch(() => {});
    return () => { active = false; };
  }, [src,privateImage]);
  return url ? <img src={url} alt={alt} loading="lazy" decoding="async" /> : null;
}
