"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AUTH_RESULT_EVENT, authReturnPath } from "../../../lib/auth-navigation";
import { createBrowserSupabaseClient, notifyAuthChange } from "../../../lib/supabase-client";
import { isLocale, type Locale } from "../../../i18n/routing";
import { authDialogCopy } from "../../../components/auth-dialog-copy";
import { flushLoginSuccessTracking } from "../../../lib/analytics";

function Completion() {
  const params = useSearchParams();
  const next = authReturnPath(params.get("next"));
  const error = params.get("error");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(Boolean(error));
  const [locale, setLocale] = useState<Locale>("en");
  const copy = authDialogCopy(locale);
  useEffect(() => {
    if (isLocale(document.documentElement.lang)) setLocale(document.documentElement.lang);
    let active = true;
    async function complete() {
      try {
        const { data } = await createBrowserSupabaseClient().auth.getSession();
        if (!active) return;
        const failure = error || (!data.session ? "session_missing" : null);
        setFailed(Boolean(failure)); setReady(true);
        if (!failure) notifyAuthChange();
        if (window.opener) {
          // Update authentication immediately; only wait before this window closes.
          await flushLoginSuccessTracking();
          if (!active) return;
          window.opener.postMessage({ type: AUTH_RESULT_EVENT, error: failure }, window.location.origin);
          if (!failure) window.close();
        }
      } catch { if (active) { setFailed(true); setReady(true); } }
    }
    void complete();
    return () => { active = false; };
  }, [error]);
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-5 text-[#171719]">
    <section className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-9 text-center shadow-xl">
      <h1 className="text-2xl font-semibold">{ready ? failed ? copy.error : copy.success : copy.waiting}</h1>
      {ready ? <a className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#7255ed] px-7 py-3 font-semibold text-white" href={failed ? `/auth?${new URLSearchParams({ next })}` : next}>{copy.return}</a> : null}
    </section>
  </main>;
}

export default function AuthCompletePage() {
  return <Suspense fallback={null}><Completion /></Suspense>;
}
