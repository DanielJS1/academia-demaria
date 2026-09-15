import { ApiError, authenticate, executeCommand, readAcademy } from "@/lib/pilot-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private"};
function failure(error:unknown){return Response.json({error:error instanceof ApiError?error.message:"Não foi possível concluir a solicitação."},{status:error instanceof ApiError?error.status:500,headers});}
export async function GET(request:Request){try{const {db,me}=await authenticate(request);return Response.json(await readAcademy(db,me),{headers});}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 if(Number(request.headers.get("content-length")??0)>1_000_000)throw new ApiError("Conteúdo muito grande.",413);
 const {db,me}=await authenticate(request);
 const raw=await request.text();if(raw.length>1_000_000)throw new ApiError("Conteúdo muito grande.",413);
 let input;try{input=JSON.parse(raw);}catch{throw new ApiError("Solicitação inválida.");}
 await executeCommand(db,me,input);
 if(input.type==="video"){
  const progress=await db.from("academy_progress").select("lesson_id").eq("user_id",me.id).eq("course_id",input.courseId).eq("version",input.version).eq("done",true);
  if(progress.error)throw new ApiError("Avanço salvo. Atualize a página para consultar a conclusão.",503);
  const xp=await db.from("academy_xp").select("id,amount,season,label").eq("user_id",me.id);
  if(xp.error)throw new ApiError("Avanço salvo. Atualize a página para consultar seu XP.",503);
  return Response.json({userId:me.id,xpEvents:xp.data,progress:{courseId:input.courseId,completed:progress.data.map(row=>row.lesson_id)}},{headers});
 }
 return Response.json(await readAcademy(db,me),{headers});
 }catch(error){return failure(error);}}
