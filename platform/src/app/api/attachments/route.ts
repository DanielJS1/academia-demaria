import { randomUUID } from "node:crypto";
import { authenticate, ApiError, requireCourseAccess } from "@/lib/pilot-server";
import { lessonSchema } from "@/lib/model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const bucket="academy-pdfs";
const maxSize=3*1024*1024;
const headers={"Cache-Control":"no-store, private"};
function failure(error:unknown){return Response.json({error:error instanceof ApiError?error.message:"Não foi possível acessar o PDF."},{status:error instanceof ApiError?error.status:500,headers});}
export async function POST(request:Request){try{
 const {db,me}=await authenticate(request);
 if(me.role!=="admin")throw new ApiError("Somente administradores podem anexar PDFs.",403);
 if(Number(request.headers.get("content-length")||0)>maxSize+65536)throw new ApiError("O PDF deve ter até 3 MB.",413);
 const reader=request.body?.getReader();if(!reader)throw new ApiError("Selecione um PDF.");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxSize+65536){await reader.cancel();throw new ApiError("O PDF deve ter até 3 MB.",413);}chunks.push(part.value);}
 const form=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
 const file=form.get("file");if(!(file instanceof File)||file.size===0||file.size>maxSize||!file.name.toLowerCase().endsWith(".pdf"))throw new ApiError("Selecione um PDF de até 3 MB.");
 const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString()!=="%PDF-")throw new ApiError("O arquivo não contém um PDF válido.");
 const info=await db.storage.getBucket(bucket);
 if(info.error){const created=await db.storage.createBucket(bucket,{public:false,fileSizeLimit:maxSize,allowedMimeTypes:["application/pdf"]});if(created.error&&String(created.error.statusCode)!=="409")throw new ApiError("Não foi possível preparar o armazenamento de PDFs.",503);}
 const attachmentPath=`pdf/${randomUUID()}.pdf`;
 const result=await db.storage.from(bucket).upload(attachmentPath,bytes,{contentType:"application/pdf",upsert:false});
 if(result.error)throw new ApiError("Não foi possível enviar o PDF. Tente novamente.",503);
 return Response.json({attachmentPath,attachmentName:file.name.slice(0,200)},{headers});
}catch(error){return failure(error);}}
export async function GET(request:Request){try{
 const {db,me}=await authenticate(request);const params=new URL(request.url).searchParams;
 if(!(params.get("preview")==="1"&&me.role==="admin"&&me.audience!=="client"))await requireCourseAccess(db,me,params.get("courseId")||"");
 const {data,error}=await db.from("academy_resources").select("published,draft").eq("id",params.get("courseId")||"").eq("kind","course").single();
 if(error||!data)throw new ApiError("Curso não encontrado.",404);
 const content=params.get("preview")==="1"&&me.role==="admin"?(data.draft||data.published):data.published;
 const lesson=lessonSchema.safeParse(content?.lessons?.find((l:{id:string})=>l.id===params.get("lessonId")));
 if(!lesson.success||lesson.data.type!=="reading"||!lesson.data.attachmentPath)throw new ApiError("PDF não encontrado nesta atividade.",404);
 const signed=await db.storage.from(bucket).createSignedUrl(lesson.data.attachmentPath,600);
 if(signed.error)throw new ApiError("Não foi possível abrir o PDF.",503);
 return Response.json({url:signed.data.signedUrl},{headers});
}catch(error){return failure(error);}}
