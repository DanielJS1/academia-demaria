import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { readReport, reportHeaders } from "@/lib/reports/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** GET /api/reports?query=<URL-encoded JSON matching reportQuerySchema>. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => key !== "query") || params.getAll("query").length !== 1) throw new ApiError("Envie um único parâmetro query com os filtros do relatório.");
    const serialized = params.get("query")!;
    if (serialized.length > 4096) throw new ApiError("Filtros de relatório muito extensos.");
    let input: unknown; try { input = JSON.parse(serialized); } catch { throw new ApiError("Filtros de relatório inválidos."); }
    return Response.json(await readReport(request, input), { headers: reportHeaders });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 503;
    return Response.json({ error: error instanceof ApiError ? error.message : status === 400 ? "Revise os filtros e o período do relatório." : "Não foi possível gerar o relatório." }, { status, headers: reportHeaders });
  }
}
