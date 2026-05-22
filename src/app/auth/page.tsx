"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import { AppButton } from "../../components/ui/button";

function AuthContent() {
  const sp = useSearchParams();
  const nextPath = sp.get("next") || "/studio?mode=image&workflow=text-to-image";
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"ok" | "error" | "idle">("idle");
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  async function signInWithEmail() {
    setLoading(true);
    setMsg("");
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
    } catch (error) {
      setTone("error");
      setMsg(error instanceof Error ? error.message : "Email sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setMsg("");
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
      setLoading(false);
    }
  }

  return (
    <main className="bg-grid min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-black/10 bg-white/95 p-8 shadow-[0_24px_60px_rgba(13,18,35,0.08)]">
        <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Authentication</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Sign in to Nova Studio</h1>
        <p className="mt-3 text-sm text-[#5f6779]">Use email verification or continue with Google.</p>

        <label className="mt-6 block">
          <span className="text-sm text-[#5f6779]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
            placeholder="you@company.com"
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <AppButton onClick={signInWithEmail} disabled={!email || loading}>
            {loading ? "Please wait..." : "Send magic link"}
          </AppButton>
          <AppButton variant="secondary" onClick={signInWithGoogle} disabled={loading}>
            Continue with Google
          </AppButton>
        </div>

        {msg ? (
          <p className={`mt-4 text-sm ${tone === "ok" ? "text-[#197a46]" : tone === "error" ? "text-[#b03439]" : "text-[#4f5a6d]"}`}>
            {msg}
          </p>
        ) : null}

        <div className="mt-6 text-sm text-[#5f6779]">
          <Link href="/" className="font-semibold text-[#1d1d1f]">
            Back to home
          </Link>
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
