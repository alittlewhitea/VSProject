"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { isLocale, isRtlLocale, type Locale } from "../i18n/routing";
import { AUTH_RESULT_EVENT, authReturnPath, openGoogleSignInPopup, type SignInRequest } from "../lib/auth-navigation";
import { createBrowserSupabaseClient, getCachedAuthSession, hasResolvedAuthSession, notifyAuthChange, type AuthSession } from "../lib/supabase-client";
import { trackEvent } from "../lib/analytics";
import { useStudioDialog } from "../features/studio/use-studio-dialog";
import { ReferralSignup } from "./referral-signup";
import { authDialogCopy } from "./auth-dialog-copy";
import { EMAIL_CODE_LENGTH } from "../lib/auth-email-policy";
import { useEmailCodeSignIn } from "../lib/use-email-code-sign-in";
import styles from "./auth-dialog.module.css";
import { GoogleIcon } from "./google-icon";
import googleStyles from "./google-sign-in.module.css";

export default function AuthDialog({ request, onClose }: { request: SignInRequest; onClose: (signedIn?: boolean) => void }) {
  const router = useRouter();
  const [locale] = useState<Locale>(() => isLocale(document.documentElement.lang) ? document.documentElement.lang : "en");
  const copy = authDialogCopy(locale);
  const [googleBusy, setGoogleBusy] = useState(Boolean(request.googlePopup));
  const [readyToShow, setReadyToShow] = useState(() => hasResolvedAuthSession() && !getCachedAuthSession());
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(request.googlePopup === null);
  const dialog = useRef<HTMLDivElement>(null);
  const popup = useRef<Window | null>(request.googlePopup || null);
  const popupCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);
  const latest = useRef({ request, onClose });
  latest.current = { request, onClose };
  const next = authReturnPath(request.next);
  const emailSignIn = useEmailCodeSignIn({ next, surface: "dialog" });
  const { email, code, sent, remaining } = emailSignIn;
  const busy = googleBusy || emailSignIn.busy !== null;
  useStudioDialog(readyToShow, dialog, { onClose });

  useEffect(() => {
    if (popupCloseTimer.current) clearTimeout(popupCloseTimer.current);
    trackEvent("auth_view", { surface: "dialog", next });
    if (request.googlePopup) trackEvent("login_started", { method: "google", surface: "home", next });
    const client = createBrowserSupabaseClient();
    function finish(session: AuthSession) {
      if (completed.current) return;
      completed.current = true;
      notifyAuthChange();
      try { popup.current?.close(); } catch { /* Mobile OAuth may isolate the other tab. */ }
      latest.current.onClose(true);
      latest.current.request.onSuccess?.(session);
      if (latest.current.request.redirectOnSuccess && !latest.current.request.onSuccess) router.push(next);
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
      else setReadyToShow(true);
    });
    if (!hasResolvedAuthSession()) {
      void client.auth.getSession().then(
        ({ data: result }) => {
          if (result.session) finish(result.session);
          else setReadyToShow(true);
        },
        () => setReadyToShow(true)
      );
    }
    const message = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== AUTH_RESULT_EVENT) return;
      if (event.data.error) { setError(copy.error); setGoogleBusy(false); }
      else notifyAuthChange();
    };
    window.addEventListener("message", message);
    return () => {
      data.subscription.unsubscribe(); window.removeEventListener("message", message);
      // Strict Mode replays setup/cleanup when the dialog mounts in development.
      popupCloseTimer.current = setTimeout(() => { try { popup.current?.close(); } catch { /* Isolated mobile OAuth tab. */ } }, 0);
    };
  }, [next, copy.error, router]);

  useEffect(() => {
    if (!googleBusy) return;
    const timer = window.setInterval(() => {
      if (popup.current?.closed) { popup.current = null; setGoogleBusy(false); notifyAuthChange(); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [googleBusy]);

  function google() {
    setError(""); setBlocked(false);
    // Open directly from the click, before any async work, to avoid popup blocking.
    popup.current = openGoogleSignInPopup(next);
    if (!popup.current) { setBlocked(true); setGoogleBusy(false); return; }
    setGoogleBusy(true);
    trackEvent("login_started", { method: "google", surface: "dialog", next });
  }

  function redirectGoogle() {
    if (request.onBeforeRedirect?.() === false) { setError(copy.error); return; }
    window.location.assign(`/api/auth/google/start?${new URLSearchParams({ next })}`);
  }

  if (!readyToShow) return null;

  return createPortal(<div className={styles.backdrop} data-auth-dialog-backdrop onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description" tabIndex={-1} className={styles.dialog} dir={isRtlLocale(locale) ? "rtl" : "ltr"} data-auth-dialog>
      <button type="button" className={styles.close} aria-label={copy.close} onClick={() => onClose()}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      {!sent ? <div className={styles.badgeWrap}><span className={styles.badge}>{request.highlightBadge || copy.starterBadge}</span></div> : null}
      <h2 id="auth-dialog-title">{sent ? copy.inbox : request.title || copy.title}</h2>
      <p id="auth-dialog-description" className={styles.description} aria-live="polite">{sent ? emailSignIn.error === "deliveryUnconfirmed" ? email : copy.sent.replace("{email}", email) : request.subtitle || copy.subtitle}</p>
      {sent ? <form onSubmit={event => { event.preventDefault(); void emailSignIn.verify(); }}>
        <label className={styles.label} htmlFor="auth-dialog-code">{copy.code}</label>
        <input id="auth-dialog-code" name="code" type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={code}
          onChange={event => emailSignIn.changeCode(event.target.value)} autoFocus disabled={busy} className={`${styles.input} ${styles.codeInput}`} />
        <button type="submit" className={styles.primary} disabled={busy || code.length !== EMAIL_CODE_LENGTH}>{emailSignIn.busy === "verify" ? copy.waiting : copy.verify}</button>
        <div className={styles.codeActions}>
          <button type="button" className={styles.secondary} onClick={() => void emailSignIn.send()} disabled={busy || remaining > 0}>{copy.resend}{remaining > 0 ? ` (${remaining}s)` : ""}</button>
          <button type="button" className={styles.secondary} onClick={emailSignIn.useDifferentEmail} disabled={busy}>{copy.change}</button>
        </div>
      </form> : <>
        <button type="button" className={`${googleStyles.button} ${styles.google}`} onClick={google} disabled={busy}>
          <GoogleIcon />
          {googleBusy ? copy.waiting : copy.google}
        </button>
        <div className={styles.divider}><span />{copy.or}<span /></div>
        <form onSubmit={event => { event.preventDefault(); setError(""); setBlocked(false); void emailSignIn.send(); }}>
          <label className={styles.label} htmlFor="auth-dialog-email">{copy.email}</label>
          <input id="auth-dialog-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={event => emailSignIn.changeEmail(event.target.value)} required disabled={busy} dir="ltr" className={styles.input} />
          <button type="submit" className={styles.primary} disabled={!email.trim() || busy || remaining > 0}>{emailSignIn.busy === "send" ? copy.waiting : copy.continue}{remaining > 0 ? ` (${remaining}s)` : ""}</button>
        </form>
        <ReferralSignup compact initial={request.referral || null} />
      </>}
      {blocked ? <div className={styles.notice} role="status"><p>{copy.blocked}</p><button type="button" className={styles.secondary} onClick={redirectGoogle}>{copy.redirect}</button></div> : null}
      {emailSignIn.error || error ? <p role="alert" className={styles.error}>{emailSignIn.error ? copy[emailSignIn.error] : error}</p> : null}
    </div>
  </div>, document.body);
}
