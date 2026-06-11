export const locales = ["en", "zh-CN", "pt-BR", "ru", "vi"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "pt-BR": "Português",
  ru: "Русский",
  vi: "Tiếng Việt"
};

export const localizedMarketingPaths = ["/", "/price", "/auth", "/billing"] as const;

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && (locales as readonly string[]).includes(value));
}

export function getLocaleFromPathname(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

export function stripLocaleFromPathname(pathname: string) {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.replace(`/${locale}`, "") || "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export function withLocalePrefix(locale: Locale, pathname: string) {
  const cleanPathname = stripLocaleFromPathname(pathname);
  return cleanPathname === "/" ? `/${locale}` : `/${locale}${cleanPathname}`;
}

export function isLocalizedMarketingPath(pathname: string) {
  const cleanPathname = stripLocaleFromPathname(pathname);
  return (localizedMarketingPaths as readonly string[]).includes(cleanPathname);
}

export function localizeMarketingHref(locale: Locale, href: string) {
  if (!href.startsWith("/")) return href;
  const [pathAndQuery, hash = ""] = href.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  if (!isLocalizedMarketingPath(pathname)) return href;
  return `${withLocalePrefix(locale, pathname)}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
