import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";
import { LOGIN_SUCCESS_COOKIE } from "../../../../lib/login-success-receipt";
import { isSameOriginRequest } from "../../../../lib/session-transport";
import { trustedPublicOrigin } from "../../../../lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers, trustedPublicOrigin(request.url))) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
  await deleteSession(token);
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LOGIN_SUCCESS_COOKIE);
  return NextResponse.json({ ok: true });
}
