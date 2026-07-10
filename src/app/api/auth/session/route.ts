import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value || null;
  const session = await getSessionFromToken(token);
  return NextResponse.json({ session });
}
