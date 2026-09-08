"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "../../../components/top-nav";
import { createBrowserSupabaseClient } from "../../../lib/supabase-client";

type Settings={enabled:boolean;inviter_credits:number;invitee_credits:number;daily_limit:number;monthly_limit:number;daily_budget:number};
type RecordRow={id:string;inviter_id:string;invitee_id:string;inviter_email:string;invitee_email:string;status:string;reason:string|null;bound_at:string;due_at:string|null};
type Report={configured:boolean;settings:Settings;records:RecordRow[];audit:Array<{id:number;actor:string;action:string;note:string;created_at:string}>;summary:Array<{status:string;count:number}>};
export default function ReferralAdmin() {
  const [token,setToken]=useState<string|null>(null);
  const [report,setReport]=useState<Report|null>(null);
  const [settings,setSettings]=useState<Settings|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [userId,setUserId]=useState("");
  useEffect(()=>{createBrowserSupabaseClient().auth.getSession().then(({data})=>{
    const value=data.session?.access_token||null;setToken(value);
    if(value) void load(value); else setMessage("Sign in with an administrator account.");
  });},[]);
  async function load(value=token) {
    if(!value)return;
    try {
      const response=await fetch("/api/admin/referrals",{headers:{Authorization:`Bearer ${value}`}});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setReport(data);setSettings({...data.settings,enabled:Boolean(data.settings.enabled)});
    } catch(e){setMessage(e instanceof Error?e.message:"Unable to load.");}
  }
  async function action(body:object,needsNote=true) {
    if(!token||busy)return;
    const note=needsNote?window.prompt("Audit note: explain what you reviewed or changed."):"";
    if(needsNote && (!note||note.trim().length<3))return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/admin/referrals",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({...body,note})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setMessage(data.failed?`Completed with ${data.failed} errors; check server logs.`:"Saved / processed successfully.");
      await load();
    } catch(e){setMessage(e instanceof Error?e.message:"Operation failed.");} finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-[#f8f7fa] px-4 pb-16 text-[#292033]"><TopNav/><div className="mx-auto mt-8 max-w-6xl">
    <Link href="/admin" className="text-sm text-violet-700">← Operations Console</Link><h1 className="mt-4 text-3xl font-bold">Referral rewards</h1>
    {message?<p role="status" className="my-4 rounded-xl bg-amber-50 p-4 text-sm">{message}</p>:null}
    {report&&settings?<>
      <p className="my-4 text-sm">Environment: {report.configured?"ready":"not configured"} · Beijing calendar quotas · Rewards are never issued solely on administrator approval.</p>
      <div className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Enable campaign</label>
        {(["inviter_credits","invitee_credits","daily_limit","monthly_limit","daily_budget"] as const).map(key=><label key={key} className="text-xs font-semibold">{key.replaceAll("_"," ")}<input type="number" min={1} value={settings[key]} onChange={e=>setSettings({...settings,[key]:Number(e.target.value)})} className="mt-2 block w-full rounded-lg border p-2 text-sm"/></label>)}
        <button type="button" disabled={busy} onClick={()=>action({action:"settings",settings})} className="rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-50">Save settings</button>
        <button type="button" disabled={busy} onClick={()=>action({action:"process"},false)} className="rounded-xl border p-3 font-bold disabled:opacity-50">Process pending rewards</button>
      </div>
      <p className="mt-4 text-sm">{report.summary.map(s=>`${s.status}: ${s.count}`).join(" · ")}</p>
      <div className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">User reward policy</h2><p className="mt-2 text-xs text-gray-500">Only affects referral rewards. Clearing an IP exclusion does not override new excluded visits. Final rejected rewards are not reopened.</p>
        <input aria-label="User ID" placeholder="User ID" value={userId} onChange={e=>setUserId(e.target.value)} className="my-3 w-full rounded-lg border p-3 text-sm"/>
        <div className="flex flex-wrap gap-2">{[{label:"Block rewards",blocked:true,clearIpExclusion:false},{label:"Unblock rewards",blocked:false,clearIpExclusion:false},{label:"Clear reviewed IP exclusion",blocked:false,clearIpExclusion:true}].map(item=><button key={item.label} type="button" disabled={busy||!userId} onClick={()=>action({action:"user_policy",userId,...item})} className="rounded-lg border p-2 text-xs font-bold disabled:opacity-40">{item.label}</button>)}</div>
      </div>
      <section className="mt-6 space-y-3"><h2 className="text-xl font-bold">Latest 200 invitations</h2>{report.records.map(r=><article key={r.id} className="rounded-xl border bg-white p-4 text-sm">
        <p className="break-all font-semibold">{r.inviter_email} → {r.invitee_email}</p><p className="mt-1 break-all text-xs text-gray-500">{r.id} · {r.status} · {r.reason||"--"} · Due (UTC): {r.due_at||"--"}</p>
        <p className="mt-1 break-all text-xs text-gray-500">Inviter: {r.inviter_id} · Invitee: {r.invitee_id}</p>
        <div className="mt-3 flex gap-2">{r.status==="review"?<button type="button" disabled={busy} onClick={()=>action({action:"approve_review",id:r.id})} className="rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-800">Approve review & recheck</button>:null}{!["paid","rejected"].includes(r.status)?<button type="button" disabled={busy} onClick={()=>action({action:"reject",id:r.id})} className="rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-800">Reject</button>:null}</div>
      </article>)}</section>
      <section className="mt-8"><h2 className="text-xl font-bold">Audit log</h2>{report.audit.map(a=><p key={a.id} className="mt-3 break-all rounded-lg bg-white p-3 text-xs">{a.created_at} · {a.actor} · {a.action} · {a.note}</p>)}</section>
    </>:null}
  </div></main>;
}
