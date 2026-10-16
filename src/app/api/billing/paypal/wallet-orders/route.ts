import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { getCreditPack } from "../../../../../lib/billing";
import { paypalWalletConfiguration } from "../../../../../lib/paypal";
import { createPayPalCreditCheckout } from "../../../../../lib/paypal-credit-checkout";
import { consumeRateLimit, trustedPublicOrigin } from "../../../../../lib/request-security";
export async function POST(request: Request) {
  try {
    const user=await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({error:"Unauthorized."},{status:401});
    const body=await request.json().catch(()=>null);
    const pack=typeof body?.packId==="string"?getCreditPack(body.packId):null;
    if (!pack || !["applepay","googlepay"].includes(body?.wallet)) return NextResponse.json({error:"Invalid wallet or credit pack."},{status:400});
    const config=paypalWalletConfiguration();
    if (!config.enabled || (body.wallet==="googlepay" && !config.merchantCountry)) return NextResponse.json({error:"This payment method is unavailable."},{status:503});
    if (body.expectedAmountCents!==pack.amountCents || body.expectedCredits!==pack.credits) return NextResponse.json({error:"The pack has changed. Please close and reopen checkout."},{status:409});
    const rate=await consumeRateLimit({scope:"credit_checkout",subject:user.id,limit:6,windowSeconds:60});
    if (!rate.allowed) return NextResponse.json({error:"Please wait before starting another checkout."},{status:429});
    return NextResponse.json(await createPayPalCreditCheckout(user.id,pack.id,trustedPublicOrigin(request.url),body.wallet));
  } catch {
    console.error("PayPal wallet order creation failed.");
    return NextResponse.json({error:"Unable to start payment. No credits have been added."},{status:502});
  }
}
