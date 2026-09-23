import { authenticate, ApiError } from "@/lib/pilot-server";
import { storeMedia } from "@/lib/storage-provider";
import type { StorageKind } from "@/lib/storage-service";

export const runtime = "nodejs";
const kinds = new Set<StorageKind>(["avatar", "article-image", "article-file"]);
export async function POST(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    const maxBody = 11 * 1024 * 1024;
    if (Number(request.headers.get("content-length") || 0) > maxBody) throw new ApiError("Arquivo muito grande.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError("Envie um arquivo válido.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > maxBody) { await reader.cancel(); throw new ApiError("Arquivo muito grande.", 413); }
      chunks.push(part.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || typeof kind !== "string" || !kinds.has(kind as StorageKind)) throw new ApiError("Envie um arquivo válido.");
    if (kind !== "avatar" && me.audience === "client") throw new ApiError("A biblioteca é exclusiva dos colaboradores.", 403);
    const url = await storeMedia(db, file, kind as StorageKind, me.id);
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Falha no envio do arquivo." }, { status: error instanceof ApiError ? error.status : 500 });
  }
}
