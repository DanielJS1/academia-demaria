import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {ApiError} from "../api-error";
const schema=z.strictObject({id:z.string().uuid(),articleId:z.string().uuid(),actor:z.string().uuid(),name:z.string().min(1).max(200),size:z.number().int().min(1).max(5242880),expires:z.number().int()});
type Ticket=z.infer<typeof schema>;
function secret(){const value=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!value)throw new ApiError("Envio de mídia indisponível.",503);return value;}
export function signMediaTicket(input:Ticket){const payload=Buffer.from(JSON.stringify(schema.parse(input))).toString("base64url");return `${payload}.${createHmac("sha256",secret()).update(`kb-media:${payload}`).digest("base64url")}`;}
export function readMediaTicket(ticket:string,actor:string|null){
 const [payload,signature,...extra]=ticket.split(".");if(!payload||!signature||extra.length)throw new ApiError("Envio inválido.",403);
 const expected=createHmac("sha256",secret()).update(`kb-media:${payload}`).digest(),actual=Buffer.from(signature,"base64url");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new ApiError("Envio inválido.",403);
 const value=schema.parse(JSON.parse(Buffer.from(payload,"base64url").toString("utf8")));
 if(value.actor!==actor||value.expires<Date.now())throw new ApiError("Envio expirado ou não autorizado.",403);
 return value;
}
