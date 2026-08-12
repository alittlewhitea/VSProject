import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStripe } from "../../../../lib/stripe";
import { getManageableUserSubscription } from "../../../../lib/subscriptions";
import { trustedPublicOrigin } from "../../../../lib/request-security";

type StripeErrorShape = {
  name?: unknown;
  code?: unknown;
  param?: unknown;
  message?: unknown;
  raw?: {
    code?: unknown;
    param?: unknown;
  };
};

function stripeErrorValue(error: unknown, key: "code" | "param") {
  if (!error || typeof error !== "object") return undefined;
  const stripeError = error as StripeErrorShape;
  const value = stripeError[key] ?? stripeError.raw?.[key];
  return typeof value === "string" ? value : undefined;
}

function isMissingStripeCustomer(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const stripeError = error as StripeErrorShape;
  const code = stripeErrorValue(error, "code");
  const param = stripeErrorValue(error, "param");
  const message = typeof stripeError.message === "string" ? stripeError.message : "";
  return (
    (code === "resource_missing" && (param === "customer" || param === "id")) ||
    message.startsWith("No such customer:")
  );
}

function logPortalError(error: unknown) {
  const stripeError = error && typeof error === "object" ? (error as StripeErrorShape) : undefined;
  console.error("Unable to create billing portal session.", {
    name: typeof stripeError?.name === "string" ? stripeError.name : "UnknownError",
    code: stripeErrorValue(error, "code") ?? "unknown",
    param: stripeErrorValue(error, "param") ?? "unknown"
  });
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    }

    const subscription = await getManageableUserSubscription(admin, user.id);
    if (subscription?.payment_provider === "paypal" && subscription.provider_subscription_id) {
      return NextResponse.json({ provider: "paypal", canCancel: true });
    }
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No manageable subscription found for this account." }, { status: 400 });
    }

    const origin = trustedPublicOrigin(request.url);
    let session;
    try {
      session = await getStripe().billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${origin}/billing`
      });
    } catch (error) {
      if (isMissingStripeCustomer(error)) {
        return NextResponse.json(
          {
            error: "This legacy Stripe billing profile is unavailable. Contact support to migrate or cancel the subscription.",
            code: "legacy_stripe_customer_unavailable"
          },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ url: session.url, provider: "stripe" });
  } catch (error) {
    logPortalError(error);
    return NextResponse.json({ error: "Unable to open billing portal." }, { status: 500 });
  }
}
