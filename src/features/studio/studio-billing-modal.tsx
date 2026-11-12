"use client";

import { useRef, type RefObject } from "react";
import { useStudioDialog } from "./use-studio-dialog";
import { CreditPackGrid } from "../../components/credit-pack-grid";
import type { CreditPaymentProvider } from "../../lib/billing";
import styles from "../../components/credit-shop.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export type GenerationBillingContext = { requiredCredits: number; balance: number; providerLabel: string };
type StudioBillingModalProps = {
  accessToken?: string | null;
  open: boolean; t: Translate; loadingItem: string | null; message: string; creditBalance: number | null;
  generationContext: GenerationBillingContext | null; scrollRef: RefObject<HTMLDivElement | null>;
  onClose: () => void; onCreditCheckout: (packId: string, provider: CreditPaymentProvider) => void;
};

export function StudioBillingModal({ open, t, loadingItem, message, creditBalance, generationContext, scrollRef, onClose, onCreditCheckout, accessToken }: StudioBillingModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useStudioDialog(open, dialogRef, {
    onClose, canClose: !loadingItem,
    suspended: () => Boolean(document.querySelector("[data-credit-payment-dialog]"))
  });
  if (!open) return null;
  const close = () => { if (!loadingItem) onClose(); };
  const shortfall = generationContext ? Math.max(0, generationContext.requiredCredits - generationContext.balance) : 0;
  return (
    <div className={styles.modalBackdrop} onClick={close}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="credit-shop-title" className={styles.modal} onClick={event => event.stopPropagation()}>
        <button type="button" aria-label={t("studio.billing.close")} disabled={Boolean(loadingItem)} onClick={close} className={styles.close}>×</button>
        <div ref={scrollRef} className={styles.modalScroll}>
          <CreditPackGrid appearance="studio" titleId="credit-shop-title" balance={creditBalance} t={t} loadingPack={loadingItem?.replace(/^credits:/, "") || null} onCheckout={onCreditCheckout} shortfall={shortfall} accessToken={accessToken} message={message}>
            {generationContext ? <div className="mb-5 rounded-2xl border border-[#e3d9fc] bg-white p-4 text-sm text-[#604d7b]">
              <p className="font-semibold">{t("studio.cost.insufficientTitle", { credits: shortfall.toLocaleString() })}</p>
              <p className="mt-1">{generationContext.providerLabel} · {t("studio.cost.insufficientBody", { required: generationContext.requiredCredits.toLocaleString(), balance: generationContext.balance.toLocaleString() })}</p>
            </div> : null}
          </CreditPackGrid>
        </div>
      </section>
    </div>
  );
}
