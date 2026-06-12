"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  defaultLocale,
  getLocaleFromPathname,
  isLocalizedMarketingPath,
  localeLabels,
  locales,
  persistLocalePreference,
  stripLocaleFromPathname,
  withLocalePrefix
} from "../i18n/routing";

export function LanguageSwitcher() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const activeLocale = getLocaleFromPathname(pathname) || defaultLocale;
  const cleanPathname = stripLocaleFromPathname(pathname);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!isLocalizedMarketingPath(cleanPathname)) {
    return null;
  }

  const query = searchParams.toString();
  const hash = typeof window !== "undefined" ? window.location.hash : "";

  const localeHref = (locale: (typeof locales)[number]) =>
    `${withLocalePrefix(locale, cleanPathname)}${query ? `?${query}` : ""}${hash}`;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`Language: ${localeLabels[activeLocale]}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={localeLabels[activeLocale]}
        onClick={() => setOpen((current) => !current)}
        className={`grid h-10 w-10 place-items-center rounded-full border text-[#202633] shadow-sm transition hover:bg-[#f3f9ff] active:scale-95 ${
          open ? "border-[#0ea5e9] bg-[#e8f7ff]" : "border-black/10 bg-white/90"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_18px_52px_rgba(15,23,42,0.20)]">
          {locales.map((locale) => (
            <Link
              key={locale}
              role="menuitem"
              href={localeHref(locale)}
              onClick={() => {
                persistLocalePreference(locale);
                setOpen(false);
              }}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                locale === activeLocale ? "bg-[#e8f7ff] text-[#0284c7]" : "text-[#485164] hover:bg-[#f6f9fc]"
              }`}
            >
              <span>{localeLabels[locale]}</span>
              {locale === activeLocale ? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#0ea5e9]" /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
