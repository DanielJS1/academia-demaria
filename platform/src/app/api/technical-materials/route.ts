import { ApiError, authenticate } from "@/lib/pilot-server";
import { technicalMaterialInput } from "@/lib/technical-material";
import { vimeoEmbed } from "@/lib/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bucket = "academy-technical-pdfs";
const headers = { "Cache-Control": "no-store, private" };

function failure(error: unknown) {
  return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível acessar os materiais técnicos." }, { status: error instanceof ApiError ? error.status : 500, headers });
}
function internal(audience?: string) {
  if (audience === "client") throw new ApiError("Os materiais técnicos são exclusivos da equipe interna.", 403);
}
function editor(role: string, audience?: string) {
  internal(audience);
  if (role !== "admin" && role !== "manager") throw new ApiError("Somente gestores e administradores podem gerenciar materiais técnicos.", 403);
}

export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    internal(me.audience);
    const id = new URL(request.url).searchParams.get("open");
    if (id) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new ApiError("Material inválido.", 400);
      const result = await db.from("academy_technical_materials").select("kind,pdf_path,video_url").eq("id", id).maybeSingle();
      if (result.error || !result.data) throw new ApiError("Material não encontrado.", 404);
      if (result.data.kind === "video") return Response.json({ url: vimeoEmbed(result.data.video_url) }, { headers });
      const signed = await db.storage.from(bucket).createSignedUrl(result.data.pdf_path, 600);
      if (signed.error) throw new ApiError("Não foi possível abrir o PDF.", 503);
      return Response.json({ url: signed.data.signedUrl }, { headers });
    }
    const result = await db.from("academy_technical_materials").select("id,title,description,topic,kind,pdf_path,video_url,created_by,created_at").order("created_at", { ascending: false });
    if (result.error) throw new ApiError("Não foi possível carregar os materiais técnicos.", 503);
    return Response.json({ materials: result.data.map(item => ({ id: item.id, title: item.title, description: item.description, topic: item.topic, kind: item.kind, pdfPath: item.pdf_path, videoUrl: item.video_url, createdBy: item.created_by, createdAt: item.created_at })) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    editor(me.role, me.audience);
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new ApiError("Dados do material muito grandes.", 413);
    const parsed = technicalMaterialInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message || "Material inválido.", 400);
    const item = parsed.data;
    if (item.kind === "manual") {
      const info = await db.storage.from(bucket).info(item.pdfPath!);
      if (info.error || info.data.size === undefined || info.data.size > 30 * 1024 * 1024 || info.data.contentType !== "application/pdf") throw new ApiError("O PDF enviado não foi encontrado ou é inválido.", 400);
    }
    const result = await db.from("academy_technical_materials").insert({ title: item.title, description: item.description, topic: item.topic, kind: item.kind, pdf_path: item.pdfPath, video_url: item.videoUrl, created_by: me.id }).select("id").single();
    if (result.error) throw new ApiError("Não foi possível salvar o material técnico.", 503);
    return Response.json({ id: result.data.id }, { status: 201, headers });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    editor(me.role, me.audience);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new ApiError("Material inválido.", 400);
    const found = await db.from("academy_technical_materials").select("pdf_path").eq("id", id).maybeSingle();
    if (found.error || !found.data) throw new ApiError("Material não encontrado.", 404);
    const deleted = await db.from("academy_technical_materials").delete().eq("id", id);
    if (deleted.error) throw new ApiError("Não foi possível excluir o material.", 503);
    if (found.data.pdf_path) await db.storage.from(bucket).remove([found.data.pdf_path]);
    return Response.json({ ok: true }, { headers });
  } catch (error) { return failure(error); }
}
