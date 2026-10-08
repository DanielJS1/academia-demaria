"use client";
import { browserAuth } from "../supabase-browser";
export async function kbFetch(url:string,options:RequestInit={},authenticated=true){
 const auth=authenticated?browserAuth():null;const token=(await auth?.auth.getSession())?.data.session?.access_token;
 const headers=new Headers(options.headers);if(token)headers.set("Authorization",`Bearer ${token}`);if(options.body&&typeof options.body==="string")headers.set("Content-Type","application/json");
 return fetch(url,{...options,headers,cache:"no-store",credentials:authenticated?"same-origin":"omit"});
}
export async function kbJson<T>(url:string,options:RequestInit={},authenticated=true):Promise<T>{const response=await kbFetch(url,options,authenticated);const result=await response.json();if(!response.ok)throw new Error(result.error||"Operação indisponível.");return result as T;}
