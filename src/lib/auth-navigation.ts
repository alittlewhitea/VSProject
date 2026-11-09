import type { AuthSession } from "./supabase-client";
import { locales } from "../i18n/routing";

export const AUTH_DIALOG_EVENT = "dreamface-open-auth";
export const AUTH_RESULT_EVENT = "dreamface-auth-result";
export const AUTH_REDIRECT_EVENT = "dreamface-auth-before-redirect";

export type SignInRequest = {
  next?: string;
  referral?: string | null;
  onSuccess?: (session: AuthSession) => void;
  onBeforeRedirect?: () => boolean | void;
  googlePopup?: Window | null;
  redirectOnSuccess?: boolean;
};

/** Both Google entry points open during the user's click, before async work. */
export function openGoogleSignInPopup(next: string) {
  const url = `/api/auth/google/start?${new URLSearchParams({ next: authReturnPath(next), popup: "1" })}`;
  const width = 500, height = 680;
  return window.open(url, "dreamface-google-login", `popup=yes,width=${width},height=${height},left=${Math.max(0, window.screenX + (window.outerWidth - width) / 2)},top=${Math.max(0, window.screenY + (window.outerHeight - height) / 2)}`);
}

export function authReturnPath(value: unknown, fallback = "/studio?view=home") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n\0]/.test(value)) return fallback;
  const url = new URL(value, "https://dreamface.invalid");
  return url.origin === "https://dreamface.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
}

export function authCompletionPath(next: string, error?: string) {
  const params = new URLSearchParams({ next: authReturnPath(next) });
  if (error) params.set("error", error);
  return `/auth/complete?${params}`;
}

/** Old email links may wrap the destination in a completion URL or point home. */
export function authPostLoginPath(value: unknown) {
  let path = authReturnPath(value);
  for (let depth = 0; depth < 3; depth++) {
    const url = new URL(path, "https://dreamface.invalid");
    if (url.pathname === "/auth/complete") { path = authReturnPath(url.searchParams.get("next")); continue; }
    if (url.pathname === "/" || locales.some(locale => url.pathname === `/${locale}` || url.pathname === `/${locale}/`)) return "/studio?view=home";
    return path;
  }
  return "/studio?view=home";
}

export function authFailurePath(next: string, error: string) {
  const url = new URL(authReturnPath(next), "https://dreamface.invalid");
  if (url.pathname === "/auth/complete") return authCompletionPath(url.searchParams.get("next") || "/studio", error);
  return `/auth?${new URLSearchParams({ error, next: authReturnPath(next) })}`;
}

/** Open in place; callers opt into navigation after success or resume an action. */
export function requestSignIn(options: SignInRequest = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SignInRequest>(AUTH_DIALOG_EVENT, {
    detail: {
      ...options,
      onBeforeRedirect: options.onBeforeRedirect || (() => window.dispatchEvent(new Event(AUTH_REDIRECT_EVENT, { cancelable: true }))),
      next: authReturnPath(options.next || `${window.location.pathname}${window.location.search}${window.location.hash}`)
    }
  }));
}

export function requestGoogleSignIn(options: SignInRequest = {}) {
  const next = authReturnPath(options.next || `${window.location.pathname}${window.location.search}${window.location.hash}`);
  requestSignIn({ ...options, next, googlePopup: openGoogleSignInPopup(next) });
}
