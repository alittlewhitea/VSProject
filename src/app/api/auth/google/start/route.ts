import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { newAuthToken } from "../../../../../lib/server-auth";

const STATE_COOKIE = "dreamface_google_state";

function callbackUrl(request: NextRequest) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || process.env.SITE_URL?.trim().replace(/\/$/, "") || request.nextUrl.origin;
  return `${base}/api/auth/google/callback`;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return NextResponse.redirect(new URL("/auth?error=google_not_configured", request.url));

  const next = request.nextUrl.searchParams.get("next") || "/studio";
  const safeNext = next.startsWith("/") ? next : "/studio";
  const csrf = newAuthToken();
  const state = Buffer.from(JSON.stringify({ csrf, next: safeNext })).toString("base64url");
  cookies().set(STATE_COOKIE, csrf, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(url);
}
