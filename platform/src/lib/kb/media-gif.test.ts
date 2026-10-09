import {PGlite} from "@electric-sql/pglite";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {readFile,rm} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {initializeLocal,asLocal,pilotProfiles,localPilotRoot} from "./local-db";
import {upload,readMedia} from "./media-server";
import {inspectKbImage,KB_MEDIA_MAX_BYTES} from "./media-validation";
import {signMediaTicket,readMediaTicket} from "./media-ticket";
import {newDocument} from "./document";
import type {KbContext} from "./server";

const gif=Buffer.from("R0lGODlhAQABAIAAAExpcf8AACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCgAAACwAAAAAAQABAAACAkwBACH5BAUKAAAALAAAAAABAAEAgExpcQAA/wICTAEAOw==","base64");
describe("GIF: validação, bytes originais e acesso privado",()=>{
 const db=new PGlite(),author=pilotProfiles[0],namespace=`gif-test-${crypto.randomUUID()}`;
 let articleId:string,mediaId:string;
 const ctx:Extract<KbContext,{local:true}>={local:true,actor:author.id,me:author,db,client:null};
 beforeAll(async()=>{vi.stubEnv("KB_PILOT_NAMESPACE",namespace);await initializeLocal(db);articleId=await asLocal(db,author.id,async tx=>(await tx.query<{id:string}>("select kb_mutate($1::jsonb) id",[JSON.stringify({action:"create",document:newDocument()})])).rows[0].id);},30000);
 afterAll(async()=>{await db.close();const root=localPilotRoot();if(!root.endsWith(namespace))throw new Error("Diretório de teste inválido");await rm(root,{recursive:true,force:true});vi.unstubAllEnvs();});
 it("aceita GIF de dois quadros e armazena os mesmos bytes, sem achatar a animação",async()=>{
  const media=await upload(ctx,articleId,new File([gif],"demonstracao.gif",{type:"image/gif"}));mediaId=media.id;
  expect(media).toMatchObject({mime:"image/gif",width:1,height:1,bytes:gif.length});
  const original=await readFile(path.join(localPilotRoot(),"media",articleId,media.id));expect(original.equals(gif)).toBe(true);
  expect((await sharp(original).metadata()).pages).toBe(2);
  const read=await readMedia(ctx,media.id);expect(read.bytes.equals(gif)).toBe(true);expect(read.mime).toBe("image/gif");
 });
 it("não permite ler GIF de rascunho como visitante nem outro autor",async()=>{
  await expect(readMedia({...ctx,actor:null,me:null},mediaId)).rejects.toThrow("Mídia não encontrada");
  await expect(readMedia({...ctx,actor:pilotProfiles[2].id,me:pilotProfiles[2]},mediaId)).rejects.toThrow("Mídia não encontrada");
 });
 it("recusa arquivo acima de 5 MiB, vazio e texto disfarçado de GIF",async()=>{
  await expect(inspectKbImage(Buffer.alloc(KB_MEDIA_MAX_BYTES+1))).rejects.toThrow("até 5 MB");
  await expect(inspectKbImage(Buffer.alloc(0))).rejects.toThrow("até 5 MB");
  await expect(upload(ctx,articleId,new File(["<script>invalido</script>"],"imagem.gif",{type:"image/gif"}))).rejects.toThrow("imagem inválido");
 });
 it("aceita o limite exato de 5 MiB e mantém PNG/JPEG/WebP estáticos",async()=>{
  const padded=Buffer.concat([gif,Buffer.alloc(KB_MEDIA_MAX_BYTES-gif.length)]);
  expect((await inspectKbImage(padded)).mime).toBe("image/gif");
  for(const format of ["png","jpeg","webp"] as const){const image=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).toFormat(format).toBuffer();expect((await inspectKbImage(image)).mime).toBe(`image/${format}`);}
 });
 it("autoriza envio direto somente para o autor, prazo e dados assinados",()=>{
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","isolated-test-secret");
  const input={id:crypto.randomUUID(),articleId,actor:author.id,name:"demo.gif",size:gif.length,expires:Date.now()+60000};
  const ticket=signMediaTicket(input);expect(readMediaTicket(ticket,author.id)).toEqual(input);
  expect(()=>readMediaTicket(ticket,pilotProfiles[2].id)).toThrow("não autorizado");
  expect(()=>readMediaTicket(ticket.replace(".","x."),author.id)).toThrow("inválido");
  expect(()=>readMediaTicket(signMediaTicket({...input,expires:Date.now()-1000}),author.id)).toThrow("expirado");
 });
});
