"use client";
import {useEffect,useState} from "react";
import {wavDataUrlSeconds} from "../../lib/generation-billing-normalize";

type AudioCheck={input:string;audioUrl:string;seconds:number;billableSeconds:number;error?:string;loading:boolean};
export function useVerifiedAvatarAudio(token:string|null,input:string,enabled:boolean) {
  const [result,setResult]=useState<AudioCheck|null>(null);
  const value=input.trim(),wav=enabled&&value?wavDataUrlSeconds(value):null;
  useEffect(()=>{
    if(!enabled||!value||wav!==null){setResult(null);return;}
    if(!token){setResult(null);return;}
    const controller=new AbortController();
    setResult({input:value,audioUrl:"",seconds:0,billableSeconds:0,loading:true});
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch("/api/generate/audio/inspect",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({audioUrl:value}),signal:controller.signal});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||"Audio could not be verified.");
        if(typeof payload.audioUrl!=="string"||!Number.isFinite(payload.billableSeconds)||payload.billableSeconds<1)throw new Error("Audio could not be verified.");
        if(!controller.signal.aborted)setResult({...payload,input:value,loading:false});
      } catch(error) {if(!controller.signal.aborted)setResult({input:value,audioUrl:"",seconds:0,billableSeconds:0,loading:false,error:error instanceof Error?error.message:"Audio could not be verified."});}
    },450);
    return()=>{clearTimeout(timer);controller.abort();};
  },[enabled,value,token,wav]);
  if(!enabled||!value)return {audioUrl:value,seconds:0,billableSeconds:0,loading:false,error:undefined};
  if(wav!==null)return {audioUrl:value,seconds:wav,billableSeconds:Math.min(15,Math.max(1,Math.ceil(wav-0.05))),loading:false,error:wav>15.05?"AI Avatar audio must be 15 seconds or shorter.":undefined};
  return result?.input===value?result:{input:value,audioUrl:"",seconds:0,billableSeconds:0,loading:Boolean(token),error:undefined};
}
