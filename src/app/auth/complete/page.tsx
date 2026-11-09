"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTH_RESULT_EVENT, authPostLoginPath } from "../../../lib/auth-navigation";
import { completeEmailSignIn, createBrowserSupabaseClient, notifyAuthChange } from "../../../lib/supabase-client";
import { isLocale, type Locale } from "../../../i18n/routing";
import { authDialogCopy } from "../../../components/auth-dialog-copy";
import { flushLoginSuccessTracking } from "../../../lib/analytics";

function Completion() {
  const params = useSearchParams();
  const router = useRouter();
  const next = authPostLoginPath(params.get("next"));
  const error = params.get("error");
  const email = params.get("email") === "1";
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(error);
  const [locale, setLocale] = useState<Locale>("en");
  const copy = authDialogCopy(locale);
  useEffect(() => {
    if (isLocale(document.documentElement.lang)) setLocale(document.documentElement.lang);
    let active = true;
    async function complete() {
      try {
        let reason = error;
        if (!reason && email) {
          const result = await completeEmailSignIn();
          if (!result.ok) reason = result.error || "signin_failed";
        }
        if (!active) return;
        if (reason) {
          setFailure(reason); setReady(true);
          if (window.name === "dreamface-google-login" && window.opener && !window.opener.closed) window.opener.postMessage({ type: AUTH_RESULT_EVENT, error: reason }, window.location.origin);
          return;
        }
        const { data } = await createBrowserSupabaseClient().auth.getSession();
        if (!active) return;
        const missing = !data.session ? "session_missing" : null;
        setFailure(missing); setReady(true);
        const googlePopup = window.name === "dreamface-google-login" && window.opener && !window.opener.closed;
        if (googlePopup) window.opener.postMessage({ type: AUTH_RESULT_EVENT, error: missing }, window.location.origin);
        if (missing) return;
        notifyAuthChange();
        if (googlePopup) {
          await flushLoginSuccessTracking();
          if (active) window.close();
        } else {
          // A mail application's opener may be cross-origin. Keep this tab and
          // enter the intended workspace, rather than trying to close the mail tab.
          router.replace(next);
        }
      } catch { if (active) { setFailure("signin_failed"); setReady(true); } }
    }
    void complete();
    return () => { active = false; };
  }, [error, email, next, router]);
  const message = failure === "expired_link" || failure === "invalid_link" ? copy.expiredLink : failure === "used_link" ? copy.usedLink : failure === "session_missing" ? copy.sessionMissing : copy.error;
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-5 text-[#171719]">
    <section className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-9 text-center shadow-xl">
      <h1 className="text-2xl font-semibold">{ready ? failure ? message : copy.success : copy.waiting}</h1>
      {ready ? <a className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#7255ed] px-7 py-3 font-semibold text-white" href={failure ? `/auth?${new URLSearchParams({ next })}` : next}>{failure === "expired_link" || failure === "invalid_link" || failure === "used_link" ? copy.resend : copy.return}</a> : null}
    </section>
  </main>;
}

export default function AuthCompletePage() {
  return <Suspense fallback={null}><Completion /></Suspense>;
}
