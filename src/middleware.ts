import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, getLocaleFromPathname, withLocalePrefix } from "./i18n/routing";
import { canCacheMarketingRequest, PRIVATE_PAGE_CACHE_CONTROL } from "./lib/marketing-cache-policy";

const DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || "local";
function withRuntimeHeaders(response: NextResponse, publicPage = false) {
  // Positive cache rules live in next.config: Next hides Flight headers from
  // middleware, so only that earlier layer can safely distinguish raw requests.
  if (!publicPage) {
    response.headers.set("Cache-Control", PRIVATE_PAGE_CACHE_CONTROL);
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
  response.headers.set("X-DreamFace-Deploy", DEPLOYMENT_ID);
  return response;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  const requestHeaders = new Headers(request.headers);
  const locale = getLocaleFromPathname(pathname) || defaultLocale;
  requestHeaders.set("x-dreamface-locale", locale);
  requestHeaders.set("x-dreamface-pathname", pathname);

  const redirectTargets = new Set(["/", "/price", "/auth", "/billing"]);
  if (redirectTargets.has(pathname)) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = withLocalePrefix(defaultLocale, pathname);
    return withRuntimeHeaders(NextResponse.redirect(redirectUrl));
  }

  const mode = url.searchParams.get("mode");

  if ((mode === "image" || mode === "video") && !url.searchParams.has("workflow")) {
    url.searchParams.set("workflow", mode === "image" ? "text-to-image" : "text-to-video");
    return withRuntimeHeaders(NextResponse.redirect(url));
  }

  return withRuntimeHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    }),
    process.env.NODE_ENV === "production" && canCacheMarketingRequest(request)
  );
}

export const config = {
  matcher: [
    "/((?!api|studio|admin|gallery|creations|images|fonts|favicon.ico|_next|.*\\..*).*)"
  ]
};
