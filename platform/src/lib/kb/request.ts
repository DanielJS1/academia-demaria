import { ApiError } from "../api-error";
export async function limitedJson(request: Request) {
  const reader=request.body?.getReader();if(!reader)throw new ApiError("Envie um documento.");
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>1200000){await reader.cancel();throw new ApiError("Documento muito grande.",413);}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
