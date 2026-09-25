import { z } from "zod";
import { authenticate, ApiError, requireCourseAccess } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const noteSchema = z.object({ courseId: z.string().min(1).max(100), lessonId: z.string().min(1).max(100), content: z.string().max(10000) });
function failure(error: unknown) {
  return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível acessar o caderno." }, { status: error instanceof ApiError ? error.status : 500, headers });
}
export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    const courseId = new URL(request.url).searchParams.get("courseId") || "";
    await requireCourseAccess(db, me, courseId);
    const result = await db.from("academy_lesson_notes").select("lesson_id,content").eq("user_id", me.id).eq("course_id", courseId);
    if (result.error) throw new ApiError("Não foi possível carregar o caderno.", 503);
    return Response.json({ notes: Object.fromEntries((result.data || []).map(row => [row.lesson_id, row.content])) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 12000) throw new ApiError("Anotação muito longa.", 413);
    const { db, me } = await authenticate(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 12000) throw new ApiError("Anotação muito longa.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ApiError("Anotação inválida."); }
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("Anotação inválida.");
    const { courseId, lessonId, content } = parsed.data;
    const course = await requireCourseAccess(db, me, courseId);
    if (!course.lessons.some(lesson => lesson.id === lessonId)) throw new ApiError("Aula não encontrada.", 404);
    const result = await db.from("academy_lesson_notes").upsert({ user_id: me.id, course_id: courseId, lesson_id: lessonId, content, updated_at: new Date().toISOString() });
    if (result.error) throw new ApiError("Não foi possível salvar a anotação.", 503);
    return Response.json({ saved: true }, { headers });
  } catch (error) { return failure(error); }
}
