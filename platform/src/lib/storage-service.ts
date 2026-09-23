export type StorageKind = "avatar" | "article-image" | "article-file";

export function isStoredMediaUrl(value: string, bucket: "academy-avatars" | "academy-articles"): boolean {
  try {
    const url = new URL(value);
    const base = process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://storage.invalid"}/storage/v1/object/public`;
    return url.protocol === "https:" && value.startsWith(`${base.replace(/\/$/, "")}/${bucket}/`);
  } catch { return false; }
}

// The client depends only on this HTTP contract. The server adapter owns the provider.
export async function uploadMedia(file: File, kind: StorageKind): Promise<string> {
  const { browserAuth } = await import("./supabase-browser");
  const session = await browserAuth()?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para enviar arquivos.");
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const response = await fetch("/api/media", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const result = await response.json();
  if (!response.ok || typeof result.url !== "string") throw new Error(result.error || "Não foi possível enviar o arquivo.");
  return result.url;
}
