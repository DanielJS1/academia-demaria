"use client";
import { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { normalizeVimeoRanges } from "@/lib/pilot-contract";
import { useAcademy } from "./academy-provider";
import { vimeoEmbed, type Course, type Lesson } from "@/lib/model";
import { isVideoNearEnd } from "@/lib/video-completion";
export function VimeoLesson({course,lesson,preview,nextTitle,onNext}:{course:Course;lesson:Lesson;preview:boolean;nextTitle?:string;onNext?:()=>void}){
 const ref=useRef<HTMLIFrameElement>(null);const {mutate,state}=useAcademy();const [error,setError]=useState("");const [saving,setSaving]=useState(false);const [retry,setRetry]=useState(0);const [nearEnd,setNearEnd]=useState(false);
 const completed=(state.completed[course.id]||[]).includes(lesson.id);
 useEffect(()=>{
  if(!ref.current)return;
  const player=new Player(ref.current);let last=0;let active=true;let inFlight=false;let queued=false;let wasNearEnd=false;
  const record=async(force=false)=>{
   if(preview)return;
   if(inFlight){if(force)queued=true;return;}if(!force&&Date.now()-last<12000)return;inFlight=true;last=Date.now();
   try{const [ranges,duration,position]=await Promise.all([player.getPlayed(),player.getDuration(),player.getCurrentTime()]);if(!active||duration<=0)return;setSaving(true);const saved=await mutate({type:"video",courseId:course.id,version:course.version,lessonId:lesson.id,duration,position,ranges:normalizeVimeoRanges(ranges)});if(active)setError(saved?"":"Não foi possível salvar o avanço. Pause o vídeo para tentar novamente.");}catch{if(active)setError("Não foi possível acompanhar o vídeo. Confira a permissão de incorporação no Vimeo.");}finally{inFlight=false;if(active){setSaving(false);if(queued){queued=false;void record(true);}}}
  };
  let playing=false;let activityPosition:number|null=null;let activityAt=performance.now();
  const tick=(event:{seconds:number;duration:number})=>{
   const now=performance.now();const elapsed=(now-activityAt)/1000;
   const advance=activityPosition===null?0:event.seconds-activityPosition;
   if(!preview&&playing&&advance>0&&advance<=elapsed*2+0.5&&elapsed<5)window.dispatchEvent(new Event("academy:video-activity"));
   activityPosition=event.seconds;activityAt=now;
   const near=isVideoNearEnd(event.seconds,event.duration);setNearEnd(near);const entered=near&&!wasNearEnd;wasNearEnd=near;void record(entered);
  };
  const flush=()=>void record(true);
  const onPlay=()=>{playing=true;activityPosition=null;};
  const onPause=()=>{playing=false;activityPosition=null;flush();};
  const onSeek=()=>{activityPosition=null;};
  const onSeeked=()=>{activityPosition=null;flush();};
  const onError=()=>setError("O Vimeo não conseguiu abrir esta aula. Avise o administrador.");
  player.on("timeupdate",tick);player.on("play",onPlay);player.on("seeking",onSeek);player.on("seeked",onSeeked);player.on("pause",onPause);player.on("ended",onPause);player.on("error",onError);
  return()=>{active=false;player.off("timeupdate",tick);player.off("play",onPlay);player.off("seeking",onSeek);player.off("seeked",onSeeked);player.off("pause",onPause);player.off("ended",onPause);player.off("error",onError);};
 },[course.id,course.version,lesson.id,mutate,preview,retry]);
 return <><div className="video-frame"><iframe key={lesson.id} ref={ref} src={vimeoEmbed(lesson.videoUrl)!} title={lesson.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/></div>{(nearEnd||completed)&&<div className="video-next-action" aria-live="polite"><div><strong>{preview?"Final da prévia":completed?"Aula concluída!":"Registrando conclusão…"}</strong><p>{nextTitle?`A seguir: ${nextTitle}`:"Você chegou à última aula deste curso."}</p></div>{onNext&&<button className="button button-primary" disabled={!preview&&!completed} onClick={onNext}>Próxima aula →</button>}</div>}{!preview&&<p className="info-note">{saving?"Salvando seu avanço…":"Regra temporária do piloto: você pode avançar para os últimos 20 segundos para testar a conclusão. O botão é liberado após salvar o avanço."}</p>}{error&&<div className="form-error" role="alert">{error}<button className="button button-secondary" onClick={()=>setRetry(v=>v+1)}>Reconectar acompanhamento</button></div>}</>;
}

