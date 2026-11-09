import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";
import { LOGIN_SUCCESS_COOKIE } from "../../../../lib/login-success-receipt";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
  await deleteSession(token);
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LOGIN_SUCCESS_COOKIE);
  return NextResponse.json({ ok: true });
}
