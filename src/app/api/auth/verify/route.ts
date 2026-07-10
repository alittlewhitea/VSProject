import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool, toMysqlDate } from "../../../../lib/mysql";
import { createSession, hashAuthToken, SESSION_COOKIE_NAME, upsertEmailUser } from "../../../../lib/server-auth";
import { ensureSignupCreditAccount, getRequestCountryCode } from "../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { safeInternalPath, trustedPublicOrigin } from "../../../../lib/request-security";

function publicBaseUrl(request: NextRequest) {
  return trustedPublicOrigin(request.url);
}

function redirectUrl(request: NextRequest, path: string) {
  return new URL(path, publicBaseUrl(request));
}

function mysqlDateToUtcTime(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !value) return 0;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized}Z`).getTime();
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const next = request.nextUrl.searchParams.get("next") || "/studio";
  const redirectTo = safeInternalPath(next);

  if (!token) return NextResponse.redirect(redirectUrl(request, "/auth?error=invalid_link"));

  const hash = hashAuthToken(token);
  const [rows] = await getMysqlPool().execute<RowDataPacket[]>(
    "select id, email, expires_at, consumed_at from email_otp_codes where code_hash = ? order by created_at desc limit 1",
    [hash]
  );
  const row = rows[0];
  if (!row?.email || row.consumed_at || mysqlDateToUtcTime(row.expires_at) <= Date.now()) {
    return NextResponse.redirect(redirectUrl(request, "/auth?error=expired_link"));
  }

  const [consumeResult] = await getMysqlPool().execute<ResultSetHeader>(
    "update email_otp_codes set consumed_at = ? where id = ? and consumed_at is null and expires_at > now(6)",
    [toMysqlDate(new Date()), row.id]
  );
  if (consumeResult.affectedRows !== 1) {
    return NextResponse.redirect(redirectUrl(request, "/auth?error=expired_link"));
  }
  const user = await upsertEmailUser(String(row.email), { countryCode: getRequestCountryCode(request.headers) });
  const admin = createSupabaseAdminClient();
  if (admin) {
    await ensureSignupCreditAccount(admin, user.id, request.headers);
  }
  const session = await createSession(user);
  (await cookies()).set(SESSION_COOKIE_NAME, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expires_at)
  });

  return NextResponse.redirect(redirectUrl(request, redirectTo));
}
