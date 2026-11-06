"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../../i18n/routing";

const cache = new Map<Locale, Record<string, string>>();

/** Display translations only: source IDs, names, URLs and prompts stay untouched. */
export function useStudioTemplateTitles(locale: Locale) {
  const [loaded, setLoaded] = useState<{ locale: Locale; titles: Record<string, string> } | null>(null);
  useEffect(() => {
    if (locale === "en") return;
    const existing = cache.get(locale);
    if (existing) { setLoaded({ locale, titles: existing }); return; }
    const controller = new AbortController();
    fetch(`/data/studio-template-titles/${locale}.json`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Title translations unavailable");
      const value = await response.json() as { version: number; titles: Record<string, string> };
      if (value.version !== 1 || !value.titles || typeof value.titles !== "object" || Object.values(value.titles).some(title => typeof title !== "string" || !title)) throw new Error("Invalid title translations");
      if (!controller.signal.aborted) {
        cache.set(locale, value.titles);
        while (cache.size > 4) cache.delete(cache.keys().next().value!);
        setLoaded({ locale, titles: value.titles });
      }
    }).catch(() => { /* Keep source titles visible if a display-only translation file fails. */ });
    return () => controller.abort();
  }, [locale]);
  const titles = locale === "en" ? undefined : loaded?.locale === locale ? loaded.titles : cache.get(locale);
  return (source: string) => typeof titles?.[source] === "string" ? titles[source] : source;
}
