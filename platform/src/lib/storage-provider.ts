import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./pilot-server";
import type { StorageKind } from "./storage-service";

const imageTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const fileTypes: Record<string, string> = { "application/pdf": "pdf", "application/sql": "sql", "text/plain": "sql", "application/octet-stream": "sql", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx" };

export async function storeMedia(db: SupabaseClient, file: File, kind: StorageKind, userId: string): Promise<string> {
  const isImage = kind !== "article-file";
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expected = isImage ? imageTypes[file.type] : file.type === "application/octet-stream" && ["sql", "xlsx", "pdf"].includes(extension || "") ? extension : fileTypes[file.type];
  if (!expected || (extension !== expected && !(expected === "jpg" && extension === "jpeg"))) throw new ApiError("Formato de arquivo não permitido.");
  const limit = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!file.size || file.size > limit) throw new ApiError(`O arquivo deve ter até ${limit / 1024 / 1024} MB.`, 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (isImage && !((expected === "png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (expected === "jpg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) || (expected === "webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"))) throw new ApiError("A imagem não corresponde ao formato informado.");
  if (!isImage && expected === "pdf" && bytes.toString("ascii", 0, 5) !== "%PDF-") throw new ApiError("O PDF é inválido.");
  if (!isImage && expected === "xlsx" && bytes.toString("ascii", 0, 2) !== "PK") throw new ApiError("A planilha é inválida.");
  if (!isImage && expected === "sql" && bytes.includes(0)) throw new ApiError("O script SQL deve ser um arquivo de texto.");
  const bucket = kind === "avatar" ? "academy-avatars" : "academy-articles";
  const basename = file.name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).toLowerCase() || "arquivo";
  const path = `${userId}/${Date.now()}-${randomUUID()}-${basename}.${expected}`;
  const contentType = file.type === "application/octet-stream" ? ({ sql: "text/plain", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" } as Record<string, string>)[expected] : file.type;
  const result = await db.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (result.error) throw new ApiError("Não foi possível enviar o arquivo ao storage.", 503);
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
