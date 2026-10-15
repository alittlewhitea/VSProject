"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Status = { eligible: boolean; available: boolean; resetsAt?: string };
export function useH3DailyFree(token: string | null, userId: string | null) {
  const [state,setState]=useState<{key:string;status:Status} | null>(null);
  const [checkingKey,setCheckingKey]=useState<string | null>(null);
  const generation=useRef(0);
  const key=`${userId || ""}:${token || ""}`;
  const refresh=useCallback(async()=>{
    if (!token || !userId) return;
    const request=++generation.current;
    setCheckingKey(key);
    try {
      const response=await fetch("/api/generate/free-allowance",{headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(8000)});
      const status=await response.json();
      if (!response.ok) throw new Error("Free status unavailable");
      if (generation.current===request) setState({key,status:{eligible:status.eligible===true,available:status.available===true,resetsAt:status.resetsAt}});
    } catch {
      if (generation.current===request) setState({key,status:{eligible:false,available:false}});
    } finally {
      if (generation.current===request) setCheckingKey(null);
    }
  },[key,token,userId]);
  const invalidate=useCallback(()=>{
    generation.current++;
    setState(current=>current?.key===key ? {...current,status:{...current.status,available:false}} : current);
  },[key]);
  useEffect(()=>{
    void refresh();
    let last=Date.now();
    const focus=()=>{if(Date.now()-last>30000){last=Date.now();void refresh();}};
    window.addEventListener("focus",focus);
    return ()=>{generation.current++;window.removeEventListener("focus",focus);};
  },[refresh]);
  const status=state?.key===key?state.status:null;
  const expired=Boolean(status?.resetsAt && Date.parse(status.resetsAt)<=Date.now());
  useEffect(()=>{
    if(!status?.resetsAt)return;
    const timer=window.setTimeout(()=>void refresh(),Math.max(1,Date.parse(status.resetsAt)-Date.now()+100));
    return ()=>window.clearTimeout(timer);
  },[status?.resetsAt,refresh]);
  return {eligible:status?.eligible===true,available:status?.available===true&&!expired,loading:Boolean(token&&userId&&(!status||checkingKey===key)),refresh,invalidate};
}
