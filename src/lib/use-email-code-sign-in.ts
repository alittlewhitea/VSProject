"use client";

import { useRef, useState } from "react";
import { EMAIL_CODE_LENGTH, normalizeSignInEmail } from "./auth-email-policy";
import { useEmailSignInCooldown } from "./use-email-sign-in-cooldown";
import { createBrowserSupabaseClient } from "./supabase-client";
import { trackEvent } from "./analytics";

const codeFailure = {
  invalid_code: "invalidCode",
  expired_code: "expiredCode",
  used_code: "expiredCode",
  code_rate_limited: "codeRateLimited"
} as const;
type EmailError = (typeof codeFailure)[keyof typeof codeFailure] | "invalid" | "deliveryUnconfirmed" | "error";

export function useEmailCodeSignIn({ next, surface, onVerified }: { next: string; surface: "dialog" | "page"; onVerified?: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<EmailError | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const inFlight = useRef(false);
  const { remaining, startCooldown } = useEmailSignInCooldown(email);

  async function send() {
    if (inFlight.current || remaining > 0) return;
    const address = normalizeSignInEmail(email);
    if (!address) { setError("invalid"); return; }
    inFlight.current = true;
    setBusy("send");
    setError(null);
    trackEvent("login_started", { method: "email", surface, next });
    try {
      const result = await createBrowserSupabaseClient().auth.signInWithOtp({ email: address });
      startCooldown(address, result.retryAfterSeconds);
      if (result.error && !result.recentEmail && !result.codePending) throw result.error;
      setEmail(address);
      if (!result.recentEmail) setCode("");
      setSent(true);
      if (result.codePending) setError("deliveryUnconfirmed");
      if (!result.error) trackEvent("login_email_code_sent", { method: "email", surface, next });
    } catch {
      setError("error");
      trackEvent("login_failed", { method: "email", surface });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function verify() {
    if (inFlight.current || !sent || code.length !== EMAIL_CODE_LENGTH) return;
    inFlight.current = true;
    setBusy("verify");
    setError(null);
    try {
      const result = await createBrowserSupabaseClient().auth.verifyEmailCode({ email, code });
      if (result.ok) { onVerified?.(); return; }
      setError(codeFailure[result.error as keyof typeof codeFailure] || "error");
      trackEvent("login_failed", { method: "email", surface });
    } catch {
      setError("error");
      trackEvent("login_failed", { method: "email", surface });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return {
    email, code, sent, busy, error, remaining, send, verify,
    changeEmail(value: string) { setEmail(value); setError(null); },
    changeCode(value: string) { setCode(value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH)); setError(null); },
    useDifferentEmail() { setSent(false); setCode(""); setError(null); }
  };
}
