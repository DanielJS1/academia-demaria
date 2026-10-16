"use client";
import { browserAuth } from "../supabase-browser";
export async function kbFetch(url:string,options:RequestInit={},authenticated=true){
 const auth=authenticated?browserAuth():null;const token=(await auth?.auth.getSession())?.data.session?.access_token;
 const headers=new Headers(options.headers);if(token)headers.set("Authorization",`Bearer ${token}`);if(options.body&&typeof options.body==="string")headers.set("Content-Type","application/json");
 return fetch(url,{...options,headers,cache:"no-store",credentials:authenticated?"same-origin":"omit"});
}
export async function kbJson<T>(url:string,options:RequestInit={},authenticated=true):Promise<T>{const response=await kbFetch(url,options,authenticated);const result=await response.json();if(!response.ok)throw new Error(result.error||"Operação indisponível.");return result as T;}
export async function uploadKbMedia<T>(articleId:string,file:File):Promise<T>{
 if(!file.size||file.size>5*1024*1024)throw new Error("Envie uma imagem ou GIF de até 5 MB.");
 if(file.size>4*1024*1024){
  const signed=await kbJson<{local?:boolean;path:string;token:string;ticket:string}>("/api/kb/media/upload",{method:"POST",body:JSON.stringify({articleId,name:file.name.slice(0,200),size:file.size})});
  if(!signed.local){
   const client=browserAuth();if(!client)throw new Error("Envio indisponível.");
   const result=await client.storage.from("academy-kb").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type||"image/gif"});
   if(result.error)throw new Error(result.error.message);
   return kbJson<T>("/api/kb/media/upload",{method:"POST",body:JSON.stringify({action:"complete",ticket:signed.ticket})});
  }
 }
 const form=new FormData();form.set("articleId",articleId);form.set("file",file);
 return kbJson<T>("/api/kb/media",{method:"POST",body:form});
}
