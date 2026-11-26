"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { requestSignIn } from "../lib/auth-navigation";
import { preloadPayPalWallets } from "../lib/paypal-wallets-client";
import {
  CHEAPEST_CREDIT_USAGE_REFERENCE,
  CREDIT_PACKS,
  CREDIT_USAGE_REFERENCE,
  cheapestCreditUsageCapacity,
  creditUsageCapacity,
  formatUsd,
  type CreditPaymentProvider
} from "../lib/billing";
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
function formatUnitCost(amountCents: number, count: number) {
  if (count <= 0) return "";
  const unit = amountCents / 100 / count;
  return unit < 0.01 ? `$${unit.toFixed(4)}` : `$${unit.toFixed(2)}`;
}

export function CreditPackGrid({ t, loadingPack, onCheckout, shortfall = 0, accessToken, message, appearance = "default", balance = null, titleId, headingLevel = 2, children }: {
  t: Translate; loadingPack: string | null; onCheckout: (id: string, provider: CreditPaymentProvider) => void | Promise<void>; shortfall?: number;
  appearance?: "default" | "studio"; accessToken?: string | null; message?: string;
  balance?: number | null; titleId?: string; headingLevel?: 1 | 2; children?: ReactNode;
}) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [workload, setWorkload] = useState<Workload>("all");
  const generatedId = useId();
  const id = appearance === "studio" ? titleId ?? "studio-credit-store" : generatedId;
  const tabs = useRef<HTMLDivElement>(null);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const usageRef = CHEAPEST_CREDIT_USAGE_REFERENCE ?? CREDIT_USAGE_REFERENCE;
  const computeCapacity = cheapestCreditUsageCapacity ?? creditUsageCapacity;
  const imageCredits = usageRef.image?.credits ?? 1;
  const videoCredits = usageRef.video?.credits ?? 15;
  const videoSeconds = usageRef.video?.seconds ?? 5;
  const videoResolution = usageRef.video?.resolution ?? "480p";
  const videoModel = usageRef.video?.model ?? "HeyGen Video";
  const avatarCredits = usageRef.avatar?.credits ?? videoCredits;
  const avatarSeconds = usageRef.avatar?.seconds ?? videoSeconds;
  const audioCredits = usageRef.audio?.credits ?? 1;
  const audioChars = usageRef.audio?.characters ?? 1000;
  const videoSpec = `${videoModel} · ${videoSeconds}s · ${videoResolution}`;
  useEffect(() => { if (accessToken) preparePayment(); }, [accessToken]);
  const recommended = shortfall > 0 ? (CREDIT_PACKS.find(pack => pack.credits >= shortfall)?.id ?? CREDIT_PACKS[CREDIT_PACKS.length - 1]?.id) : "creator";
  const starter = CREDIT_PACKS.find(pack => pack.id === "starter") ?? CREDIT_PACKS[0];
  return (
    <div className={appearance === "studio" ? `${styles.store} ${styles.studioTheme}` : styles.store} data-credit-store>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>{t("creditShop.eyebrow")}</p>
            <Heading id={titleId || `${id}-title`} className={styles.title}>{t("creditShop.title")}</Heading>
            <p className={styles.subtitle}>{t("creditShop.subtitle")}</p>
          </div>
          {accessToken ? <span className={styles.balance}><CreditShopIcon name="zap" />{t("creditShop.balance")}: <strong data-store-balance>{balance === null ? "—" : balance.toLocaleString()} {t("creditShop.credits")}</strong></span> : null}
        </div>
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
        const capacity = computeCapacity(pack.credits);
        const imageCount = capacity.images ?? 0;
        const videoCount = capacity.videos ?? 0;
        const avatarCount = capacity.avatars ?? videoCount;
        const voiceCount = capacity.voiceovers ?? imageCount;
        const highlight = pack.id === recommended;
        const discount = starter ? Math.max(0, Math.floor((1 - (pack.amountCents / pack.credits) / (starter.amountCents / starter.credits)) * 100)) : 0;
        const starterMultiple = starter ? Math.max(1, Math.round(pack.amountCents / starter.amountCents)) : 1;
        const bonusCredits = starter && pack.id !== "starter" ? Math.max(0, pack.credits - starterMultiple * starter.credits) : 0;
        const activeCount = workload === "video" ? videoCount : workload === "image" ? imageCount : avatarCount;
        const unitOutputCost = formatUnitCost(pack.amountCents, activeCount);
        return (
          <article key={pack.id} data-pack-id={pack.id} data-recommended={highlight} data-best-value={pack.id === "pro-topup" && !highlight} className={styles.card}>
            {highlight ? (
              <span className={styles.popular}>{t(shortfall > 0 ? "creditShop.recommended" : "creditShop.mostPopular")}</span>
            ) : pack.id === "pro-topup" ? (
              <span className={styles.bestValue}>{t("creditShop.bestValue")}</span>
            ) : null}
            <div className={styles.cardTop}>
              <h3 className={styles.packName}>{pack.name}</h3>
              {bonusCredits > 0 ? <span className={styles.bonusPill}>{t("creditShop.bonus", { credits: bonusCredits.toLocaleString() })}</span> : null}
            </div>
            <div className={styles.priceRow}>
              <strong data-pack-price className={styles.price}>{formatUsd(pack.amountCents)}</strong>
              <span className={styles.currency}>USD</span>
            </div>
            <div className={styles.creditBar}>
              <span data-pack-credits className={styles.credits}><CreditShopIcon name="zap" />{pack.credits.toLocaleString()} {t("creditShop.credits")}</span>
              <span className={styles.unitPrice}>${(pack.amountCents / 100 / pack.credits).toFixed(4)} {t("creditShop.perCredit")}</span>
            </div>
            <div data-pack-discount className={styles.savings}>
              {discount > 0 ? <span className={styles.savingsHighlight}>{t("creditShop.savings", { percent: discount })}</span> : <span className={styles.standard}>{t("creditShop.standardRate")}</span>}
            </div>
            <div data-pack-details className={styles.details}>
              {workload === "all" ? <div className={styles.entitlementList}>
                <p className={styles.metric}>
                  <CreditShopIcon name="image" />
                  <span className={styles.metricText}>{t("creditShop.upTo")} <strong>{imageCount.toLocaleString()}</strong> {t("creditShop.basicImages")}</span>
                  <span className={styles.metricCost}>{imageCredits} cr</span>
                </p>
                <p className={styles.metric}>
                  <CreditShopIcon name="video" />
                  <span className={styles.metricText}>{t("creditShop.or")} <strong>{t("creditShop.outputVideos", { count: videoCount.toLocaleString() })}</strong> <span className={styles.metricNote}>({videoSeconds}s · {videoResolution})</span></span>
                  <span className={styles.metricCost}>{videoCredits} cr</span>
                </p>
                <p className={styles.metric}>
                  <CreditShopIcon name="avatar" />
                  <span className={styles.metricText}>{t("creditShop.or")} <strong>{t("creditShop.outputAvatars", { count: avatarCount.toLocaleString() })}</strong> <span className={styles.metricNote}>({avatarSeconds}s · {videoResolution})</span></span>
                  <span className={styles.metricCost}>{avatarCredits} cr</span>
                </p>
                <p className={styles.metric}>
                  <CreditShopIcon name="audio" />
                  <span className={styles.metricText}>{t("creditShop.or")} <strong>{t("creditShop.outputVoice", { count: voiceCount.toLocaleString() })}</strong> <span className={styles.metricNote}>({audioChars.toLocaleString()} ch)</span></span>
                  <span className={styles.metricCost}>{audioCredits} cr</span>
                </p>
              </div> : <div className={styles.estimate} data-usage-estimate={workload}>
                <div className={styles.estimateHead}>
                  <span className={styles.estimateLabel}>{t(`creditShop.estimate${titleCase(workload)}`)}</span>
                  {unitOutputCost ? <span className={styles.unitTag}>≈ {unitOutputCost}</span> : null}
                </div>
                <strong className={styles.estimateValue}>{t(`creditShop.output${workload === "video" ? "Videos" : workload === "image" ? "Images" : "Avatars"}`, { count: activeCount.toLocaleString() })}</strong>
                <p className={styles.estimateNote}>{workload === "video" ? `${videoSpec} · ${t("creditShop.eachCredits", { credits: videoCredits })}` : workload === "image" ? t("creditShop.imageBasis", { credits: imageCredits }) : t("creditShop.avatarBasis", { seconds: avatarSeconds, credits: avatarCredits })}</p>
                {workload === "avatar" ? <p className={styles.estimateNote}>{t("creditShop.voiceCapacity", { count: voiceCount.toLocaleString(), characters: audioChars.toLocaleString() })}</p> : null}
              </div>}
            </div>
            <button type="button" data-credit-pack-select={pack.id} aria-label={`${t("creditShop.buy")} — ${pack.name}`} disabled={Boolean(loadingPack)} onClick={() => accessToken ? setSelectedPack(pack.id) : requestSignIn({ onSuccess: () => setSelectedPack(pack.id) })}
              className={styles.buy}>{highlight ? <>{t("creditShop.buyAmount", { credits: pack.credits.toLocaleString() })}<CreditShopIcon name="arrow" /></> : t(`creditShop.buy${pack.id === "pro-topup" ? "Pro" : titleCase(pack.id)}`)}</button>
          </article>
        );
      })}
      </div>
      <footer className={styles.trust}>
        <div className={styles.trustTop}>
          <div className={styles.tools}><strong>{t("creditShop.allTools")}</strong>{(["image", "video", "avatar", "audio"] as CreditShopIconName[]).map(tool => <span key={tool} className={styles.tool}><CreditShopIcon name={tool} />{t(`creditShop.tool${titleCase(tool)}`)}</span>)}</div>
          <div className={styles.reassurance}>
            <span><CreditShopIcon name="shield" />{t("creditShop.oneTime")}</span>
            <span><CreditShopIcon name="infinity" />{t("creditShop.neverExpire")}</span>
            <span><CreditShopIcon name="zap" />{t("creditShop.instantDelivery")}</span>
            <span><CreditShopIcon name="sparkles" />{t("creditShop.refundProtection")}</span>
          </div>
        </div>
        <p className={styles.basisFootnote}>{t("creditShop.usageNote")}</p>
      </footer>
      </div>
      {selectedPack && accessToken ? <PaymentDialog pack={CREDIT_PACKS.find(pack=>pack.id===selectedPack)!} accessToken={accessToken} balance={balance} t={t} loadingPack={loadingPack} message={message} onCheckout={onCheckout} appearance={appearance} onClose={()=>setSelectedPack(null)} /> : null}
    </div>
  );
}
