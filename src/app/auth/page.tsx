"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import { AppButton } from "../../components/ui/button";
import { trackEvent } from "../../lib/analytics";

function AuthContent() {
  const t = useTranslations();
  const sp = useSearchParams();
  const nextPath = sp.get("next") || "/studio?mode=image&workflow=text-to-image";
  const providerParam = sp.get("provider");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"ok" | "error" | "idle">("idle");
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const autoGoogleStartedRef = useRef(false);

  useEffect(() => {
    trackEvent("auth_view", { next: nextPath });
  }, [nextPath]);

  async function signInWithEmail() {
    setLoading(true);
    setMsg("");
    trackEvent("login_started", { method: "email", next: nextPath });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${nextPath}`
        }
      });
      if (error) {
        throw error;
      }
      setTone("ok");
      setMsg(t("auth.successMagicLink"));
      trackEvent("login_magic_link_sent", { method: "email", next: nextPath });
    } catch (error) {
      setTone("error");
      setMsg(error instanceof Error ? error.message : t("auth.emailFailed"));
      trackEvent("login_failed", { method: "email", error: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle(auto = false) {
    setLoading(true);
    setMsg(auto ? t("auth.googleOpening") : "");
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
      setTone("error");
      setMsg(error instanceof Error ? error.message : t("auth.googleFailed"));
      trackEvent("login_failed", { method: "google", error: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
      setLoading(false);
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
              <p className="mt-3 text-sm font-medium leading-6 text-[#606676]">{t("auth.login.description")}</p>

            <button
              type="button"
              onClick={() => signInWithGoogle()}
              disabled={loading}
                className="mt-7 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[1.15rem] border border-black/[0.07] bg-white px-5 py-3 text-base font-black text-[#171719] shadow-[0_18px_42px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(15,23,42,0.14)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-black/10 bg-white text-lg font-black text-[#4285f4]">G</span>
              {loading && providerParam === "google" ? t("auth.googleOpening") : t("auth.google")}
            </button>

              <div className="my-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-[#8b95a7]">
                <span className="h-px flex-1 bg-black/[0.08]" />
              {t("auth.emailDivider")}
                <span className="h-px flex-1 bg-black/[0.08]" />
            </div>

            <label className="block">
                <span className="text-sm font-bold text-[#4b5563]">{t("auth.emailLabel")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-[1rem] border border-black/[0.08] bg-[#f8fbff] px-4 py-3 text-[#171719] outline-none transition placeholder:text-[#99a1b3] focus:border-[#10bff3] focus:bg-white focus:ring-4 focus:ring-[#10bff3]/10"
                placeholder={t("auth.emailPlaceholder")}
              />
            </label>

            <div className="mt-4">
                <AppButton onClick={signInWithEmail} disabled={!email || loading} className="min-h-[56px] w-full rounded-[1.1rem] bg-[#08bdf2] text-base font-black text-[#08232d] shadow-[0_18px_38px_rgba(8,189,242,0.24)] hover:bg-[#15c8fa]">
            {loading ? t("auth.pleaseWait") : t("auth.sendMagicLink")}
          </AppButton>
            </div>

        {msg ? (
              <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                tone === "ok"
                    ? "border-[#22c55e]/20 bg-[#dcfce7] text-[#16733f]"
                  : tone === "error"
                      ? "border-[#fb7185]/25 bg-[#fff1f2] text-[#b03439]"
                      : "border-black/[0.06] bg-[#f8fbff] text-[#606676]"
              }`}>
            {msg}
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
