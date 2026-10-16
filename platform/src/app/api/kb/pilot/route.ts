import { localRequest,pilotProfiles } from "@/lib/kb/local-db";
import { privateHeaders } from "@/lib/kb/server";
export async function GET(request:Request){if(!localRequest(request))return new Response(null,{status:404});return Response.json({profiles:pilotProfiles},{headers:privateHeaders});}
export async function POST(request:Request){
  if(!localRequest(request))return new Response(null,{status:404});
  const origin=request.headers.get("origin");
  if(!origin||new URL(origin).host!==request.headers.get("host")||!["127.0.0.1","localhost","[::1]"].includes(new URL(origin).hostname))return Response.json({error:"Origem não autorizada."},{status:403});
  const {id}=await request.json();const p=pilotProfiles.find(p=>p.id===id);
  return Response.json({ok:true},{headers:{...privateHeaders,"Set-Cookie":`kb-pilot=${p?.id||""}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${p?3600:0}`}});
}
