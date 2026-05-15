import { NextResponse } from "next/server";
import { getCreditPack } from "../../../../lib/billing";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { getStripe } from "../../../../lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { packId?: string } | null;
    const pack = body?.packId ? getCreditPack(body.packId) : null;
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.amountCents,
            product_data: {
              name: `${pack.name} - ${pack.credits.toLocaleString()} credits`,
              description: pack.description
            }
          }
        }
      ],
      metadata: {
        userId: user.id,
        packId: pack.id,
        credits: String(pack.credits)
      },
      payment_intent_data: {
        metadata: {
          userId: user.id,
          packId: pack.id,
          credits: String(pack.credits)
        }
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to start checkout."
      },
      { status: 500 }
    );
  }
}

