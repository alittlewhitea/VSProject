import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool, toMysqlDate } from "../../../../lib/mysql";
import { createSession, getSessionFromToken, hashAuthToken, SESSION_COOKIE_NAME, upsertEmailUser } from "../../../../lib/server-auth";
import { ensureSignupCreditAccount, getRequestCountryCode } from "../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { safeInternalPath, trustedPublicOrigin } from "../../../../lib/request-security";
import { completeReferralAuth } from "../../../../lib/referrals";
import { authCompletionPath, authFailurePath, authPostLoginPath } from "../../../../lib/auth-navigation";
import { setLoginSuccessReceipt } from "../../../../lib/login-success-receipt";

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
  if (request.headers.get("origin") !== publicBaseUrl(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const cookieStore = await cookies();
  const token = cookieStore.get(EMAIL_SIGNIN_COOKIE)?.value || "";
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
  if (!/^[a-f0-9]{64}$/i.test(token)) return fail("invalid_link", 400);

  const hash = hashAuthToken(token);
  const [rows] = await getMysqlPool().execute<RowDataPacket[]>(
    "select id, email, expires_at, consumed_at from email_otp_codes where code_hash = ? order by created_at desc limit 1",
    [hash]
  );
  const row = rows[0];
  if (!row?.email || mysqlDateToUtcTime(row.expires_at) <= Date.now()) return fail("expired_link", 410);
  if (row.consumed_at) {
    // A response can be lost after the cookie is set. Recover that same login
    // without creating another session, signup grant, referral, or login event.
    const existing = await getSessionFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (existing?.user.email?.toLowerCase() !== String(row.email).toLowerCase()) return fail("used_link", 409);
    cookieStore.set(EMAIL_SIGNIN_COOKIE, "", { path: "/api/auth/verify", maxAge: 0 });
    return NextResponse.json({ ok: true });
  }

  const now = toMysqlDate(new Date());
  const [consumeResult] = await getMysqlPool().execute<ResultSetHeader>(
    "update email_otp_codes set consumed_at = ? where id = ? and consumed_at is null and expires_at > ?",
    [now, row.id, now]
  );
  if (consumeResult.affectedRows !== 1) return fail("used_link", 409);
  const user = await upsertEmailUser(String(row.email), { countryCode: getRequestCountryCode(request.headers) });
  const admin = createSupabaseAdminClient();
  if (admin) {
    await ensureSignupCreditAccount(admin, user.id, request.headers);
  }
  const session = await createSession(user);
  await completeReferralAuth(user,user.isNew,true,hash,request.headers);
  cookieStore.set(SESSION_COOKIE_NAME, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expires_at)
  });
  setLoginSuccessReceipt(cookieStore, session, "email");
  cookieStore.set(EMAIL_SIGNIN_COOKIE, "", { path: "/api/auth/verify", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
