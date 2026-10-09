import sharp from "sharp";
import { ApiError } from "../api-error";

export const KB_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export async function inspectKbImage(bytes:Buffer) {
 if(!bytes.length || bytes.length > KB_MEDIA_MAX_BYTES) throw new ApiError("Envie uma imagem ou GIF de até 5 MB.",413);
 const info=await sharp(bytes,{limitInputPixels:40000000}).metadata().catch(()=>{throw new ApiError("Arquivo de imagem inválido.");});
 const mime=({png:"image/png",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif"} as Record<string,string>)[info.format||""];
 if(!mime||!info.width||!info.height||(info.format!=="gif"&&(info.pages||1)>1)) throw new ApiError("Use PNG, JPEG, WebP estático ou GIF animado.");
 return {mime,width:info.width,height:info.pageHeight||info.height};
}
