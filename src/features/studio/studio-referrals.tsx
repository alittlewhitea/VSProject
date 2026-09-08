"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { referralTranslator } from "../../lib/referral-i18n";

export type ReferralDashboardData = {
  enabled:boolean;url?:string;code?:string;verified?:boolean;eligible?:boolean;generated?:boolean;
  settings?:{inviterCredits:number;inviteeCredits:number;dailyLimit:number;monthlyLimit:number};
  usage?:{daily:number;monthly:number;earned:number;pending:number};
  history?:Array<{id:string;status:string;bound_at:string;paid_at:string|null;inviter_credits:number}>;
  incoming?:{status:string;invitee_credits:number}|null;
};
export function StudioReferrals({accessToken,locale,previewData}:{accessToken:string|null;locale:string;previewData?:ReferralDashboardData}) {
  const t=useMemo(()=>referralTranslator(locale),[locale]);
  const [data,setData]=useState<ReferralDashboardData|null>(previewData??null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    if(previewData) return;
    if(!accessToken) return;
    setBusy(true);
    try {
      const r=await fetch("/api/referrals",{headers:{Authorization:`Bearer ${accessToken}`}});
      if(!r.ok) throw new Error();
      setData(await r.json());
    } catch { setMessage(t("unavailable")); }
    finally { setBusy(false); }
  },[accessToken,t,previewData]);
  useEffect(()=>{void refresh(); const timer=setInterval(()=>void refresh(),30000); return ()=>clearInterval(timer);},[refresh]);
  const state=(status:string)=> {
    const known = status === "waiting" || status === "pending" || status === "review" || status === "paid" || status === "rejected" ? status : "review";
    return t(`status.${known}`);
  };
  async function copy(value:string) {
    try {await navigator.clipboard.writeText(value);setMessage(t("copied"));}
    catch {setMessage(t("copyManually"));}
  }
  return <section className="mx-auto w-full max-w-4xl px-3 py-6 pb-28 sm:px-6">
    <div className="rounded-3xl border border-[#e6e0ff] bg-gradient-to-br from-[#f0ebff] to-white p-6 sm:p-8">
      <p className="text-3xl" aria-hidden="true">🎁</p><h1 className="mt-3 text-2xl font-black text-[#241934]">{t("title")}</h1>
      <p className="mt-3 text-sm leading-6 text-[#72667e]">{t("intro",{inviter:data?.settings?.inviterCredits??100,invitee:data?.settings?.inviteeCredits??100})}</p>
      {!accessToken ? <Link className="mt-5 inline-block rounded-xl bg-[#7055f5] px-5 py-3 font-bold text-white" href="/auth?next=%2Fstudio%3Fview%3Dreferrals">{t("signIn")}</Link> : null}
      {accessToken && data && !data.enabled ? <p className="mt-4 rounded-xl bg-white p-4 text-sm">{t("disabled")}</p> : null}
      {data?.enabled ? <>
        {!data.eligible ? <p className="mt-4 text-sm text-amber-800">{t("ineligible")}</p> : null}
        {!data.verified ? <p className="mt-3 text-sm text-amber-800">{t("verify")}</p> : null}
        {!data.generated ? <p className="mt-3 text-sm text-amber-800">{t("generate")}</p> : null}
        <label className="mt-6 block text-xs font-bold text-[#75658b]" htmlFor="referral-link">{t("link")}</label>
        <input id="referral-link" readOnly value={data.url||""} className="mt-2 w-full rounded-xl border border-[#ded6f4] bg-white p-3 text-sm" onFocus={e=>e.target.select()} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!data.eligible} onClick={()=>copy(data.url||"")} className="rounded-xl bg-[#7055f5] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{t("copyLink")}</button>
          <button type="button" disabled={!data.eligible} onClick={()=>copy(data.code||"")} className="rounded-xl border border-[#ded6f4] bg-white px-4 py-3 text-sm font-bold disabled:opacity-40">{t("copyCode")}</button>
          <button type="button" disabled={busy} onClick={()=>void refresh()} className="rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40">{t("refresh")}</button>
        </div>
      </> : null}
      {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
    </div>
    {data?.enabled ? <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        [t("today"),`${data.usage?.daily??0}/${data.settings?.dailyLimit}`],
        [t("month"),`${data.usage?.monthly??0}/${data.settings?.monthlyLimit}`],
        [t("earned"),`${data.usage?.earned??0}`],[t("pendingCredits"),`${data.usage?.pending??0}`]
      ].map(([label,value])=><div key={label} className="rounded-2xl border border-[#eee9f7] bg-white p-4"><p className="text-xs text-[#82748d]">{label}</p><p className="mt-2 text-2xl font-black text-[#38234b]">{value}</p></div>)}</div>
      {data.incoming ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{t("incoming",{credits:data.incoming.invitee_credits})} · {state(data.incoming.status)}</div> : null}
      <div className="mt-5 rounded-2xl border border-[#eee9f7] bg-white p-5"><h2 className="font-bold">{t("rulesTitle")}</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#74677f]">{t("rules",{daily:data.settings?.dailyLimit??3,monthly:data.settings?.monthlyLimit??30})}</p></div>
      <div className="mt-5 rounded-2xl border border-[#eee9f7] bg-white p-5"><h2 className="font-bold">{t("history")}</h2>
        {!data.history?.length ? <p className="mt-4 text-sm text-[#82748d]">{t("empty")}</p> : <ul className="mt-3 divide-y divide-[#eee9f7]">{data.history.map((r,i)=><li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm"><span>{t("friend")} #{data.history!.length-i} <span className="text-xs text-[#82748d]">{r.bound_at.slice(0,10)}</span></span><span>{state(r.status)} {r.status==="paid"?`+${r.inviter_credits} Credits`:""}</span></li>)}</ul>}
        <p className="mt-4 text-xs leading-5 text-[#82748d]">{t("support")}</p>
      </div>
    </> : null}
  </section>;
}
