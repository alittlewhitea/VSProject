"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_DIALOG_EVENT, clearPendingHomeLogin, isMarketingHomePath, pendingHomeLogin, type SignInRequest } from "../lib/auth-navigation";
import { createBrowserSupabaseClient } from "../lib/supabase-client";

const AuthDialog = dynamic(() => import("./auth-dialog"), { ssr: false });

export function AuthDialogHost() {
  const router = useRouter();
  const pathname = usePathname();
  const [request, setRequest] = useState<(SignInRequest & { id: number }) | null>(null);
  const sequence = useRef(0);
  const activeRequest = useRef(false);
  useEffect(() => {
    const open = (event: Event) => { activeRequest.current = true; setRequest({ ...(event as CustomEvent<SignInRequest>).detail, id: ++sequence.current }); };
    window.addEventListener(AUTH_DIALOG_EVENT, open);
    return () => window.removeEventListener(AUTH_DIALOG_EVENT, open);
  }, []);
  useEffect(() => {
    if (!isMarketingHomePath(pathname || "/")) { clearPendingHomeLogin(); return; }
    let active = true;
    const isVisible = () => document.visibilityState !== "hidden";
    async function resume() {
      if (activeRequest.current || !isVisible()) return;
      const pending = pendingHomeLogin();
      if (!pending) return;
      try {
        const { data } = await createBrowserSupabaseClient().auth.getSession();
        const current = pendingHomeLogin();
        if (!active || activeRequest.current || !isVisible() || !data.session || !current || current.expires !== pending.expires || current.next !== pending.next) return;
        // Keep the intent until the destination mounts: a background mobile tab
        // can be discarded between starting navigation and rendering Studio.
        router.replace(current.next);
      } catch { /* Retry when the browser returns to this tab. */ }
    }
    const refresh = () => { void resume(); };
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      active = false;
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, router]);
  return request ? <AuthDialog key={request.id} request={request} onClose={(signedIn = false) => { activeRequest.current = false; if (!signedIn) clearPendingHomeLogin(); setRequest(null); }} /> : null;
}
