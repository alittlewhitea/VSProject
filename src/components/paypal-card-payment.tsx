"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatUsd } from "../lib/billing";
import { getPayPalWalletConfig } from "../lib/paypal-wallets-client";
import { mountPayPalCards, type CardCallbacks, type CardController } from "../lib/paypal-cards-client";

type Translate = (key: string, values?: Record<string, string | number>) => string;
// CardFields supplies its own border, padding and auto-resizing wrapper. Keep
// the host in normal flow; a fixed height makes the next label overlap it.
const CARD_FIELD_HOST = "min-h-[78px] w-full min-w-0 [&_iframe]:block [&_iframe]:max-w-full";
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");

export function PayPalCardPayment({ amountCents, disabled, callbacks, t }: {
  amountCents: number; disabled: boolean; callbacks: CardCallbacks; t: Translate;
}) {
  const id = useId(), name = useRef<HTMLDivElement>(null), number = useRef<HTMLDivElement>(null), expiry = useRef<HTMLDivElement>(null), cvv = useRef<HTMLDivElement>(null);
  const controller = useRef<CardController | null>(null), callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;
  const [open, setOpen] = useState(false), [status, setStatus] = useState("loading"), [attempt, setAttempt] = useState(0), [invalid, setInvalid] = useState(false);
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([document.documentElement.lang || "en"], { type: "region" });
    return COUNTRY_CODES.map(code => ({ code, name: names.of(code) || code })).sort((a, b) => a.name.localeCompare(b.name));
  }, [t]);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setStatus("loading"); setInvalid(false);
    void (async () => {
      try {
        const config = await getPayPalWalletConfig(attempt > 0);
        if (abort.signal.aborted || !name.current || !number.current || !expiry.current || !cvv.current) return;
        const card = await mountPayPalCards(config, {
          containers: { name: name.current, number: number.current, expiry: expiry.current, cvv: cvv.current },
          placeholders: { name: t("creditShop.cardName"), number: t("creditShop.cardNumber"), expiry: "MM / YY", cvv: "CVV" },
          signal: abort.signal,
          callbacks: {
            canStart: () => callbackRef.current.canStart?.() !== false,
            createOrder: () => callbackRef.current.createOrder(), capture: orderId => callbackRef.current.capture(orderId),
            onBusy: value => callbackRef.current.onBusy(value), onAuthorized: orderId => callbackRef.current.onAuthorized(orderId),
            onSuccess: receipt => callbackRef.current.onSuccess(receipt), onError: () => callbackRef.current.onError(),
            onInvalid: () => setInvalid(true)
          }
        });
        if (abort.signal.aborted) card.destroy();
        else { controller.current = card; setStatus(card.eligible ? "ready" : "unavailable"); }
      } catch { if (!abort.signal.aborted) setStatus("error"); }
    })();
    return () => { abort.abort(); controller.current?.destroy(); controller.current = null; };
  }, [open, attempt, amountCents]);
  return <div data-paypal-card-payment className="min-w-0">
    <button type="button" data-payment-provider="paypal-card" aria-expanded={open} aria-controls={`${id}-panel`} disabled={disabled} onClick={() => setOpen(value => !value)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d9ccec] bg-white px-4 text-sm font-bold text-[#37294b] transition hover:bg-[#faf7ff] disabled:opacity-40">
      <svg aria-hidden="true" width="20" height="16" viewBox="0 0 20 16" fill="none"><rect x="1" y="1" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 5h16M4 11h4" stroke="currentColor" strokeWidth="1.5"/></svg>
      {t("creditShop.cardTitle")}
    </button>
    <div id={`${id}-panel`} hidden={!open} data-card-status={status} className="mt-3 rounded-2xl border border-[#e8e0f7] bg-[#faf9fc] p-4">
      {status === "loading" ? <p role="status" className="text-sm text-[#82758f]">{t("creditShop.cardLoading")}</p> : null}
      {status === "unavailable" ? <p role="status" className="text-sm leading-6 text-[#82758f]">{t("creditShop.cardUnavailable")}</p> : null}
      {status === "error" ? <div role="status"><p className="text-sm text-[#82758f]">{t("creditShop.walletLoadFailed")}</p><button type="button" data-card-load-retry disabled={disabled} onClick={() => setAttempt(value => value + 1)} className="mt-2 min-h-11 text-sm font-bold text-[#7554e8]">{t("creditShop.walletLoadRetry")}</button></div> : null}
      <form hidden={status !== "ready" && status !== "loading"} aria-busy={status === "loading"} onSubmit={event => {
        event.preventDefault(); if (disabled) return;
        const data = new FormData(event.currentTarget); setInvalid(false);
        void controller.current?.submit({ addressLine1: String(data.get("addressLine1") || "").trim(), adminArea1: String(data.get("adminArea1") || "").trim(), adminArea2: String(data.get("adminArea2") || "").trim(), countryCode: String(data.get("countryCode") || ""), postalCode: String(data.get("postalCode") || "").trim() });
      }}>
        <fieldset disabled={disabled || status !== "ready"} inert={disabled || status !== "ready" || undefined} className="grid min-w-0 gap-3">
          <p className="text-xs leading-5 text-[#82758f]">{t("creditShop.cardSecure")}</p>
          {[["name", name, "cardName"], ["number", number, "cardNumber"]] .map(([key, ref, label]) => <div key={key as string} className="min-w-0"><p className="mb-1 text-xs font-semibold text-[#5e4a78]">{t(`creditShop.${label}`)}</p><div ref={ref as typeof name} data-card-field={key as string} className={CARD_FIELD_HOST} /></div>)}
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <div className="min-w-0"><p className="mb-1 text-xs font-semibold text-[#5e4a78]">{t("creditShop.cardExpiry")}</p><div ref={expiry} data-card-field="expiry" className={CARD_FIELD_HOST} /></div>
            <div className="min-w-0"><p className="mb-1 text-xs font-semibold text-[#5e4a78]">{t("creditShop.cardCvv")}</p><div ref={cvv} data-card-field="cvv" className={CARD_FIELD_HOST} /></div>
          </div>
          <p className="mt-1 text-xs font-bold text-[#5e4a78]">{t("creditShop.cardBillingAddress")}</p>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5e4a78]">{t("creditShop.cardCountry")}<select name="countryCode" autoComplete="billing country" required defaultValue="" className="h-11 w-full min-w-0 rounded-lg border border-[#ddd4e8] bg-white px-2 text-sm text-[#241a34]"><option value="" disabled>{t("creditShop.cardChooseCountry")}</option>{countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
          {[["addressLine1", "cardAddress", "address-line1", true], ["adminArea2", "cardCity", "address-level2", true], ["adminArea1", "cardRegion", "address-level1", false], ["postalCode", "cardPostal", "postal-code", false]].map(([field, label, autoComplete, required]) => <label key={field as string} className="grid min-w-0 gap-1 text-xs font-semibold text-[#5e4a78]">{t(`creditShop.${label}`)}<input name={field as string} autoComplete={`billing ${autoComplete}`} required={required as boolean} maxLength={100} className="h-11 w-full min-w-0 rounded-lg border border-[#ddd4e8] bg-white px-3 text-base font-normal text-[#241a34] outline-none focus:border-[#7554e8]" /></label>)}
          {invalid ? <p role="alert" className="text-xs leading-5 text-red-700">{t("creditShop.cardInvalid")}</p> : null}
          <button type="submit" data-card-pay disabled={disabled} className="mt-1 min-h-12 rounded-xl bg-[#7554e8] px-3 text-sm font-bold text-white disabled:opacity-40">{t("creditShop.cardPay", { amount: formatUsd(amountCents) })}</button>
        </fieldset>
      </form>
    </div>
  </div>;
}
