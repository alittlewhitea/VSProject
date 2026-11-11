import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";
import { LOGIN_SUCCESS_COOKIE, readLoginSuccessReceipt } from "../../../../lib/login-success-receipt";
import { publicSessionToken } from "../../../../lib/session-transport";

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value || null;
  const session = await getSessionFromToken(token);
  const receipt = readLoginSuccessReceipt(store.get(LOGIN_SUCCESS_COOKIE)?.value, session);
  // The real token stays in the httpOnly cookie; page scripts only get a placeholder.
  const publicSession = session ? { ...session, access_token: publicSessionToken(session.access_token) } : null;
  return NextResponse.json(
    { session: publicSession, ...(receipt ? { loginEvent: { id: receipt.id, method: receipt.method } } : {}) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
