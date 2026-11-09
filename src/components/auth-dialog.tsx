"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { isLocale, isRtlLocale, type Locale } from "../i18n/routing";
import { AUTH_RESULT_EVENT, authCompletionPath, authReturnPath, openGoogleSignInPopup, type SignInRequest } from "../lib/auth-navigation";
import { createBrowserSupabaseClient, notifyAuthChange, type AuthSession } from "../lib/supabase-client";
import { trackEvent } from "../lib/analytics";
import { useStudioDialog } from "../features/studio/use-studio-dialog";
import { ReferralSignup } from "./referral-signup";
import { authDialogCopy } from "./auth-dialog-copy";
import styles from "./auth-dialog.module.css";
import { GoogleIcon } from "./google-icon";
import googleStyles from "./google-sign-in.module.css";

export default function AuthDialog({ request, onClose }: { request: SignInRequest; onClose: (signedIn?: boolean) => void }) {
  const router = useRouter();
  const [locale] = useState<Locale>(() => isLocale(document.documentElement.lang) ? document.documentElement.lang : "en");
  const copy = authDialogCopy(locale);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(request.googlePopup ? "google" : null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(request.googlePopup === null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const dialog = useRef<HTMLDivElement>(null);
  const popup = useRef<Window | null>(request.googlePopup || null);
  const popupCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);
  const latest = useRef({ request, onClose });
  latest.current = { request, onClose };
  const next = authReturnPath(request.next);
  useStudioDialog(true, dialog, { onClose });

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
    const { data } = client.auth.onAuthStateChange((_event, session) => { if (session) finish(session); });
    const message = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== AUTH_RESULT_EVENT) return;
      if (event.data.error) { setError(copy.error); setBusy(null); }
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
    if (!sent && busy !== "google" && !retryAt) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (popup.current?.closed) { popup.current = null; setBusy(null); notifyAuthChange(); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sent, busy, retryAt]);

  async function sendEmail(event?: FormEvent) {
    event?.preventDefault();
    if (busy || Date.now() < retryAt) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError(copy.invalid); return; }
    setBusy("email"); setError("");
    trackEvent("login_started", { method: "email", surface: "dialog", next });
    try {
      const response = await fetch("/api/auth/email/start", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address, next: authCompletionPath(next) }) });
      if (!response.ok) {
        if (response.status === 429) setRetryAt(Date.now() + Math.max(60, Number(response.headers.get("Retry-After")) || 60) * 1000);
        throw new Error(copy.error);
      }
      setEmail(address); setSent(true); setRetryAt(Date.now() + 60000); setNow(Date.now());
      trackEvent("login_magic_link_sent", { method: "email", surface: "dialog", next });
    } catch {
      setError(copy.error);
      trackEvent("login_failed", { method: "email", surface: "dialog" });
    } finally { setBusy(null); }
  }

  function google() {
    setError(""); setBlocked(false);
    // Open directly from the click, before any async work, to avoid popup blocking.
    popup.current = openGoogleSignInPopup(next);
    if (!popup.current) { setBlocked(true); setBusy(null); return; }
    setBusy("google");
    trackEvent("login_started", { method: "google", surface: "dialog", next });
  }

  function redirectGoogle() {
    if (request.onBeforeRedirect?.() === false) { setError(copy.error); return; }
    window.location.assign(`/api/auth/google/start?${new URLSearchParams({ next })}`);
  }

  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return createPortal(<div className={styles.backdrop} data-auth-dialog-backdrop onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description" tabIndex={-1} className={styles.dialog} dir={isRtlLocale(locale) ? "rtl" : "ltr"} data-auth-dialog>
      <button type="button" className={styles.close} aria-label={copy.close} onClick={() => onClose()}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      <h2 id="auth-dialog-title">{sent ? copy.inbox : copy.title}</h2>
      <p id="auth-dialog-description" className={styles.description}>{sent ? copy.sent.replace("{email}", email) : copy.subtitle}</p>
      {sent ? <div className={styles.sent}>
        <div className={styles.mail} aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></div>
        <p role="status">{copy.waiting}</p>
        <button type="button" className={styles.primary} onClick={() => void sendEmail()} disabled={!!busy || remaining > 0}>{copy.resend}{remaining > 0 ? ` (${remaining}s)` : ""}</button>
        <button type="button" className={styles.secondary} onClick={() => { setSent(false); setError(""); }}>{copy.change}</button>
      </div> : <>
        <button type="button" className={`${googleStyles.button} ${styles.google}`} onClick={google} disabled={!!busy}>
          <GoogleIcon />
          {busy === "google" ? copy.waiting : copy.google}
        </button>
        <div className={styles.divider}><span />{copy.or}<span /></div>
        <form onSubmit={sendEmail}>
          <label className={styles.label} htmlFor="auth-dialog-email">{copy.email}</label>
          <input id="auth-dialog-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required disabled={!!busy} dir="ltr" className={styles.input} />
          <button type="submit" className={styles.primary} disabled={!email.trim() || !!busy || remaining > 0}>{busy === "email" ? "…" : copy.continue}{remaining > 0 ? ` (${remaining}s)` : ""}</button>
        </form>
        <ReferralSignup compact initial={request.referral || null} />
      </>}
      {blocked ? <div className={styles.notice} role="status"><p>{copy.blocked}</p><button type="button" className={styles.secondary} onClick={redirectGoogle}>{copy.redirect}</button></div> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div>
  </div>, document.body);
}
