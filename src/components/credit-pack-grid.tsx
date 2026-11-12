"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { requestSignIn } from "../lib/auth-navigation";
import { preloadPayPalWallets } from "../lib/paypal-wallets-client";
import { CREDIT_PACKS, CREDIT_USAGE_REFERENCE, creditUsageCapacity, formatUsd, type CreditPaymentProvider } from "../lib/billing";
import { CreditShopIcon, type CreditShopIconName } from "./credit-shop-icon";
import styles from "./credit-shop.module.css";

type Translate = (key: string, values?: Record<string, string | number>) => string;
const loadPaymentDialog = () => import("./credit-payment-dialog");
const PaymentDialog = dynamic(loadPaymentDialog, { ssr: false });
function preparePayment() {
  void loadPaymentDialog().catch(() => undefined);
  void preloadPayPalWallets().catch(() => undefined);
}
const workloads = ["all", "video", "image", "avatar"] as const;
type Workload = typeof workloads[number];
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export function CreditPackGrid({ t, loadingPack, onCheckout, shortfall = 0, accessToken, message, appearance = "default", balance = null, titleId, headingLevel = 2, children }: {
  t: Translate; loadingPack: string | null; onCheckout: (id: string, provider: CreditPaymentProvider) => void | Promise<void>; shortfall?: number;
  appearance?: "default" | "studio"; accessToken?: string | null; message?: string;
  balance?: number | null; titleId?: string; headingLevel?: 1 | 2; children?: ReactNode;
}) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [workload, setWorkload] = useState<Workload>("all");
  const id = useId(), tabs = useRef<HTMLDivElement>(null);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const videoSpec = `${CREDIT_USAGE_REFERENCE.video.model} · ${CREDIT_USAGE_REFERENCE.video.seconds}s · ${CREDIT_USAGE_REFERENCE.video.resolution}`;
  useEffect(() => { if (accessToken) preparePayment(); }, [accessToken]);
  const recommended = shortfall > 0 ? CREDIT_PACKS.find(pack => pack.credits >= shortfall)?.id : "creator";
  const starter = CREDIT_PACKS.find(pack => pack.id === "starter")!;
  return (
    <div className={styles.store} data-credit-store>
      <header className={styles.header}>
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrow}>{t("creditShop.eyebrow")}</span>
          {accessToken ? <><span className={styles.dot} aria-hidden="true">•</span><span className={styles.balance}>{t("creditShop.balance")}: <strong data-store-balance>{balance === null ? "—" : balance.toLocaleString()} {t("creditShop.credits")}</strong></span></> : null}
        </div>
        <Heading id={titleId || `${id}-title`} className={styles.title}>{t("creditShop.title")}</Heading>
        <p className={styles.subtitle}>{t("creditShop.subtitle")}</p>
        <div className={styles.switcher}>
          <span className={styles.switcherLabel}>{t("creditShop.previewFor")}</span>
          <div ref={tabs} className={styles.tabs} role="tablist" aria-label={t("creditShop.usageEstimator")} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const rtl = Boolean(event.currentTarget.closest('[dir="rtl"]'));
            const direction = (event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1);
            const index = event.key === "Home" ? 0 : event.key === "End" ? workloads.length - 1 : (workloads.indexOf(workload) + direction + workloads.length) % workloads.length;
            setWorkload(workloads[index]);
            tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
          }}>
            {workloads.map(mode => <button key={mode} type="button" role="tab" id={`${id}-tab-${mode}`} aria-selected={workload === mode} aria-controls={`${id}-packs`} tabIndex={workload === mode ? 0 : -1} className={styles.tab} data-mode={mode} onClick={() => setWorkload(mode)}>
              {mode !== "all" ? <CreditShopIcon name={mode} /> : null}{t(`creditShop.mode${titleCase(mode)}`)}
            </button>)}
          </div>
        </div>
      </header>
      <div className={styles.body}>
      {message ? <p role="alert" className={styles.alert}>{message}</p> : null}
      {children}
      <div className={styles.grid} data-credit-packs data-appearance={appearance} role="tabpanel" id={`${id}-packs`} aria-labelledby={`${id}-tab-${workload}`}>
      {CREDIT_PACKS.map((pack) => {
        const capacity = creditUsageCapacity(pack.credits);
        const highlight = pack.id === recommended;
        const discount = Math.max(0, Math.floor((1 - (pack.amountCents / pack.credits) / (starter.amountCents / starter.credits)) * 100));
        return (
          <article key={pack.id} data-pack-id={pack.id} data-recommended={highlight} data-best-value={pack.id === "pro-topup" && !highlight} className={styles.card}>
            {highlight ? <span className={styles.popular}><CreditShopIcon name="sparkles" />{t(shortfall > 0 ? "creditShop.recommended" : "creditShop.mostPopular")}</span> : null}
            <div className={styles.cardTop}>
              <h3>{pack.name}</h3>
              {pack.id === "pro-topup" ? <span className={styles.bestValue}>{t("creditShop.bestValue")}</span> : <span className={styles.unitPrice}>${(pack.amountCents / 100 / pack.credits).toFixed(4)} {t("creditShop.perCredit")}</span>}
            </div>
            <div className={styles.priceRow}><strong data-pack-price className={styles.price}>{formatUsd(pack.amountCents)}</strong><span className={styles.currency}>USD</span>{pack.id === "pro-topup" ? <span className={styles.unitPrice}>${(pack.amountCents / 100 / pack.credits).toFixed(4)} {t("creditShop.perCredit")}</span> : null}</div>
            <span data-pack-credits className={styles.credits}><CreditShopIcon name="zap" />{pack.credits.toLocaleString()} {t("creditShop.credits")}</span>
            <div data-pack-discount className={styles.savings}>
              {discount > 0 ? <span>{t("creditShop.savings", { percent: discount })}</span> : <span className={styles.standard}>{t("creditShop.standardRate")}</span>}
              {pack.id === "creator" ? <span className={styles.bonus}>{t("creditShop.bonus", { credits: pack.credits - 2 * starter.credits })}</span> : null}
            </div>
            <div data-pack-details className={styles.details}>
              {workload === "all" ? <>
                <p className={styles.metric}><CreditShopIcon name="image" /><span>{t("creditShop.upTo")} <strong>{capacity.images.toLocaleString()}</strong> {t("creditShop.basicImages")}</span></p>
                <p className={styles.metric}><CreditShopIcon name="video" /><span>{t("creditShop.or")} <strong>{t("creditShop.outputVideos", { count: capacity.videos.toLocaleString() })}</strong> <span className={styles.metricNote}>({videoSpec})</span></span></p>
              </> : <div className={styles.estimate} data-usage-estimate={workload}>
                <span className={styles.estimateLabel}>{t(`creditShop.estimate${titleCase(workload)}`)}</span>
                <strong className={styles.estimateValue}>{t(`creditShop.output${workload === "video" ? "Videos" : workload === "image" ? "Images" : "Avatars"}`, { count: (workload === "video" ? capacity.videos : workload === "image" ? capacity.images : capacity.avatars).toLocaleString() })}</strong>
                <p className={styles.estimateNote}>{workload === "video" ? `${videoSpec} · ${t("creditShop.eachCredits", { credits: CREDIT_USAGE_REFERENCE.video.credits })}` : workload === "image" ? t("creditShop.imageBasis", { credits: CREDIT_USAGE_REFERENCE.image.credits }) : t("creditShop.avatarBasis", { seconds: CREDIT_USAGE_REFERENCE.avatar.seconds })}</p>
                {workload === "avatar" ? <p className={styles.estimateNote}>{t("creditShop.voiceCapacity", { count: capacity.voiceovers.toLocaleString(), characters: CREDIT_USAGE_REFERENCE.audio.characters.toLocaleString() })}</p> : null}
              </div>}
            </div>
            <button type="button" data-credit-pack-select={pack.id} aria-label={`${t("creditShop.buy")} — ${pack.name}`} disabled={Boolean(loadingPack)} onClick={() => accessToken ? setSelectedPack(pack.id) : requestSignIn({ onSuccess: () => setSelectedPack(pack.id) })}
              className={styles.buy}>{highlight ? <>{t("creditShop.buyAmount", { credits: pack.credits.toLocaleString() })}<CreditShopIcon name="arrow" /></> : t(`creditShop.buy${pack.id === "pro-topup" ? "Pro" : titleCase(pack.id)}`)}</button>
          </article>
        );
      })}
      </div>
      <footer className={styles.trust}>
        <div className={styles.tools}><strong>{t("creditShop.allTools")}</strong>{(["image", "video", "avatar", "audio"] as CreditShopIconName[]).map(tool => <span key={tool} className={styles.tool}><CreditShopIcon name={tool} />{t(`creditShop.tool${titleCase(tool)}`)}</span>)}</div>
        <div className={styles.reassurance}><span><CreditShopIcon name="shield" />{t("creditShop.oneTime")}</span><span><CreditShopIcon name="infinity" />{t("creditShop.neverExpire")}</span><span className={styles.usageNote}>{t("creditShop.usageNote")}</span></div>
      </footer>
      </div>
      {selectedPack && accessToken ? <PaymentDialog pack={CREDIT_PACKS.find(pack=>pack.id===selectedPack)!} accessToken={accessToken} balance={balance} t={t} loadingPack={loadingPack} message={message} onCheckout={onCheckout} onClose={()=>setSelectedPack(null)} /> : null}
    </div>
  );
}
