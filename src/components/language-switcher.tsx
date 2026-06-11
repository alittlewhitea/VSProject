"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  defaultLocale,
  getLocaleFromPathname,
  isLocalizedMarketingPath,
  localeLabels,
  locales,
  stripLocaleFromPathname,
  withLocalePrefix
} from "../i18n/routing";

export function LanguageSwitcher() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const activeLocale = getLocaleFromPathname(pathname) || defaultLocale;
  const cleanPathname = stripLocaleFromPathname(pathname);

  if (!isLocalizedMarketingPath(cleanPathname)) {
    return null;
  }

  const query = searchParams.toString();
  const hash = typeof window !== "undefined" ? window.location.hash : "";

  return (
    <div className="hidden items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 shadow-sm md:inline-flex">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={`${withLocalePrefix(locale, cleanPathname)}${query ? `?${query}` : ""}${hash}`}
          aria-label={`Switch language to ${locale}`}
          className={`rounded-full px-2.5 py-1 text-xs font-black transition ${
            locale === activeLocale ? "bg-[#0b0b0d] text-white" : "text-[#4f5a67] hover:bg-[#eef7ff] hover:text-[#171719]"
          }`}
        >
          {localeLabels[locale]}
        </Link>
      ))}
    </div>
  );
}
