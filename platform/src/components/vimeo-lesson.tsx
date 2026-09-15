"use client";
import { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { normalizeVimeoRanges } from "@/lib/pilot-contract";
import { useAcademy } from "./academy-provider";
import { vimeoEmbed, type Course, type Lesson } from "@/lib/model";
export function VimeoLesson({course,lesson,preview}:{course:Course;lesson:Lesson;preview:boolean}){
 const ref=useRef<HTMLIFrameElement>(null);const {mutate}=useAcademy();const [error,setError]=useState("");const [saving,setSaving]=useState(false);const [retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!ref.current||preview)return;
  const player=new Player(ref.current);let last=0;let active=true;let inFlight=false;
  const record=async(force=false)=>{
   if(inFlight||(!force&&Date.now()-last<12000))return;inFlight=true;last=Date.now();
   try{const [ranges,duration]=await Promise.all([player.getPlayed(),player.getDuration()]);if(!active||duration<=0||!ranges.length)return;setSaving(true);const saved=await mutate({type:"video",courseId:course.id,version:course.version,lessonId:lesson.id,duration,ranges:normalizeVimeoRanges(ranges)});if(active)setError(saved?"":"Não foi possível salvar o avanço. Mantenha a aula aberta e tente novamente.");}catch{if(active)setError("Não foi possível acompanhar o vídeo. Confira a permissão de incorporação no Vimeo.");}finally{inFlight=false;if(active)setSaving(false);}
  };
  const tick=()=>void record();const flush=()=>void record(true);const onError=()=>setError("O Vimeo não conseguiu abrir esta aula. Avise o administrador.");
  player.on("timeupdate",tick);player.on("pause",flush);player.on("ended",flush);player.on("error",onError);
  return()=>{active=false;player.off("timeupdate",tick);player.off("pause",flush);player.off("ended",flush);player.off("error",onError);};
 },[course.id,course.version,lesson.id,mutate,preview,retry]);
 return <><div className="video-frame"><iframe key={lesson.id} ref={ref} src={vimeoEmbed(lesson.videoUrl)!} title={lesson.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/></div>{!preview&&<p className="info-note">{saving?"Salvando seu avanço…":"Seu avanço é salvo durante a reprodução. Assista a pelo menos 90% da aula para concluí-la; pausar também salva o progresso."}</p>}{error&&<div className="form-error" role="alert">{error}<button className="button button-secondary" onClick={()=>setRetry(v=>v+1)}>Reconectar acompanhamento</button></div>}</>;
}

