import { createHash } from "node:crypto";

// Browser sessions authenticate with the httpOnly session cookie. Scripts only
// ever see a per-session placeholder, which is not a credential: the server
// ignores it and reads the cookie instead. Real bearer tokens still work for
// non-browser clients that obtained one outside the page.

export const PUBLIC_SESSION_PREFIX = "cookie:";

/** Stable per session (so client change detection keeps working), useless as a credential. */
export function publicSessionToken(realToken: string) {
  return PUBLIC_SESSION_PREFIX + createHash("sha256").update(`dreamface-public-session:${realToken}`).digest("hex").slice(0, 32);
}

/** The real bearer credential in an Authorization header, or null when the cookie should be used. */
export function bearerCredential(authHeader: string | null | undefined) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.startsWith(PUBLIC_SESSION_PREFIX) || token === "null" || token === "undefined") return null;
  return token;
}

type HeaderReader = { get(name: string): string | null };

function originOf(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Cookie authentication is limited to same-origin requests. Cross-site requests
 * (Sec-Fetch-Site) and foreign Origin headers are refused, in addition to the
 * SameSite=Lax cookie attribute.
 */
export function isSameOriginRequest(headers: HeaderReader, configuredOrigin?: string | null) {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = headers.get("origin");
  if (!origin) return fetchSite !== "same-site";
  const requestOrigin = originOf(origin);
  if (!requestOrigin) return false;
  if (configuredOrigin && requestOrigin === originOf(configuredOrigin)) return true;
  // A public configured origin is authoritative. Forwarded hosts are not a
  // second allowlist, and equal hostnames with a different scheme aren't equal origins.
  const host = headers.get("host");
  const parsed = new URL(requestOrigin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  return local && parsed.host === host && ["http:", "https:"].includes(parsed.protocol);
}
