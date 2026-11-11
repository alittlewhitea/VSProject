import { getLocaleFromPathname, stripLocaleFromPathname } from "../i18n/routing";
import { hasOnlyTrackingParameters } from "./search-url-policy";
import settings from "./marketing-cache-settings.json";

export const PUBLIC_MARKETING_CACHE_CONTROL = settings.publicCacheControl;
export const PRIVATE_PAGE_CACHE_CONTROL = settings.privateCacheControl;

// Explicit pages only: a new account page or unknown/removed model never inherits public caching.
const publicPages = new Set(settings.englishPages);
const translatedLandingPages = new Set(settings.translatedLandingPages);

export function isPublicMarketingPage(pathname: string) {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return publicPages.has(pathname);
  const path = stripLocaleFromPathname(pathname);
  if (path === "/") return true;
  return (locale === "es" || locale === "pt-BR") && translatedLandingPages.has(path);
}

export function canCacheMarketingRequest(request: { method: string; url: string; headers: Headers }) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = new URL(request.url);
  if (!isPublicMarketingPage(url.pathname)) return false;
  // Flight/prefetch responses are navigation data, not interchangeable with the HTML document.
  if (settings.nonHtmlHeaders.some(key => request.headers.has(key))) return false;
  if (request.headers.get("accept")?.includes("text/x-component")) return false;
  return hasOnlyTrackingParameters(Object.fromEntries(url.searchParams));
}
