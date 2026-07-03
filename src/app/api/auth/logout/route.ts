import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value || null;
  await deleteSession(token);
  cookies().delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
