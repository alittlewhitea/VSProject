"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKS, CREDIT_USAGE_REFERENCE, creditUsageCapacity, formatUsd, type CreditPaymentProvider } from "../lib/billing";

type Translate = (key: string, values?: Record<string, string | number>) => string;
export function CreditPackGrid({ t, loadingPack, onCheckout, shortfall = 0 }: {
  t: Translate; loadingPack: string | null; onCheckout: (id: string, provider: CreditPaymentProvider) => void; shortfall?: number;
}) {
  const [providers, setProviders] = useState<CreditPaymentProvider[]>(["paypal"]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing/payment-methods", { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (controller.signal.aborted || !Array.isArray(payload?.providers)) return;
        setProviders(payload.providers.includes("dodo") ? ["dodo", "paypal"] : ["paypal"]);
      }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const recommended = shortfall > 0 ? CREDIT_PACKS.find(pack => pack.credits >= shortfall)?.id : "creator";
  const starter = CREDIT_PACKS.find(pack => pack.id === "starter")!;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-credit-packs>
      {CREDIT_PACKS.map((pack) => {
        const capacity = creditUsageCapacity(pack.credits);
        const highlight = pack.id === recommended;
        const discount = Math.max(0, Math.floor((1 - (pack.amountCents / pack.credits) / (starter.amountCents / starter.credits)) * 100));
        return (
          <article key={pack.id} className={`relative flex min-w-0 flex-col rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-6 ${highlight ? "border-[#8164ff] bg-[#f7f4ff] ring-2 ring-[#ebe5ff]" : "border-[#e7e4ed] bg-white"}`}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#827891]">{t("creditShop.oneTime")}</span>
              {highlight ? <span className="rounded-full bg-[#7655ed] px-2.5 py-1 text-[10px] font-black text-white">{t("creditShop.recommended")}</span> : pack.id === "pro-topup" ? <span className="rounded-full bg-[#e7f7ef] px-2.5 py-1 text-[10px] font-black text-[#13794e]">{t("creditShop.bestValue")}</span> : null}
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-[#20182e]">{pack.name}</h3>
            <p className="mt-6 text-4xl font-black tracking-tight text-[#231833]">{formatUsd(pack.amountCents)}</p>
            <p className="mt-3 text-lg font-black text-[#7554e8]">{pack.credits.toLocaleString()} <span className="text-sm font-bold">{t("creditShop.credits")}</span></p>
            <div className="mt-2 min-h-8 text-xs font-semibold text-[#13794e]">
              {discount > 0 ? <p>{t("creditShop.discount", { percent: discount })}</p> : null}
            </div>
            <div className="my-5 border-t border-[#e9e3f1] pt-4 text-sm leading-6 text-[#6e637c]">
              <p>{t("creditShop.shared")}</p>
              <p className="mt-2 text-xs">{t("creditShop.example", { images: capacity.images.toLocaleString(), videos: capacity.videos.toLocaleString(), videoSpec: `${CREDIT_USAGE_REFERENCE.video.model} · ${CREDIT_USAGE_REFERENCE.video.seconds}s · ${CREDIT_USAGE_REFERENCE.video.resolution}` })}</p>
            </div>
            <div className="mt-auto grid gap-2" role="group" aria-label={`${t("creditShop.buy")} — ${pack.name}`}>
              {providers.map(provider => (
                <button key={provider} type="button" data-payment-provider={provider} disabled={Boolean(loadingPack)} onClick={() => onCheckout(pack.id, provider)}
                  aria-label={`${t("creditShop.buy")} — ${pack.name} — ${provider === "dodo" ? "Credit Card" : "PayPal"}`}
                  aria-busy={loadingPack === `${pack.id}:${provider}`}
                  className={`min-h-12 min-w-0 rounded-xl px-2 py-3 text-xs font-black transition disabled:opacity-50 ${provider === "dodo" ? "bg-[#7554e8] text-white hover:bg-[#6544d8]" : "bg-[#ffc439] text-[#003087] hover:bg-[#f2ba36]"}`}>
                  {loadingPack === `${pack.id}:${provider}` ? t("creditShop.opening") : provider === "dodo" ? (
                    <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg>
                        Credit Card
                      </span>
                    </span>
                  ) : "PayPal"}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
