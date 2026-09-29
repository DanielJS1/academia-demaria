"use client";
import { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { normalizeVimeoRanges, type Command } from "@/lib/pilot-contract";
import { browserAuth } from "@/lib/supabase-browser";
import { useAcademy } from "./academy-provider";
import { vimeoEmbed, type Course, type Lesson } from "@/lib/model";
import { isVideoNearEnd } from "@/lib/video-completion";
import { mergeWatched } from "@/lib/pilot-contract";

export function VimeoLesson({course,lesson,preview,initialPosition=0,nextTitle,onNext}:{course:Course;lesson:Lesson;preview:boolean;initialPosition?:number;nextTitle?:string;onNext?:()=>void}){
 const ref=useRef<HTMLIFrameElement>(null);
 const {mutate,state}=useAcademy();
 const [error,setError]=useState("");
 const retrySave=useRef<()=>void>(()=>{});
 const [nearEnd,setNearEnd]=useState(false);
 const completed=(state.completed[course.id]||[]).includes(lesson.id);
 useEffect(()=>{
  if(!ref.current)return;
  const player=new Player(ref.current);
  let active=true,playing=false,inFlight=false,queued=false,wasNearEnd=false;
  let lastSent=0,lastPosition=0,lastDuration=0,activityPosition:number|null=null,activityAt=performance.now();
  let dirty=false;
  let lastCommand:Command|null=null;
  const watched:[number,number][]=[];
  let token="";
  void browserAuth()?.auth.getSession().then(({data})=>{token=data.session?.access_token||"";});
  const snapshot=async()=>{
   const [ranges,duration,position]=await Promise.all([player.getPlayed(),player.getDuration(),player.getCurrentTime()]);
   if(!active||!Number.isFinite(duration)||duration<=0)return null;
   lastDuration=duration;lastPosition=position;
   return {type:"video" as const,courseId:course.id,version:course.version,lessonId:lesson.id,duration,position,ranges:mergeWatched(normalizeVimeoRanges([...ranges,...watched]),duration).ranges as [number,number][]};
  };
  const record=async(force=false)=>{
   if(preview||!active)return;
   if(inFlight){dirty=true;if(force)queued=true;return;}
   if(!force&&Date.now()-lastSent<10000)return;
   inFlight=true;lastSent=Date.now();dirty=false;
   try{
    const command=await snapshot();
    if(!command){dirty=true;return;}
    lastCommand=command;
    const saved=await mutate(command,{silent:true});
    if(active){if(saved){setError("");}else{dirty=true;setError("Não foi possível salvar o avanço. Tentaremos novamente automaticamente.");}}
   }catch{dirty=true;if(active)setError("Não foi possível acompanhar o vídeo. Tente salvar novamente.");}
   finally{inFlight=false;if(active&&queued){queued=false;void record(true);}}
  };
  const schedule=()=>{dirty=true;void record();};
  const tick=(event:{seconds:number;duration:number})=>{
   const now=performance.now(),elapsed=(now-activityAt)/1000;
   const advance=activityPosition===null?0:event.seconds-activityPosition;
   if(playing&&activityPosition!==null&&advance>0&&advance<=elapsed*2+0.5&&elapsed<5){
    const previous=watched[watched.length-1];
    if(previous&&activityPosition>=previous[0]&&activityPosition<=previous[1]+0.25)previous[1]=Math.max(previous[1],event.seconds);
    else watched.push([activityPosition,event.seconds]);
   }
   if(!preview&&playing&&advance>0&&advance<=elapsed*2+0.5&&elapsed<5)window.dispatchEvent(new Event("academy:video-activity"));
   activityPosition=event.seconds;activityAt=now;lastPosition=event.seconds;lastDuration=event.duration;
   if(!preview&&event.duration>0)lastCommand={type:"video",courseId:course.id,version:course.version,lessonId:lesson.id,duration:event.duration,position:event.seconds,ranges:watched.slice(-1999).map(range=>[...range] as [number,number])};
   const near=isVideoNearEnd(event.seconds,event.duration);setNearEnd(near);
   if(near&&!wasNearEnd)void record(true);else schedule();
   wasNearEnd=near;
  };
  const flush=()=>void record(true);
  retrySave.current=flush;
  const retryTimer=setInterval(()=>{if(dirty)void record(true);},10000);
  void player.ready().then(async()=>{
   const duration=await player.getDuration();
   if(!active||duration<=0)return;
   if(initialPosition>0)await player.setCurrentTime(Math.min(initialPosition,Math.max(0,duration-Math.min(1,duration*0.005))));
   if(active)flush();
  }).catch(()=>{if(active)setError("Não foi possível iniciar o acompanhamento. Tente salvar novamente.");});
  const onPlay=()=>{playing=true;activityPosition=null;};
  const onPause=()=>{playing=false;activityPosition=null;flush();};
  const onSeek=()=>{activityPosition=null;};
  const onSeeked=(event:{seconds:number;duration:number})=>{activityPosition=null;tick(event);flush();};
  const onError=()=>setError("O Vimeo não conseguiu abrir esta aula. Avise o administrador.");
  const onExit=()=>{
   if(preview)return;
   const command=lastCommand?.type==="video"?{...lastCommand,position:lastPosition,duration:lastDuration||lastCommand.duration}:null;
   if(command&&token)void fetch("/api/academy",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(command),keepalive:true}).catch(()=>{});
  };
  const onVisibility=()=>{if(document.visibilityState==="hidden"){flush();onExit();}};
  player.on("timeupdate",tick);player.on("play",onPlay);player.on("seeking",onSeek);player.on("seeked",onSeeked);player.on("pause",onPause);player.on("ended",onPause);player.on("error",onError);
  window.addEventListener("pagehide",onExit);document.addEventListener("visibilitychange",onVisibility);
  return()=>{onExit();active=false;clearInterval(retryTimer);retrySave.current=()=>{};window.removeEventListener("pagehide",onExit);document.removeEventListener("visibilitychange",onVisibility);player.off("timeupdate",tick);player.off("play",onPlay);player.off("seeking",onSeek);player.off("seeked",onSeeked);player.off("pause",onPause);player.off("ended",onPause);player.off("error",onError);};
 },[course.id,course.version,lesson.id,mutate,preview,initialPosition]);
 const embed = vimeoEmbed(lesson.videoUrl)!;
 const playerUrl = `${embed}${embed.includes("?") ? "&" : "?"}transparent=0`;
 return <><div className="video-frame"><iframe key={lesson.id} ref={ref} src={playerUrl} title={lesson.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/></div>{(nearEnd||completed)&&<div className="video-next-action" aria-live="polite"><div><strong>{preview?"Final da prévia":completed?"Aula concluída!":"Final do vídeo"}</strong><p>{!preview&&!completed?"Para concluir, assista a pelo menos 50% da aula e chegue ao final. Administradores precisam apenas chegar ao final.":nextTitle?`A seguir: ${nextTitle}`:"Você chegou à última aula deste curso."}</p></div>{onNext&&<button className="button button-primary" disabled={!preview&&!completed} onClick={onNext}>Próxima aula →</button>}</div>}{error&&<div className="form-error" role="alert">{error}<button className="button button-secondary" onClick={()=>retrySave.current()}>Tentar salvar novamente</button></div>}</>;
}
