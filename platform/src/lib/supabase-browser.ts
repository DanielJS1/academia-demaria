"use client";
import { createClient } from "@supabase/supabase-js";
let client:ReturnType<typeof createClient>|undefined;
export function browserAuth(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url || !key)return null;
 return client??=createClient(url,key);
}
