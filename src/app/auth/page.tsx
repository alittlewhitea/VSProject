"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import { AppButton } from "../../components/ui/button";
import { trackEvent } from "../../lib/analytics";
import { ReferralSignup } from "../../components/referral-signup";
import { authDialogCopy } from "../../components/auth-dialog-copy";
import { isLocale } from "../../i18n/routing";
import { EMAIL_CODE_LENGTH } from "../../lib/auth-email-policy";
import { authPostLoginPath } from "../../lib/auth-navigation";
import { useEmailCodeSignIn } from "../../lib/use-email-code-sign-in";

const emailInputClass = "mt-2 w-full rounded-[1rem] border border-black/[0.08] bg-[#f8fbff] px-4 py-3 text-[#171719] outline-none transition placeholder:text-[#99a1b3] focus:border-[#10bff3] focus:bg-white focus:ring-4 focus:ring-[#10bff3]/10";
const emailSubmitClass = "mt-4 min-h-[56px] w-full rounded-[1.1rem] bg-[#08bdf2] text-base font-black text-[#08232d] shadow-[0_18px_38px_rgba(8,189,242,0.24)] hover:bg-[#15c8fa]";

function AuthContent() {
  const t = useTranslations();
  const locale = useLocale();
  const copy = authDialogCopy(isLocale(locale) ? locale : "en");
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = authPostLoginPath(sp.get("next") || "/studio?mode=image&workflow=text-to-image");
  const providerParam = sp.get("provider");
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const emailSignIn = useEmailCodeSignIn({ next: nextPath, surface: "page", onVerified: () => router.replace(nextPath) });
  const { email, code, sent, remaining } = emailSignIn;
  const busy = googleLoading || emailSignIn.busy !== null;
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const autoGoogleStartedRef = useRef(false);

  useEffect(() => {
    trackEvent("auth_view", { next: nextPath });
  }, [nextPath]);

  async function signInWithGoogle(auto = false) {
    setGoogleLoading(true);
    setGoogleMessage(auto ? t("auth.googleOpening") : "");
    trackEvent("login_started", { method: "google", next: nextPath });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${nextPath}`
        }
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      setGoogleMessage(error instanceof Error ? error.message : t("auth.googleFailed"));
      trackEvent("login_failed", { method: "google", error: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    if (providerParam !== "google" || autoGoogleStartedRef.current) return;
    autoGoogleStartedRef.current = true;
    signInWithGoogle(true);
  }, [providerParam, nextPath]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fb] px-4 py-6 text-[#1d1d1f] sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(48rem_28rem_at_12%_-10%,rgba(8,189,242,0.16),transparent_60%),radial-gradient(40rem_24rem_at_88%_-8%,rgba(255,200,221,0.30),transparent_58%),radial-gradient(34rem_22rem_at_54%_8%,rgba(134,239,172,0.16),transparent_60%),linear-gradient(180deg,#ffffff_0%,#f5f5f7_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-32 bg-gradient-to-b from-white/80 to-transparent" />

      <div className="relative mx-auto max-w-[1240px]">
        <header className="flex items-center justify-between rounded-[1.35rem] border border-black/[0.06] bg-white/78 px-4 py-3 shadow-[0_14px_34px_rgba(18,24,40,0.06)] backdrop-blur sm:rounded-[1.8rem] sm:px-6">
          <Link href="/" className="text-xl font-black tracking-tight text-[#171719] sm:text-2xl">
            {t("auth.brand")}
          </Link>
          <Link href="/" className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-bold text-[#2f2f32] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            {t("auth.backHome")}
          </Link>
        </header>

        <div className="grid min-h-[calc(100vh-7.5rem)] items-center gap-8 py-8 lg:grid-cols-[1fr_0.78fr] lg:gap-12 lg:py-12">
          <section className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0ea5e9]">{t("auth.eyebrow")}</p>
            <h1 className="mt-4 text-[clamp(3.1rem,12vw,5.8rem)] font-black leading-[0.92] tracking-tight text-[#2f2f32] lg:text-[clamp(4.2rem,6.8vw,7.5rem)]">
              {t("auth.signup.title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-[#3f4148] sm:text-xl sm:leading-8 lg:mx-0">
              {t("auth.signup.description")}
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[t("auth.benefit.freeCredits"), t("auth.benefit.projectHistory"), t("auth.benefit.google")].map((item) => (
                <div key={item} className="rounded-2xl border border-black/[0.06] bg-white/78 px-4 py-3 text-sm font-black text-[#3f4148] shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </section>

          <section className="relative overflow-hidden rounded-[2rem] border border-black/[0.07] bg-white/92 p-5 shadow-[0_28px_80px_rgba(16,27,48,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur md:p-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#bde0fe]/48 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-52 w-52 rounded-full bg-[#ffc8dd]/28 blur-3xl" />

          <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#697386]">{t("auth.login.eyebrow")}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#171719] sm:text-4xl">{t("auth.login.title")}</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-[#606676]">{copy.loginDescription}</p>

            <button
              type="button"
              onClick={() => signInWithGoogle()}
              disabled={busy}
                className="mt-7 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[1.15rem] border border-black/[0.07] bg-white px-5 py-3 text-base font-black text-[#171719] shadow-[0_18px_42px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(15,23,42,0.14)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-black/10 bg-white text-lg font-black text-[#4285f4]">G</span>
              {googleLoading ? t("auth.googleOpening") : t("auth.google")}
            </button>

              <div className="my-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-[#8b95a7]">
                <span className="h-px flex-1 bg-black/[0.08]" />
              {t("auth.emailDivider")}
                <span className="h-px flex-1 bg-black/[0.08]" />
            </div>

            {sent ? <form onSubmit={event => { event.preventDefault(); void emailSignIn.verify(); }}>
              <p id="auth-email-code-description" role="status" className="mb-3 break-words text-sm text-[#606676]">
                {emailSignIn.error === "deliveryUnconfirmed" ? email : copy.sent.replace("{email}", email)}
              </p>
              <label className="block text-sm font-bold text-[#4b5563]" htmlFor="auth-email-code">{copy.code}</label>
              <input id="auth-email-code" name="code" type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
                aria-describedby="auth-email-code-description" value={code} onChange={event => emailSignIn.changeCode(event.target.value)}
                disabled={busy} autoFocus className={`${emailInputClass} tracking-[.28em] tabular-nums`} />
              <AppButton type="submit" disabled={busy || code.length !== EMAIL_CODE_LENGTH} className={emailSubmitClass}>
                {emailSignIn.busy === "verify" ? copy.waiting : copy.verify}
              </AppButton>
              <div className="mt-3 flex flex-wrap justify-between gap-3 text-sm font-medium text-[#146687]">
                <button type="button" onClick={() => void emailSignIn.send()} disabled={busy || remaining > 0} className="py-2 disabled:opacity-50">
                  {copy.resend}{remaining > 0 ? ` (${remaining}s)` : ""}
                </button>
                <button type="button" onClick={emailSignIn.useDifferentEmail} disabled={busy} className="py-2 disabled:opacity-50">{copy.change}</button>
              </div>
            </form> : <>
              <ReferralSignup initial={sp.get("referral")} />
              <form onSubmit={event => { event.preventDefault(); setGoogleMessage(""); void emailSignIn.send(); }}>
                <label className="block text-sm font-bold text-[#4b5563]" htmlFor="auth-email-address">{t("auth.emailLabel")}</label>
                <input id="auth-email-address" name="email" type="email" value={email} onChange={event => emailSignIn.changeEmail(event.target.value)}
                  dir="ltr" disabled={busy} required autoComplete="email" className={emailInputClass} placeholder={t("auth.emailPlaceholder")} />
                <AppButton type="submit" disabled={!email.trim() || busy || remaining > 0} className={emailSubmitClass}>
                  {emailSignIn.busy === "send" ? copy.waiting : copy.continue}{remaining > 0 ? ` (${remaining}s)` : ""}
                </AppButton>
              </form>
            </>}

            {emailSignIn.error || googleMessage ? (
              <p role={googleLoading ? "status" : "alert"} className="mt-4 rounded-2xl border border-[#fb7185]/25 bg-[#fff1f2] px-4 py-3 text-sm text-[#b03439]">
                {emailSignIn.error ? copy[emailSignIn.error] : googleMessage}
              </p>
            ) : null}

              <p className="mt-5 text-center text-xs font-medium leading-5 text-[#7a8496]">
                {t("auth.footerNote")}
            </p>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthContent />
    </Suspense>
  );
}
