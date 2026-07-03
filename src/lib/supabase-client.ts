"use client";

type AuthSession = {
  access_token: string;
  expires_at: string;
  user: { id: string; email: string | null };
};

type AuthCallback = (event: string, session: AuthSession | null) => void;

const AUTH_EVENT = "dreamface-auth-change";
let browserClient: ReturnType<typeof makeClient> | null = null;

function authUrl(path: string) {
  return path;
}

async function readSession() {
  const res = await fetch(authUrl("/api/auth/session"), { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  const payload = (await res.json().catch(() => null)) as { session?: AuthSession | null } | null;
  return payload?.session || null;
}

function emitAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
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
          const session = await readSession();
          if (active) callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
        };
        window.addEventListener(AUTH_EVENT, listener);
        listener();
        return {
          data: {
            subscription: {
              unsubscribe() {
                active = false;
                window.removeEventListener(AUTH_EVENT, listener);
              }
            }
          }
        };
      },
      async signOut() {
        await fetch(authUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
        emitAuthChange();
        return { error: null };
      },
      async signInWithOtp(input: { email: string; options?: { emailRedirectTo?: string } }) {
        const res = await fetch(authUrl("/api/auth/email/start"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: input.email,
            next: pathFromRedirect(input.options?.emailRedirectTo)
          })
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          return { error: new Error(payload?.error || "Unable to send sign-in email.") };
        }
        return { error: null };
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
