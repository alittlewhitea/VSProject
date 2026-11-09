import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";
import { LOGIN_SUCCESS_COOKIE, readLoginSuccessReceipt } from "../../../../lib/login-success-receipt";

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value || null;
  const session = await getSessionFromToken(token);
  const receipt = readLoginSuccessReceipt(store.get(LOGIN_SUCCESS_COOKIE)?.value, session);
  return NextResponse.json({ session, ...(receipt ? { loginEvent: { id: receipt.id, method: receipt.method } } : {}) });
}
