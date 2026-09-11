import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { consumeRateLimit } from "../../../../../lib/request-security";
import { syncKyrenReference } from "../../../../../lib/kyrenpay-billing";

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.reference !== "string" || !/^[0-9a-f-]{36}$/.test(body.reference)) return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
    const rate = await consumeRateLimit({ scope: "kyren_sync", subject: user.id, limit: 30, windowSeconds: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Please wait before checking again." }, { status: 429 });
    const result = await syncKyrenReference(body.reference, user.id);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Order not found." }, { status: 404 });
  } catch (error) {
    console.error("KyrenPay payment sync failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Payment confirmation is temporarily unavailable. Please check again shortly." }, { status: 503 });
  }
}
