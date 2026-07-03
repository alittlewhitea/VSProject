import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getMysqlPool, toMysqlDate } from "../../../../lib/mysql";
import { createSession, hashAuthToken, SESSION_COOKIE_NAME, upsertEmailUser } from "../../../../lib/server-auth";

function publicBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || process.env.SITE_URL?.trim().replace(/\/$/, "") || request.nextUrl.origin;
}

function redirectUrl(request: NextRequest, path: string) {
  return new URL(path, publicBaseUrl(request));
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const next = request.nextUrl.searchParams.get("next") || "/studio";
  const redirectTo = next.startsWith("/") ? next : "/studio";

  if (!token) return NextResponse.redirect(redirectUrl(request, "/auth?error=invalid_link"));

  const hash = hashAuthToken(token);
  const [rows] = await getMysqlPool().execute<RowDataPacket[]>(
    "select id, email from email_otp_codes where code_hash = ? and consumed_at is null and expires_at > now(6) order by created_at desc limit 1",
    [hash]
  );
  const row = rows[0];
  if (!row?.email) return NextResponse.redirect(redirectUrl(request, "/auth?error=expired_link"));

  await getMysqlPool().execute("update email_otp_codes set consumed_at = ? where id = ?", [toMysqlDate(new Date()), row.id]);
  const user = await upsertEmailUser(String(row.email));
  const session = await createSession(user);
  cookies().set(SESSION_COOKIE_NAME, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expires_at)
  });

  return NextResponse.redirect(redirectUrl(request, redirectTo));
}
