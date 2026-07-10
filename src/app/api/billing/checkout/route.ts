import { NextResponse } from "next/server";
import { getCreditPack, getSubscriptionPlanPrice } from "../../../../lib/billing";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStripe } from "../../../../lib/stripe";
import { trustedPublicOrigin } from "../../../../lib/request-security";

type CheckoutBody = {
  type?: "credits" | "subscription";
  packId?: string;
  planId?: string;
  cycle?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as CheckoutBody | null;
    const origin = trustedPublicOrigin(request.url);
    const automaticTaxEnabled = process.env.STRIPE_AUTOMATIC_TAX === "true";
    const stripe = getStripe();

    if (body?.type === "subscription") {
      const subscription = body.planId && body.cycle ? getSubscriptionPlanPrice(body.planId, body.cycle) : null;
      const stripePriceId = subscription ? process.env[subscription.price.stripePriceEnv]?.trim() : null;
      if (!subscription || !stripePriceId) {
        return NextResponse.json({ error: "Subscription plan is not configured yet." }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: `${origin}/billing?checkout=subscription_success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?checkout=cancelled`,
        client_reference_id: user.id,
        customer_email: user.email || undefined,
        automatic_tax: {
          enabled: automaticTaxEnabled
        },
        line_items: [
          {
            quantity: 1,
            price: stripePriceId
          }
        ],
        metadata: {
          userId: user.id,
          checkoutType: "subscription",
          planId: subscription.plan.id,
          cycle: subscription.cycle,
          credits: String(subscription.price.credits)
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            planId: subscription.plan.id,
            cycle: subscription.cycle,
            credits: String(subscription.price.credits)
          }
        }
      });

      return NextResponse.json({ url: session.url });
    }

    const pack = body?.packId ? getCreditPack(body.packId) : null;
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      automatic_tax: {
        enabled: automaticTaxEnabled
      },
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

    const admin = createSupabaseAdminClient();
    if (admin && session.id) {
      await admin
        .from("credit_purchases")
        .upsert(
          {
            user_id: user.id,
            stripe_checkout_id: session.id,
            pack_id: pack.id,
            credits: pack.credits,
            amount_cents: pack.amountCents,
            currency: "usd",
            status: "pending",
            updated_at: new Date().toISOString()
          },
          { onConflict: "stripe_checkout_id" }
        )
        .throwOnError();
    }

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
