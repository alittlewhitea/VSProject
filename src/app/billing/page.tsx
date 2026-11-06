"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { defaultLocale, isLocale } from "../../i18n/routing";
import PublicPricingPage from "../../features/billing/billing-content";

const BillingStudio = dynamic(() => import("../studio/studio-client").then(module => module.StudioPageClient));

/** Existing payment return URLs stay valid and now render inside Studio. */
export default function BillingPage() {
  const pathname = usePathname();
  const locale = useLocale();
  if (pathname.endsWith("/price")) return <PublicPricingPage />;
  return <BillingStudio initialLocale={isLocale(locale) ? locale : defaultLocale} initialView="billing" />;
}
