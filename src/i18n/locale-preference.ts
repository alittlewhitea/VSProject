import { defaultLocale, localeCookieKey, locales } from "./routing";

/** Self-contained so the same resolver can be generated into the edge Worker. */
export function createLocalePreferenceResolver<T extends string>(
  supportedLocales: readonly T[],
  fallback: T,
  cookieName: string
) {
  const supported = new Map(supportedLocales.map(locale => [locale.toLowerCase(), locale]));

  function matchLanguage(language: string): T | null {
    const tag = language.trim().toLowerCase();
    if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/.test(tag)) return null;
    const exact = supported.get(tag);
    if (exact) return exact;
    const parts = tag.split("-");
    if (parts[0] === "zh") {
      const traditional = parts.includes("hant") || (!parts.includes("hans") && parts.some(part => ["tw", "hk", "mo"].includes(part)));
      return supported.get(traditional ? "zh-tw" : "zh-cn") ?? null;
    }
    if (parts[0] === "pt") return supported.get("pt-br") ?? null;
    if (parts[0] === "iw") return supported.get("he") ?? null;
    return supported.get(parts[0]) ?? null;
  }

  return function resolveLocale(headers: Pick<Headers, "get">): T {
    for (const item of (headers.get("cookie") ?? "").split(";")) {
      const separator = item.indexOf("=");
      if (separator < 0 || item.slice(0, separator).trim() !== cookieName) continue;
      try {
        const saved = decodeURIComponent(item.slice(separator + 1).trim()).toLowerCase();
        const locale = supported.get(saved);
        if (locale) return locale;
      } catch { /* Ignore a malformed preference and use browser languages. */ }
    }

    const preferences = (headers.get("accept-language") ?? "").slice(0, 8192).split(",").slice(0, 64).map((part, index) => {
      const [language, ...parameters] = part.trim().split(";");
      let quality = 1;
      let hasQuality = false;
      for (const parameter of parameters) {
        const match = /^q\s*=\s*(.*)$/i.exec(parameter.trim());
        if (!match) { quality = 0; break; }
        if (hasQuality || !/^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|\.\d{1,3})$/.test(match[1])) {
          quality = 0;
          break;
        }
        hasQuality = true;
        quality = Number(match[1]);
      }
      return { language, quality, index };
    }).filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality || a.index - b.index);

    for (const { language } of preferences) {
      if (language === "*") return fallback;
      const locale = matchLanguage(language);
      if (locale) return locale;
    }
    return fallback;
  };
}

export const resolveRequestLocale = createLocalePreferenceResolver(locales, defaultLocale, localeCookieKey);
