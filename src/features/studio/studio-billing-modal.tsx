"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CreditPackGrid } from "../../components/credit-pack-grid";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export type GenerationBillingContext = { requiredCredits: number; balance: number; providerLabel: string };
type StudioBillingModalProps = {
  open: boolean; t: Translate; loadingItem: string | null; message: string; creditBalance: number | null;
  generationContext: GenerationBillingContext | null; scrollRef: RefObject<HTMLDivElement | null>;
  onClose: () => void; onCreditCheckout: (packId: string) => void;
};

export function StudioBillingModal({ open, t, loadingItem, message, creditBalance, generationContext, scrollRef, onClose, onCreditCheckout }: StudioBillingModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loadingItem) onClose();
      if (event.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
      if (!items?.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open, loadingItem, onClose]);
  if (!open) return null;
  const close = () => { if (!loadingItem) onClose(); };
  const shortfall = generationContext ? Math.max(0, generationContext.requiredCredits - generationContext.balance) : 0;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#100b1d]/70 p-3 backdrop-blur-md sm:p-6" onClick={close}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="credit-shop-title" className="relative w-full max-w-[1180px] overflow-hidden rounded-3xl bg-[#faf8ff] shadow-2xl outline-none" onClick={event => event.stopPropagation()}>
        <button type="button" aria-label={t("studio.billing.close")} disabled={Boolean(loadingItem)} onClick={close} className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white disabled:opacity-50">×</button>
        <div ref={scrollRef} className="max-h-[90dvh] overflow-y-auto">
          <header className="bg-[linear-gradient(120deg,#201530,#493071)] px-6 py-9 text-center text-white sm:px-12">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#c7b7ef]">{t("creditShop.eyebrow")}</p>
            <h2 id="credit-shop-title" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t("creditShop.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/70">{t("creditShop.subtitle")}</p>
            <p className="mt-4 text-xs font-bold text-[#cfbfef]">{t("creditShop.balance")}: {creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("creditShop.credits")}</p>
          </header>
          <div className="p-4 sm:p-7">
            {message ? <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p> : null}
            {generationContext ? <div className="mb-5 rounded-2xl border border-[#e3d9fc] bg-white p-4 text-sm text-[#604d7b]">
              <p className="font-black">{t("studio.cost.insufficientTitle", { credits: shortfall.toLocaleString() })}</p>
              <p className="mt-1">{generationContext.providerLabel} · {t("studio.cost.insufficientBody", { required: generationContext.requiredCredits.toLocaleString(), balance: generationContext.balance.toLocaleString() })}</p>
            </div> : null}
            <CreditPackGrid t={t} loadingPack={loadingItem?.replace(/^credits:/, "") || null} onCheckout={onCreditCheckout} shortfall={shortfall} />
            <p className="mt-5 text-center text-xs leading-5 text-[#82758f]">{t("creditShop.note")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
