"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import { AppButton } from "../../components/ui/button";
import { trackEvent } from "../../lib/analytics";

function AuthContent() {
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
      setMsg("Verification link sent. Please check your email.");
      trackEvent("login_magic_link_sent", { method: "email", next: nextPath });
    } catch (error) {
      setTone("error");
      setMsg(error instanceof Error ? error.message : "Email sign-in failed.");
      trackEvent("login_failed", { method: "email", error: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle(auto = false) {
    setLoading(true);
    setMsg(auto ? "Opening Google sign-in..." : "");
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
      setMsg(error instanceof Error ? error.message : "Google sign-in failed.");
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
    <main className="min-h-screen overflow-hidden bg-[#070b12] px-4 py-8 text-white sm:py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.22),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(99,102,241,0.18),transparent_30%),linear-gradient(145deg,#070b12_0%,#111827_58%,#05070c_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-7 lg:grid-cols-[1fr_0.82fr]">
        <section className="hidden lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ab6ff]">DreamFace Studio</p>
          <h1 className="mt-4 max-w-3xl text-6xl font-black leading-[0.95] tracking-tight">
            Sign in and keep every creation in one workspace.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/58">
            Your credits, prompts, references, and finished outputs sync into Projects after login.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {["100 free credits", "Project history", "Google in one click"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.075] p-5 shadow-[0_36px_96px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur md:p-7">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="pointer-events-none absolute -right-24 top-12 h-64 w-64 rounded-full bg-[#3f86ff]/14 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-[#13c8f2]/12 blur-3xl" />

          <div className="relative">
            <Link href="/" className="mb-7 inline-flex text-sm font-semibold text-white/58 transition hover:text-white">
              Back to home
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Authentication</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Sign in to Nova Studio</h2>
            <p className="mt-3 text-sm leading-6 text-white/54">Use Google for the fastest start, or receive a secure email magic link.</p>

            <button
              type="button"
              onClick={() => signInWithGoogle()}
              disabled={loading}
              className="mt-7 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[1.15rem] bg-white px-5 py-3 text-base font-black text-[#111827] shadow-[0_18px_42px_rgba(28,107,225,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(28,107,225,0.30)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-black/10 bg-white text-lg font-black text-[#4285f4]">G</span>
              {loading && providerParam === "google" ? "Opening Google..." : "Continue with Google"}
            </button>

            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/32">
              <span className="h-px flex-1 bg-white/10" />
              Email
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-white/58">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/[0.07] px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-[#77a8e8] focus:bg-white/[0.09]"
            placeholder="you@company.com"
          />
        </label>

            <div className="mt-4">
              <AppButton onClick={signInWithEmail} disabled={!email || loading} className="w-full rounded-[1.1rem]">
            {loading ? "Please wait..." : "Send magic link"}
          </AppButton>
            </div>

        {msg ? (
              <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                tone === "ok"
                  ? "border-[#34d399]/20 bg-[#10b981]/10 text-[#8df0bf]"
                  : tone === "error"
                    ? "border-[#fb7185]/20 bg-[#f43f5e]/10 text-[#ffb4bf]"
                    : "border-white/10 bg-white/[0.05] text-white/58"
              }`}>
            {msg}
          </p>
        ) : null}

            <p className="mt-5 text-center text-xs leading-5 text-white/34">
              By continuing, you can access Studio, credits, billing, and saved Projects.
            </p>
          </div>
        </section>
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
