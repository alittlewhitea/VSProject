import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool, toMysqlDate, withMysqlTransaction } from "../../../../lib/mysql";
import { createSession, getSessionFromToken, hashAuthToken, SESSION_COOKIE_NAME, upsertEmailUser } from "../../../../lib/server-auth";
import { ensureSignupCreditAccount, getRequestCountryCode, getRequestIp } from "../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { consumeRateLimit, safeInternalPath, trustedPublicOrigin } from "../../../../lib/request-security";
import { completeReferralAuth } from "../../../../lib/referrals";
import { authCompletionPath, authFailurePath, authPostLoginPath } from "../../../../lib/auth-navigation";
import { setLoginSuccessReceipt } from "../../../../lib/login-success-receipt";
import { GROWTH_COOKIE, recordSignupAttribution } from "../../../../lib/growth-attribution";
import { EMAIL_CODE_LENGTH, EMAIL_CODE_LIFETIME_SECONDS, normalizeSignInEmail } from "../../../../lib/auth-email-policy";
import { EMAIL_CODE_COOKIE, EMAIL_VERIFY_PATH, hashEmailCode } from "../../../../lib/auth-email-code";
import { readRequestJson, RequestBodyError } from "../../../../lib/request-body";

function publicBaseUrl(request: NextRequest) {
  return trustedPublicOrigin(request.url);
}

function redirectUrl(request: NextRequest, path: string) {
  return new URL(path, publicBaseUrl(request));
}

const EMAIL_SIGNIN_COOKIE = "dreamface_email_signin";

function mysqlDateToUtcTime(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !value) return 0;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized}Z`).getTime();
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const redirectTo = authPostLoginPath(safeInternalPath(request.nextUrl.searchParams.get("next")));
  if (!/^[a-f0-9]{64}$/i.test(token)) return NextResponse.redirect(redirectUrl(request, authFailurePath(authCompletionPath(redirectTo), "invalid_link")));
  // Email previews and link scanners can follow GETs. Only the browser's POST
  // consumes the link; the bearer token never enters a rendered page or GTM.
  const target = redirectUrl(request, authCompletionPath(redirectTo));
  target.searchParams.set("email", "1");
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(EMAIL_SIGNIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/verify", maxAge: 600 });
  return response;
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: NextRequest) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  let stage = "read_credential";
  try {
    if (request.headers.get("origin") !== publicBaseUrl(request)) return fail("invalid_origin", 403);
    const cookieStore = await cookies();
    const isCode = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
    const cookieName = isCode ? EMAIL_CODE_COOKIE : EMAIL_SIGNIN_COOKIE;
    const token = cookieStore.get(cookieName)?.value || "";
    if (!/^[a-f0-9]{64}$/i.test(token)) return fail(isCode ? "invalid_code" : "invalid_link", 400);
    const expired = isCode ? "expired_code" : "expired_link";
    const used = isCode ? "used_code" : "used_link";
    let email: string | undefined;
    let hash: string;
    if (isCode) {
      const payload = await readRequestJson(request, 4096);
      email = normalizeSignInEmail(payload?.email) ?? undefined;
      const code = payload?.code;
      if (!email || typeof code !== "string" || code.length !== EMAIL_CODE_LENGTH || !/^\d+$/.test(code)) return fail("invalid_code", 400);
      stage = "limit_code_attempts";
      const ip = getRequestIp(request.headers) || "unknown";
      const windowSeconds = EMAIL_CODE_LIFETIME_SECONDS;
      const ipLimit = await consumeRateLimit({ scope: "auth_code_ip", subject: ip, limit: 50, windowSeconds });
      if (!ipLimit.allowed) return fail("code_rate_limited", 429);
      const challengeLimit = await consumeRateLimit({ scope: "auth_code_attempt", subject: token, limit: 5, windowSeconds });
      if (!challengeLimit.allowed) return fail("code_rate_limited", 429);
      hash = hashEmailCode(token, email, code);
    } else {
      hash = hashAuthToken(token);
    }
    stage = "lookup_credential";
    const [rows] = await getMysqlPool().execute<RowDataPacket[]>(
      `select id, email, expires_at, consumed_at from email_otp_codes where code_hash = ?${email ? " and email = ?" : ""} order by created_at desc limit 1`,
      email ? [hash, email] : [hash]
    );
    const row = rows[0];
    if (!row && isCode) return fail("invalid_code", 400);
    if (!row?.email || mysqlDateToUtcTime(row.expires_at) <= Date.now()) {
      console.info("Email sign-in credential rejected", { attempt: hash.slice(0, 12), reason: row?.email ? "expired" : "unknown" });
      return fail(expired, 410);
    }
    if (row.consumed_at) {
      // A response can be lost after the cookie is set. Recover that same login
      // without creating another session, signup grant, referral, or login event.
      const existing = await getSessionFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
      if (existing?.user.email?.toLowerCase() !== String(row.email).toLowerCase()) return fail(used, 409);
      cookieStore.set(cookieName, "", { path: EMAIL_VERIFY_PATH, maxAge: 0 });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    stage = "upsert_user";
    const user = await upsertEmailUser(String(row.email), { countryCode: getRequestCountryCode(request.headers) });
    await recordSignupAttribution(user.id, user.isNew, cookieStore.get(GROWTH_COOKIE)?.value).catch(() => false);
    stage = "signup_credits";
    const admin = createSupabaseAdminClient();
    if (admin) {
      await ensureSignupCreditAccount(admin, user.id, request.headers);
    }
    // A failed session INSERT must roll back consumption, so a transient server
    // failure leaves the same credential usable. The conditional UPDATE also serializes
    // concurrent attempts; only its winner is allowed to create a session.
    stage = "create_session";
    const session = await withMysqlTransaction(async connection => {
      const now = toMysqlDate(new Date());
      const [consumeResult] = await connection.execute<ResultSetHeader>(
        "update email_otp_codes set consumed_at = ? where id = ? and consumed_at is null and expires_at > ?",
        [now, row.id, now]
      );
      if (consumeResult.affectedRows !== 1) return null;
      return createSession(user, connection);
    });
    if (!session) return fail(used, 409);
    stage = "set_session_cookie";
    await completeReferralAuth(user,user.isNew,true,hash,request.headers);
    cookieStore.set(SESSION_COOKIE_NAME, session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expires_at)
    });
    setLoginSuccessReceipt(cookieStore, session, "email");
    cookieStore.set(cookieName, "", { path: EMAIL_VERIFY_PATH, maxAge: 0 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return fail("invalid_code", error.status);
    // Never log the token, email, SQL parameters or raw database error object.
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
    console.error("Email sign-in failed", { stage, code });
    return NextResponse.json({ error: "signin_failed" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "2" } });
  }
}
