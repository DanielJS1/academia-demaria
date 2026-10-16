import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, authenticate } from "@/lib/pilot-server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
const bucket = "academy-technical-pdfs";
const requestSchema = z.strictObject({ name: z.string().trim().min(1).max(200), size: z.number().int().min(1).max(30 * 1024 * 1024) });

export async function POST(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    if (me.audience === "client" || (me.role !== "manager" && me.role !== "admin")) throw new ApiError("Somente gestores e administradores podem enviar PDFs.", 403);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success || !parsed.data.name.toLowerCase().endsWith(".pdf")) throw new ApiError("Selecione um PDF de até 30 MB.", 400);
    const path = `technical/pdf/${randomUUID()}.pdf`;
    const signed = await db.storage.from(bucket).createSignedUploadUrl(path);
    if (signed.error) throw new ApiError("Não foi possível preparar o envio do PDF.", 503);
    return Response.json({ path, token: signed.data.token }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível preparar o envio do PDF." }, { status: error instanceof ApiError ? error.status : 500, headers });
  }
}
