"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { trackEvent } from "../../lib/analytics";
import { requestSignIn } from "../../lib/auth-navigation";
import { CREDIT_PACKS } from "../../lib/billing";
import { createBrowserSupabaseClient, getCachedAuthSession } from "../../lib/supabase-client";
import type { GenerationBillingContext } from "./studio-billing-modal";
import { safeRemoveLocalStorage, safeSetLocalStorage, scopedSessionKey, type StudioMode } from "./studio-storage";
import { SESSION_CREDIT_BALANCE_KEY, type StudioWorkflow } from "./studio-workspace-config";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

export type StudioSessionActionMeta = {
  mode: StudioMode;
  provider: string;
  activeWorkflow: StudioWorkflow;
  estCredits: number;
  selectedProviderLabel: string;
  st: Translate;
  onSignedOut?: () => void;
  saveLoginDraft: (autoSubmit: boolean) => boolean;
};

export function useStudioSessionBilling(actionMetaRef: MutableRefObject<StudioSessionActionMeta>) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getCachedAuthSession()?.access_token ?? null);
  const [userId, setUserId] = useState<string | null>(() => getCachedAuthSession()?.user.id ?? null);
  const [authReady, setAuthReady] = useState<boolean>(() => Boolean(getCachedAuthSession()));
  const [referralsVisible, setReferralsVisible] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditNote, setCreditNote] = useState("");
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [billingGenerationContext, setBillingGenerationContext] = useState<GenerationBillingContext | null>(null);
  const [loadingBillingItem, setLoadingBillingItem] = useState<string | null>(null);
  const billingModalScrollRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({ accessToken, userId, creditBalance, billingGenerationContext });
  stateRef.current = { accessToken, userId, creditBalance, billingGenerationContext };

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      const nextUserId = data.session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (typeof window !== "undefined") {
        safeRemoveLocalStorage("nova_access_token");
      }
      if (!token) setCreditNote(actionMetaRef.current.st("studio.status.signInCredit"));
      setAuthReady(true);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token || null;
      const nextUserId = session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (!nextUserId) {
        actionMetaRef.current.onSignedOut?.();
        setCreditBalance(null);
      }
      if (typeof window !== "undefined") {
        safeRemoveLocalStorage("nova_access_token");
      }
      setAuthReady(true);
    });
    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [actionMetaRef]);

  useEffect(() => {
    let active = true;
    setReferralsVisible(false);
    const refresh = async () => {
      try {
        if (accessToken) await fetch("/api/referrals", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
        const response = await fetch(accessToken ? "/api/referrals" : "/api/referrals/availability", {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        });
        const data = await response.json();
        if (active) setReferralsVisible(response.ok && (accessToken ? data.enabled === true : data.visible === true));
      } catch {
        if (active) setReferralsVisible(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/credits", { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted && response.ok && typeof data.balance === "number") {
          setCreditBalance(data.balance);
          const key = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, userId);
          if (key) safeSetLocalStorage(key, String(data.balance));
        }
      } catch {
        /* A confirmed payment can still be viewed on Billing if refresh fails. */
      }
    };
    window.addEventListener("dreamface:credits-updated", refresh);
    void refresh();
    return () => {
      controller.abort();
      window.removeEventListener("dreamface:credits-updated", refresh);
    };
  }, [accessToken, userId]);

  const refreshLiveAccessToken = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getSession();
    const liveToken = data.session?.access_token || null;
    if (!liveToken) {
      setAccessToken(null);
      setUserId(null);
      if (typeof window !== "undefined") {
        safeRemoveLocalStorage("nova_access_token");
      }
    }
    return liveToken;
  }, []);

  const cacheCreditBalance = useCallback((balance: number) => {
    if (typeof window === "undefined") return;
    const creditKey = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, stateRef.current.userId);
    if (creditKey) {
      safeSetLocalStorage(creditKey, String(balance));
    }
  }, []);

  const openBillingModal = useCallback((source: string) => {
    const meta = actionMetaRef.current;
    const current = stateRef.current;
    setBillingGenerationContext(null);
    setBillingModalOpen(true);
    setBillingMessage("");
    trackEvent("studio_billing_modal_opened", { source, balance: current.creditBalance, mode: meta.mode, provider: meta.provider }, current.accessToken);
  }, [actionMetaRef]);

  const openInsufficientCreditsModal = useCallback(() => {
    const meta = actionMetaRef.current;
    const current = stateRef.current;
    if (typeof current.creditBalance !== "number") return;
    const context: GenerationBillingContext = {
      requiredCredits: meta.estCredits,
      balance: current.creditBalance,
      providerLabel: meta.selectedProviderLabel
    };
    setBillingGenerationContext(context);
    setBillingMessage("");
    setBillingModalOpen(true);
    trackEvent(
      "generation_insufficient_credits_shown",
      {
        mode: meta.mode,
        provider: meta.provider,
        workflow: meta.activeWorkflow,
        required_credits: meta.estCredits,
        balance: current.creditBalance,
        shortfall: Math.max(0, meta.estCredits - current.creditBalance)
      },
      current.accessToken
    );
  }, [actionMetaRef]);

  const startStudioCreditCheckout = useCallback(async (packId: string, paymentProvider: "paypal" | "dodo", loginToken?: string) => {
    const meta = actionMetaRef.current;
    const current = stateRef.current;
    const checkoutToken = loginToken || current.accessToken;
    const checkoutSurface = current.billingGenerationContext ? "generation_insufficient_modal" : "studio_modal";
    if (!checkoutToken) {
      trackEvent("checkout_login_required", { pack_id: packId, surface: checkoutSurface });
      requestSignIn({
        onBeforeRedirect: () => meta.saveLoginDraft(false),
        onSuccess: (session) => {
          void startStudioCreditCheckout(packId, paymentProvider, session.access_token);
        }
      });
      return;
    }

    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    setLoadingBillingItem(`credits:${packId}:${paymentProvider}`);
    setBillingMessage("");
    trackEvent(
      "checkout_started",
      { surface: checkoutSurface, payment_provider: paymentProvider, pack_id: packId, credits: pack?.credits || null, amount_cents: pack?.amountCents || null },
      current.accessToken
    );

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${checkoutToken}`
        },
        body: JSON.stringify({ type: "credits", packId, provider: paymentProvider })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(response.status === 401 ? meta.st("studio.error.sessionExpired") : meta.st("studio.billing.checkoutFailed"));
      }
      window.location.href = payload.url;
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : meta.st("studio.billing.checkoutFailed"));
      setLoadingBillingItem(null);
    }
  }, [actionMetaRef]);

  return {
    accessToken,
    userId,
    authReady,
    referralsVisible,
    creditBalance,
    setCreditBalance,
    cacheCreditBalance,
    creditNote,
    setCreditNote,
    billingModalOpen,
    setBillingModalOpen,
    billingMessage,
    billingGenerationContext,
    setBillingGenerationContext,
    loadingBillingItem,
    billingModalScrollRef,
    refreshLiveAccessToken,
    openBillingModal,
    openInsufficientCreditsModal,
    startStudioCreditCheckout
  };
}
