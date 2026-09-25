"use client";

import { browserAuth } from "@/lib/supabase-browser";

export function ArticleAttachment({ href, name }: { href: string; name: string }) {
  async function open() {
    const tab = window.open("", "_blank");
    try {
    const token = (await browserAuth()?.auth.getSession())?.data.session?.access_token;
    if (!token) { tab?.close(); return; }
    const response = await fetch(`/api/media?url=${encodeURIComponent(href)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) { tab?.close(); return; }
    const result = await response.json();
    if (typeof result.url === "string" && tab) { tab.opener = null; tab.location.href = result.url; }
    else tab?.close();
    } catch { tab?.close(); }
  }
  return <div className="community-attachment"><button type="button" onClick={() => void open()}>↓ {name}</button></div>;
}
