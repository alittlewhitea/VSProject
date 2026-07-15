"use client";

import type { RefObject } from "react";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  creditUsageCapacity,
  formatUsd,
  type BillingCycle
} from "../../lib/billing";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
const BILLING_CYCLES: BillingCycle[] = ["weekly", "monthly", "yearly"];

function CreditUsageExamples({ credits, t, compact = false }: { credits: number; t: Translate; compact?: boolean }) {
  const capacity = creditUsageCapacity(credits);
  const examples = [
    { key: "images", value: capacity.images, label: t("studio.billing.usage.images") },
    { key: "videos", value: capacity.videos, label: t("studio.billing.usage.videos") },
    { key: "voiceovers", value: capacity.voiceovers, label: t("studio.billing.usage.voiceovers") },
    { key: "avatars", value: capacity.avatars, label: t("studio.billing.usage.avatars") }
  ];

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#687386]">{t("studio.billing.usage.title")}</p>
      <div className={`mt-2 grid grid-cols-2 ${compact ? "gap-1.5" : "gap-2"}`}>
        {examples.map((example) => (
          <div key={example.key} className={`border border-black/[0.07] bg-white ${compact ? "rounded-xl px-2.5 py-2" : "rounded-2xl px-3 py-2.5"}`}>
            <p className={`${compact ? "text-lg" : "text-xl"} font-black leading-none tracking-tight text-[#151922]`}>{example.value.toLocaleString()}</p>
            <p className="mt-1 text-[10px] font-semibold leading-[1.35] text-[#667085]">{example.label}</p>
          </div>
        ))}
      </div>
      {!compact ? <p className="mt-2 text-[10px] font-medium leading-4 text-[#7b8492]">{t("studio.billing.usage.note")}</p> : null}
    </div>
  );
}

type StudioBillingModalProps = {
  open: boolean;
  t: Translate;
  loadingItem: string | null;
  message: string;
  creditBalance: number | null;
  selectedCycles: Record<string, BillingCycle>;
  scrollRef: RefObject<HTMLDivElement | null>;
  premiumLitePlanRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onAllCyclesChange: (cycle: BillingCycle) => void;
  onPlanCycleChange: (planId: string, cycle: BillingCycle) => void;
  onSubscriptionCheckout: (planId: string, cycle: BillingCycle) => void;
  onCreditCheckout: (packId: string) => void;
};

export function StudioBillingModal({
  open,
  t,
  loadingItem,
  message,
  creditBalance,
  selectedCycles,
  scrollRef,
  premiumLitePlanRef,
  onClose,
  onAllCyclesChange,
  onPlanCycleChange,
  onSubscriptionCheckout,
  onCreditCheckout
}: StudioBillingModalProps) {
  if (!open) return null;
  const closeIfIdle = () => {
    if (!loadingItem) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/70 p-3 backdrop-blur-[6px] md:p-6" onClick={closeIfIdle}>
      <section className="relative max-h-[92vh] w-full max-w-[1180px] overflow-hidden rounded-[1.65rem] border border-white bg-[#f8fafc] shadow-[0_36px_120px_rgba(2,6,23,0.42)] md:rounded-[2.15rem]" onClick={(event) => event.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[5px] bg-[linear-gradient(90deg,#4f46e5,#06b6d4)]" />
        <div className="pointer-events-none absolute left-0 right-0 top-[5px] h-80 overflow-hidden bg-white">
          <span className="absolute -left-20 -top-36 h-96 w-96 rounded-full bg-[#eef2ff] blur-3xl" />
          <span className="absolute -right-16 -top-32 h-96 w-96 rounded-full bg-[#ecfeff] blur-3xl" />
        </div>
        <button type="button" aria-label={t("studio.billing.close")} onClick={closeIfIdle} disabled={Boolean(loadingItem)} className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/85 text-xl leading-none text-[#64748b] shadow-[0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur transition hover:bg-white hover:text-[#111827] disabled:opacity-50">x</button>

        <div ref={scrollRef} className="relative max-h-[92vh] overflow-y-auto px-4 pb-7 pt-8 sm:px-6 md:px-8 md:pb-8 md:pt-9">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[1.15rem] border border-[#dbeafe] bg-white shadow-[0_12px_28px_rgba(79,70,229,0.12)]">
              <span className="relative block h-5 w-6"><span className="absolute left-1/2 top-0 h-3 w-4 -translate-x-1/2 rounded-t-sm bg-[#ffd45d]" /><span className="absolute left-1/2 top-2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-[#f6a91f]" /></span>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#06a8c7]">{t("studio.billing.premium")}</p>
            <h2 className="mt-2 text-3xl font-black leading-[1.04] tracking-[-0.045em] text-[#0f172a] md:text-[2.65rem]">{t("studio.billing.plansTitle")}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">{t("studio.billing.description")}</p>
            <div className="mt-5 inline-flex rounded-full border border-[#dbe1ea] bg-[#eef2f7] p-1">
              {BILLING_CYCLES.map((cycle) => (
                <button key={cycle} type="button" onClick={() => onAllCyclesChange(cycle)} className={`rounded-full px-5 py-2 text-xs font-black transition ${SUBSCRIPTION_PLANS.every((plan) => selectedCycles[plan.id] === cycle) ? "bg-white text-[#0f172a] shadow-[0_6px_16px_rgba(15,23,42,0.08)]" : "text-[#6b7280] hover:text-[#111827]"}`}>{t(`studio.billing.cycle.${cycle}`)}</button>
              ))}
            </div>
          </div>

          {message ? <p className="mx-auto mt-5 max-w-3xl rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#be123c]">{message}</p> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.08fr_1.08fr]">
            <article className="flex min-h-[430px] flex-col rounded-[1.6rem] border border-[#e2e8f0] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
              <h3 className="text-2xl font-black text-[#151922]">{t("studio.billing.free")}</h3>
              <p className="mt-4 text-5xl font-black">$0</p>
              <p className="mt-2 text-sm font-semibold text-[#667085]">{t("studio.billing.trialCredits")}</p>
              <div className="mt-4 rounded-[1.25rem] border border-[#dbeafe] bg-[#f8fdff] px-4 py-3.5">
                <p className="text-3xl font-black tracking-tight text-[#151922]">100<span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-[#667085]">{t("studio.common.credits")}</span></p>
                <CreditUsageExamples credits={100} t={t} compact />
              </div>
              <button type="button" disabled className="mt-5 rounded-xl bg-[#e9edf3] px-5 py-3 text-sm font-black text-[#a1a8b3]">{t("studio.billing.currentPlan")}</button>
              <div className="mt-5 space-y-2.5 text-sm font-semibold leading-5 text-[#394150]">
                {[t("studio.billing.freeFeature.imageAudio"), t("studio.billing.freeFeature.history"), t("studio.billing.freeFeature.refund")].map((feature) => <p key={feature} className="flex gap-3"><span className="text-[#08bff1]">+</span><span>{feature}</span></p>)}
              </div>
            </article>

            {SUBSCRIPTION_PLANS.map((plan) => {
              const cycle = selectedCycles[plan.id] || plan.defaultCycle;
              const price = plan.prices[cycle];
              const loading = loadingItem === `subscription:${plan.id}:${cycle}`;
              return (
                <article key={plan.id} ref={plan.id === "premium-lite" ? premiumLitePlanRef : null} className={`relative flex min-h-[430px] flex-col rounded-[1.6rem] border p-5 shadow-[0_18px_52px_rgba(15,23,42,0.08)] ${plan.highlight ? "border-2 border-[#06b6d4]/60 bg-white shadow-[0_20px_50px_rgba(6,182,212,0.12)]" : "border-[#ddd6fe] bg-[radial-gradient(circle_at_95%_0%,rgba(99,102,241,0.12),transparent_40%),#fff]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className={`inline-flex rounded-full px-3 py-2 text-xs font-black ${plan.highlight ? "bg-[#ecfeff] text-[#0891b2]" : "bg-[#f5f3ff] text-[#7c3aed]"}`}>{t(`studio.billing.plan.${plan.id}.badge`)}</p><h3 className="mt-4 text-2xl font-black text-[#151922]">{t(`studio.billing.plan.${plan.id}.name`)}</h3></div>
                    <select value={cycle} onChange={(event) => onPlanCycleChange(plan.id, event.target.value as BillingCycle)} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-black text-[#485164] outline-none">
                      {BILLING_CYCLES.map((item) => <option key={item} value={item}>{t(`studio.billing.cycle.${item}`)}</option>)}
                    </select>
                  </div>
                  <div className="mt-5">
                    <p className="text-[2.65rem] font-black tracking-tight">{formatUsd(price.amountCents).replace(".00", "")}<span className="text-lg font-bold text-[#5d6675]"> / {t(`studio.billing.interval.${price.interval}`)}</span></p>
                    <p className="mt-2 text-sm font-semibold text-[#667085]">{t("studio.billing.creditsRenew", { credits: price.credits.toLocaleString(), interval: t(`studio.billing.interval.${price.interval}`) })}</p>
                  </div>
                  <div className="mt-4 rounded-[1.25rem] border border-[#dbeafe] bg-[#f8fdff] px-4 py-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#487080]">{t("studio.billing.includedCredits")}</p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-[#151922]">{price.credits.toLocaleString()}<span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-[#667085]">{t("studio.common.credits")}</span></p>
                    <CreditUsageExamples credits={price.credits} t={t} />
                  </div>
                  <button type="button" onClick={() => onSubscriptionCheckout(plan.id, cycle)} disabled={Boolean(loadingItem)} className={`mt-5 rounded-xl px-5 py-3 text-sm font-black transition active:scale-[0.98] disabled:opacity-60 ${plan.highlight ? "bg-[linear-gradient(135deg,#4f46e5,#06b6d4)] text-white shadow-[0_12px_24px_rgba(79,70,229,0.2)]" : "bg-[#0f172a] text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]"}`}>{loading ? t("studio.billing.openingCheckout") : t(`studio.billing.plan.${plan.id}.cta`)}</button>
                  <div className="mt-5 space-y-2.5 text-sm font-semibold leading-5 text-[#394150]">
                    {plan.features.slice(0, 6).map((feature, index) => <p key={feature} className="flex gap-3"><span className="text-[#08bff1]">+</span><span>{t(`studio.billing.plan.${plan.id}.feature.${index}`)}</span></p>)}
                  </div>
                </article>
              );
            })}
          </div>

          <section className="mt-6 rounded-[1.75rem] border border-[#e5e7eb] bg-[#f8fafc]/80 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{t("studio.billing.extraCredits")}</p><h3 className="mt-2 text-2xl font-black text-[#151922]">{t("studio.billing.topUpTitle")}</h3></div>
              <p className="text-sm font-semibold text-[#667085]">{t("studio.billing.currentBalance", { balance: creditBalance === null ? "--" : creditBalance.toLocaleString() })}</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {CREDIT_PACKS.map((pack) => {
                const loading = loadingItem === `credits:${pack.id}`;
                return (
                  <article key={pack.id} className="rounded-[1.35rem] border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                    <h4 className="text-base font-black text-[#151922]">{t(`studio.billing.pack.${pack.id}`)}</h4>
                    <p className="mt-2 text-2xl font-black">{formatUsd(pack.amountCents).replace(".00", "")}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#151922]">{pack.credits.toLocaleString()}<span className="ml-1 text-[10px] uppercase tracking-[0.1em] text-[#667085]">{t("studio.common.credits")}</span></p>
                    <CreditUsageExamples credits={pack.credits} t={t} compact />
                    <button type="button" onClick={() => onCreditCheckout(pack.id)} disabled={Boolean(loadingItem)} className="mt-4 w-full rounded-xl bg-[#151922] px-4 py-2.5 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60">{loading ? t("studio.billing.opening") : t("studio.billing.recharge")}</button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
