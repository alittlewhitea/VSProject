import { NextResponse } from "next/server";
import { getCreditPack } from "../../../../lib/billing";
import { kyrenCheckoutEnabled, kyrenConfigured } from "../../../../lib/kyrenpay";
import { createKyrenCreditCheckout } from "../../../../lib/kyrenpay-billing";
import { consumeRateLimit, trustedPublicOrigin } from "../../../../lib/request-security";
import { getUserFromBearerToken } from "../../../../lib/server-auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const body = await request.json().catch(() => null) as { type?: string; packId?: string } | null;
    if (body?.type === "subscription") return NextResponse.json({ error: "New subscriptions are no longer available. Choose a credit pack.", code: "subscriptions_closed" }, { status: 410 });
    const pack = typeof body?.packId === "string" ? getCreditPack(body.packId) : null;
    if (!pack || (body?.type && body.type !== "credits")) return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    if (!kyrenCheckoutEnabled() || !kyrenConfigured()) return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again later." }, { status: 503 });
    const rate = await consumeRateLimit({ scope: "credit_checkout", subject: user.id, limit: 6, windowSeconds: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Please wait before starting another checkout." }, { status: 429 });
    return NextResponse.json(await createKyrenCreditCheckout(user.id, pack.id, trustedPublicOrigin(request.url)));
  } catch (error) {
    console.error("Credit checkout failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to start checkout. Please try again later." }, { status: 500 });
  }
}
