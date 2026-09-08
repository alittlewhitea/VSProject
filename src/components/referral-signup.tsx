"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
export function ReferralSignup({initial}:{initial:string|null}) {
  const t=useTranslations("referrals");
  const [code,setCode]=useState("");
  const [status,setStatus]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{let active=true;void fetch("/api/referrals/availability").then(r=>r.json()).then(data=>{if(active)setVisible(data.visible===true);}).catch(()=>{});return()=>{active=false;};},[]);
  async function apply() {
    setBusy(true);
    try {
      const response=await fetch("/api/referrals/code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:code.trim().toLowerCase()})});
      setStatus(response.ok?"accepted":"unavailable");
    } catch {setStatus("unavailable");} finally{setBusy(false);}
  }
  if(!visible) return null;
  return <div className="my-4 rounded-xl border border-[#e5def5] bg-[#f7f4ff] p-3 text-sm">
    {status==="accepted" ? <p className="text-[#60459a]">{t("signupAccepted")}</p> : <>
      <label htmlFor="signup-referral" className="text-xs font-bold text-[#75658b]">{t("optionalCode")}</label>
      <div className="mt-2 flex gap-2"><input id="signup-referral" value={code} maxLength={24} onChange={e=>setCode(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-white p-2"/><button type="button" disabled={busy||!code.trim()} onClick={()=>void apply()} className="rounded-lg bg-[#7055f5] px-3 font-bold text-white disabled:opacity-40">{t("apply")}</button></div>
      {status==="unavailable"?<p role="status" className="mt-2 text-xs text-amber-800">{t("codeUnavailable")}</p>:null}
    </>}
  </div>;
}
