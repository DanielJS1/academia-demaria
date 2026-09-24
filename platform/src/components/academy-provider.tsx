"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { browserAuth } from "@/lib/supabase-browser";
import { stateCommand, type Command } from "@/lib/pilot-contract";
import type { AcademyState, Cartorio } from "@/lib/model";
import { AccessScreen } from "./access-screen";
import { EngagementTracker } from "./engagement-tracker";
type Me={id:string;name:string;email:string;department?:string;role:"admin"|"manager"|"student";audience?:"internal"|"client";cartorioId?:string|null;avatar?:string|null};
type Context={state:AcademyState;me:Me;update:(change:(current:AcademyState)=>AcademyState)=>Promise<boolean>;mutate:(command:Command,options?:{silent?:boolean})=>Promise<boolean>;refresh:()=>Promise<void>;ready:boolean;busy:boolean;notify:(message:string)=>void;theme:string;toggleTheme:()=>void;storageError:boolean;signOut:()=>void;activeCartorio:Cartorio|null;simulatedCartorioId:string|null;setSimulatedCartorioId:(id:string|null)=>void;isClientEnvironment:boolean;avatar:string|null;setAvatar:(url:string|null)=>Promise<boolean>;};
const empty:AcademyState={schema:1,courses:[],courseDrafts:[],articles:[],articleDrafts:[],people:[],departments:[],products:[],completed:{},videoProgress:{},bookmarks:[],attempts:[],xpEvents:[],readNotices:[],notifications:[],recognitions:[],pdiNotes:[],teamProgress:{},cartorios:[]};
const AcademyContext=createContext<Context|null>(null);
export function AcademyProvider({children}:{children:ReactNode}){
 const path=usePathname();const [state,setState]=useState(empty);const current=useRef(state);
 const [me,setMe]=useState<Me|null>(null);const [authenticated,setAuthenticated]=useState(false);const [ready,setReady]=useState(false);const [sessionChecked,setSessionChecked]=useState(false);
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);const busyRef=useRef(false);const [toast,setToast]=useState("");const [theme,setTheme]=useState("light");const identity=useRef("");
 const [simulatedCartorioId, setSimulatedCartorioId] = useState<string | null>(null);
 const [avatar, setAvatarState] = useState<string | null>(null);
 const auth=browserAuth();
 const request=useCallback(async(command?:Command)=>{
  const client=browserAuth();const session=await client?.auth.getSession();const token=session?.data.session?.access_token;
  if(!token)throw new Error("Entre na sua conta para continuar.");
  const response=await fetch("/api/academy",{method:command?"POST":"GET",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(command?{body:JSON.stringify(command)}:{}),cache:"no-store"});
  const data=await response.json();if(!response.ok){if(response.status===401||(!command&&response.status===403)){setReady(false);setMe(null);current.current=empty;setState(empty);}throw new Error(data.error||"Não foi possível salvar.");}
  if(data.progress){
   if(identity.current!==data.userId)return;
   const xpEvents:AcademyState["xpEvents"]=data.xpEvents??current.current.xpEvents;
   const earned=xpEvents.filter(event=>!current.current.xpEvents.some(old=>old.id===event.id)).reduce((sum,event)=>sum+event.amount,0);
   if(earned>0)setToast(`+${earned} XP! Seu aprendizado está rendendo.`);
   const season=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric"});
   const previousCourse=current.current.videoProgress[data.progress.courseId]??{};
   const next={...current.current,xpEvents,people:current.current.people.map(person=>person.id===data.userId?{...person,xp:xpEvents.filter(e=>e.season===season).reduce((sum,e)=>sum+e.amount,0)}:person),completed:{...current.current.completed,[data.progress.courseId]:data.progress.completed},videoProgress:{...current.current.videoProgress,[data.progress.courseId]:{...previousCourse,[data.progress.lessonId]:{position:data.progress.position,duration:data.progress.duration,updatedAt:new Date().toISOString()}}}};
   current.current=next;setState(next);return;
  }
  if(identity.current!==data.me.id)return;
  if(command){const earned=(data.state.xpEvents as AcademyState["xpEvents"]).filter(event=>!current.current.xpEvents.some(old=>old.id===event.id)).reduce((sum,event)=>sum+event.amount,0);if(earned>0)setToast(`+${earned} XP! Seu aprendizado está rendendo.`);}
  current.current=data.state;setState(data.state);setMe(data.me);setReady(true);setError("");
 },[]);
 const refresh=useCallback(async()=>{try{await request();}catch(err){setError(err instanceof Error?err.message:"Não foi possível carregar seus dados.");}},[request]);
 useEffect(()=>{
  try{const saved=localStorage.getItem("doc-academy.theme");setTheme(saved|| (matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));}catch{}
  if(!auth){setSessionChecked(true);return;}
   const {data}=auth.auth.onAuthStateChange((_event: any,session: any)=>{
   const id=session?.user.id??"";
   if(identity.current!==id){identity.current=id;setMe(null);setReady(false);current.current=empty;setState(empty);setError("");}
   setAuthenticated(!!session);setSessionChecked(true);
   if(session)window.setTimeout(()=>void refresh(),0);
  });
  return()=>data.subscription.unsubscribe();
 },[auth,refresh]);
 useEffect(()=>{if(authenticated&&!busyRef.current)void refresh();},[path,authenticated,refresh]);
 useEffect(()=>{const onFocus=()=>{if(authenticated&&!busyRef.current)void refresh();};window.addEventListener("focus",onFocus);return()=>window.removeEventListener("focus",onFocus);},[authenticated,refresh]);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    if(theme==="dark"){
      document.documentElement.classList.add("dark");
    }else{
      document.documentElement.classList.remove("dark");
    }
  },[theme]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),6000);return()=>clearTimeout(timer);},[toast]);
 useEffect(()=>{
  if(!me?.id){setAvatarState(null);return;}
  if(me.avatar!==undefined){
   setAvatarState(me.avatar?.startsWith("https://") ? me.avatar : null);
   try{
    if(me.avatar?.startsWith("https://"))localStorage.setItem(`doc-academy.avatar.${me.id}`,me.avatar);
    else localStorage.removeItem(`doc-academy.avatar.${me.id}`);
   }catch{}
  }else{
   try{const saved=localStorage.getItem(`doc-academy.avatar.${me.id}`);setAvatarState(saved?.startsWith("https://")?saved:null);}catch{}
  }
 },[me?.id,me?.avatar]);
  const mutate=useCallback(async(command:Command,options?:{silent?:boolean})=>{
   if(busyRef.current){if(!options?.silent)setToast("Aguarde a gravação em andamento.");return false;}
   busyRef.current=true;if(!options?.silent)setBusy(true);
   try{await request(command);return true;}catch(err){if(!options?.silent)setToast(err instanceof Error?err.message:"Não foi possível salvar. Tente novamente.");return false;}finally{busyRef.current=false;if(!options?.silent)setBusy(false);}
  },[request]);
  const setAvatar=useCallback(async(url:string|null)=>{
   if(!me?.id)return false;
   const previous=avatar;
   setAvatarState(url);
   try{
    if(url)localStorage.setItem(`doc-academy.avatar.${me.id}`,url);
    else localStorage.removeItem(`doc-academy.avatar.${me.id}`);
   }catch(e){console.error("Erro ao salvar avatar",e);}
   setMe(prev=>prev?{...prev,avatar:url}:prev);
   setState(prev=>({...prev,people:prev.people.map(p=>p.id===me.id?{...p,avatar:url}:p)}));
   current.current={...current.current,people:current.current.people.map(p=>p.id===me.id?{...p,avatar:url}:p)};
   const ok=await mutate({type:"avatar",avatar:url});
   if(!ok){setAvatarState(previous);void refresh();}
   return ok;
  },[me?.id,mutate,avatar,refresh]);
 const update=useCallback(async(change:(current:AcademyState)=>AcademyState)=>{try{const command=stateCommand(current.current,change(current.current));return command?await mutate(command):true;}catch(err){setToast(err instanceof Error?err.message:"Ação inválida.");return false;}},[mutate]);
 const signOut=()=>{identity.current="";current.current=empty;setState(empty);setMe(null);setReady(false);setAuthenticated(false);setAvatarState(null);void auth?.auth.signOut();};
 const toggleTheme=()=>setTheme(value=>{const next=value==="light"?"dark":"light";try{localStorage.setItem("doc-academy.theme",next);}catch{}return next;});
 if(!sessionChecked)return <div className="access-page"><p>Preparando seu acesso…</p></div>;
 if(!auth||!authenticated||path==="/acesso")return <AccessScreen configured={!!auth} signedIn={authenticated}/>;
 if(error&&!ready)return <div className="access-page"><section className="panel access-card"><h1>Vamos conferir seu acesso</h1><p role="alert">{error}</p><button className="button button-primary" onClick={()=>void refresh()}>Tentar novamente</button><button className="button button-secondary" onClick={signOut}>Sair da conta</button></section></div>;
 if(!ready||!me)return <div className="access-page"><p>Carregando sua jornada…</p></div>;

 const activeCartorio = (me?.cartorioId ? state.cartorios.find(c => c.id === me.cartorioId) : null)
  || (simulatedCartorioId ? state.cartorios.find(c => c.id === simulatedCartorioId) : null)
  || null;

 const isClientEnvironment = (me?.audience === "client") || !!simulatedCartorioId;

 const denied = (!simulatedCartorioId && path.startsWith("/admin") && me.role !== "admin")
  || (!simulatedCartorioId && path.startsWith("/equipe") && me.role === "student")
  || (me.audience === "client" && !simulatedCartorioId && (path.startsWith("/admin") || path.startsWith("/equipe") || path.startsWith("/conhecimento") || path.startsWith("/conquistas")));

 return <AcademyContext.Provider value={{state,me,update,mutate,refresh,ready,busy,notify:setToast,theme,toggleTheme,storageError:!!error,signOut,activeCartorio,simulatedCartorioId,setSimulatedCartorioId,isClientEnvironment,avatar,setAvatar}}><EngagementTracker/>{denied?<div className="access-page"><section className="panel access-card"><h1>Acesso restrito</h1><p>Seu perfil não possui permissão para esta área.</p><a className="button button-primary" href="/">Voltar ao aprendizado</a></section></div>:children}{busy&&<div className="save-indicator" role="status">Salvando no servidor…</div>}{toast&&<div className="toast" role="status">{toast}</div>}</AcademyContext.Provider>;
}
export function useAcademy(){const context=useContext(AcademyContext);if(!context)throw new Error("AcademyProvider ausente");return context;}
