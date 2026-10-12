import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { consumeRateLimit } from "../../../../../lib/request-security";
import { DODO_CHECKOUT_ID, syncDodoCheckout } from "../../../../../lib/dodo-credit-payments";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (typeof body?.checkoutId !== "string" || !DODO_CHECKOUT_ID.test(body.checkoutId)) return NextResponse.json({ error: "Invalid checkout identifier." }, { status: 400 });
    const rate = await consumeRateLimit({ scope: "dodo_checkout_sync", subject: user.id, limit: 20, windowSeconds: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Please wait before checking again." }, { status: 429 });
    const result = await syncDodoCheckout(user.id, body.checkoutId);
    if (!result) return NextResponse.json({ error: "Checkout not found." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Payment confirmation is temporarily unavailable." }, { status: 503 }); }
}
