"use client";

import { trackLoginSuccess } from "./analytics";
import type { LoginSuccessEvent } from "./login-success-receipt";
import { EMAIL_RESEND_COOLDOWN_SECONDS } from "./auth-email-policy";

export type AuthSession = {
  access_token: string;
  expires_at: string;
  user: { id: string; email: string | null };
};

type AuthCallback = (event: string, session: AuthSession | null) => void;

const AUTH_EVENT = "dreamface-auth-change";
const AUTH_STORAGE_KEY = "dreamface-auth-updated";
let browserClient: ReturnType<typeof makeClient> | null = null;
let sessionRead: Promise<AuthSession | null> | null = null;
let emailVerification: Promise<{ ok: boolean; error?: string }> | null = null;

async function submitEmailCredential(credential?: { email: string; code: string }) {
  const response = await fetch("/api/auth/verify", {
    method: "POST", credentials: "include", cache: "no-store",
    ...(credential ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(credential) } : {})
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  const ok = response.ok && body?.ok === true;
  return { ok, error: ok ? undefined : body?.error || "signin_failed" };
}

/** Strict Mode and concurrent completion renders share one consuming request. */
export function completeEmailSignIn() {
  if (!emailVerification) emailVerification = submitEmailCredential().finally(() => { emailVerification = null; });
  return emailVerification;
}

function authUrl(path: string) {
  return path;
}

function readSession(): Promise<AuthSession | null> {
  if (!sessionRead) sessionRead = (async () => {
    const res = await fetch(authUrl("/api/auth/session"), { cache: "no-store", credentials: "include" });
    if (!res.ok) throw new Error("Unable to read session.");
    const payload = (await res.json()) as { session?: AuthSession | null; loginEvent?: LoginSuccessEvent };
    // A Google popup leaves reporting to its live parent, which stays open after
    // auth completes. All other pages can claim; the server arbitrates tabs.
    const googlePopup = window.name === "dreamface-google-login" && window.opener && !window.opener.closed;
    if (payload.session && payload.loginEvent && !googlePopup) void trackLoginSuccess(payload.loginEvent);
    return payload?.session || null;
  })().finally(() => { sessionRead = null; });
  return sessionRead;
}

export function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
  // A notification only: every tab confirms the actual session with the server.
  try { window.localStorage.setItem(AUTH_STORAGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* Focus refresh remains available. */ }
}

function pathFromRedirect(value: string | undefined, fallback = "/studio") {
  if (!value) return fallback;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

function makeClient() {
  return {
    auth: {
      async getSession() {
        const session = await readSession();
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = await readSession();
        return { data: { user: session?.user || null }, error: null };
      },
      onAuthStateChange(callback: AuthCallback) {
        let active = true;
        const listener = async () => {
          try {
            const session = await readSession();
            if (active) callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
          } catch { /* A network failure does not sign the user out. */ }
        };
        const storage = (event: StorageEvent) => { if (event.key === AUTH_STORAGE_KEY) void listener(); };
        const visible = () => { if (document.visibilityState === "visible") void listener(); };
        window.addEventListener(AUTH_EVENT, listener);
        window.addEventListener("storage", storage);
        window.addEventListener("focus", listener);
        window.addEventListener("pageshow", listener);
        document.addEventListener("visibilitychange", visible);
        listener();
        return {
          data: {
            subscription: {
              unsubscribe() {
                active = false;
                window.removeEventListener(AUTH_EVENT, listener);
                window.removeEventListener("storage", storage);
                window.removeEventListener("focus", listener);
                window.removeEventListener("pageshow", listener);
                document.removeEventListener("visibilitychange", visible);
              }
            }
          }
        };
      },
      async signOut() {
        const response = await fetch(authUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
        if (!response.ok) return { error: new Error("Unable to sign out.") };
        // Let any earlier session read finish before subscribers read the cleared session.
        await sessionRead?.catch(() => null);
        notifyAuthChange();
        return { error: null };
      },
      async signInWithOtp(input: { email: string }) {
        const res = await fetch(authUrl("/api/auth/email/start"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input.email })
        });
        const payload = await res.json().catch(() => null) as { error?: string; reason?: string; retryAfterSeconds?: number; codePending?: boolean } | null;
        const retryAfter = Number(res.ok ? payload?.retryAfterSeconds : res.headers.get("Retry-After"));
        const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.ceil(retryAfter)
          : res.ok || res.status === 429 ? EMAIL_RESEND_COOLDOWN_SECONDS : 0;
        return {
          error: res.ok ? null : new Error(payload?.error || "Unable to send sign-in email."),
          retryAfterSeconds,
          recentEmail: res.status === 429 && payload?.reason === "recent_email",
          codePending: payload?.codePending === true
        };
      },
      async verifyEmailCode(input: { email: string; code: string }) {
        const result = await submitEmailCredential(input);
        if (!result.ok) return result;
        await sessionRead?.catch(() => null);
        if (!await readSession()) return { ok: false, error: "session_missing" };
        notifyAuthChange();
        return result;
      },
      async signInWithOAuth(input: { provider: string; options?: { redirectTo?: string } }) {
        if (input.provider !== "google") return { error: new Error("Only Google sign-in is supported.") };
        const next = encodeURIComponent(pathFromRedirect(input.options?.redirectTo));
        window.location.href = authUrl(`/api/auth/google/start?next=${next}`);
        return { error: null };
      },
      async refreshSession() {
        const session = await readSession();
        return { data: { session }, error: null };
      }
    }
  };
}

export function createBrowserSupabaseClient() {
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}
