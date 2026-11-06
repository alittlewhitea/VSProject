"use client";

import { useEffect, useState } from "react";
import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import { PricingContent } from "../billing/billing-content";
import { loadMessages } from "../../i18n/messages";
import type { Locale } from "../../i18n/routing";

/** Reuse the existing account, checkout, capture and ledger implementation. */
export function StudioBillingWorkspace({ locale, onBalanceChange }: { locale: Locale; onBalanceChange: (balance: number) => void }) {
  const rootLocale = useLocale();
  const rootMessages = useMessages();
  const [localized, setLocalized] = useState({ locale: rootLocale, messages: rootMessages });
  useEffect(() => {
    let cancelled = false;
    loadMessages(locale).then(messages => { if (!cancelled) setLocalized({ locale, messages }); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [locale]);
  return <div aria-busy={localized.locale !== locale}>
    <NextIntlClientProvider locale={localized.locale} messages={localized.messages}>
      <PricingContent surface="billing" embedded onBalanceChange={onBalanceChange} />
    </NextIntlClientProvider>
  </div>;
}
