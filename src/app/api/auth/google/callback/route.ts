import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE_NAME, upsertGoogleUser } from "../../../../../lib/server-auth";
import { ensureSignupCreditAccount, getRequestCountryCode } from "../../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { safeInternalPath, trustedPublicOrigin } from "../../../../../lib/request-security";
import { completeReferralAuth } from "../../../../../lib/referrals";
import { authCompletionPath } from "../../../../../lib/auth-navigation";
import { setLoginSuccessReceipt } from "../../../../../lib/login-success-receipt";
import { GROWTH_COOKIE, recordSignupAttribution } from "../../../../../lib/growth-attribution";

const STATE_COOKIE = "dreamface_google_state";

function callbackUrl(request: NextRequest) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  const base = trustedPublicOrigin(request.url);
  return `${base}/api/auth/google/callback`;
}

function publicBaseUrl(request: NextRequest) {
  return trustedPublicOrigin(request.url);
}

function redirectUrl(request: NextRequest, path: string) {
  return new URL(path, publicBaseUrl(request));
}

function decodeState(value: string | null) {
  try {
    if (!value) return null;
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { csrf?: string; next?: string; popup?: boolean };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = decodeState(request.nextUrl.searchParams.get("state"));
  const fail = (error: string) => NextResponse.redirect(redirectUrl(request, state?.popup ? authCompletionPath(safeInternalPath(state.next), error) : `/auth?${new URLSearchParams({ error, next: safeInternalPath(state?.next) })}`));
  const cookieStore = await cookies();
  const expectedCsrf = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state?.csrf || state.csrf !== expectedCsrf) {
    return fail("google_state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return fail("google_not_configured");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(request),
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });
  if (!tokenRes.ok) return fail("google_token");
  const tokenPayload = (await tokenRes.json()) as { access_token?: string };
  if (!tokenPayload.access_token) return fail("google_token");

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    cache: "no-store"
  });
  if (!userRes.ok) return fail("google_user");
  const profile = (await userRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };
  if (!profile.sub) return fail("google_user");

  const user = await upsertGoogleUser({
    googleSub: profile.sub,
    email: profile.email_verified === true ? profile.email || null : null,
    fullName: profile.name || null,
    avatarUrl: profile.picture || null,
    countryCode: getRequestCountryCode(request.headers),
    raw: profile
  });
  await recordSignupAttribution(user.id, user.isNew, cookieStore.get(GROWTH_COOKIE)?.value).catch(() => false);
  const admin = createSupabaseAdminClient();
  if (admin) {
    await ensureSignupCreditAccount(admin, user.id, request.headers);
  }
  const session = await createSession(user);
  await completeReferralAuth(user,user.isNew,profile.email_verified===true,state.csrf,request.headers);
  cookieStore.set(SESSION_COOKIE_NAME, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expires_at)
  });
  setLoginSuccessReceipt(cookieStore, session, "google");

  const next = safeInternalPath(state.next);
  return NextResponse.redirect(redirectUrl(request, state.popup ? authCompletionPath(next) : next));
}
