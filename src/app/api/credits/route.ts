import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import {
  addCredits,
  addDevCredits,
  ensureCreditAccount,
  ensureSignupCreditAccount,
  getCreditAccount,
  getDevCreditAccount,
  getDevCreditLedger,
  getRequestCountryCode,
  listCreditLedger,
  signupBonusCreditsForCountry
} from "../../../lib/credits";
import { listUserSubscriptions } from "../../../lib/subscriptions";
import {
  DREAMFACE_IO_DAILY_UNITS,
  getDreamfaceIoDailyUsage,
  isDreamfaceIoConfigured,
  isDreamfaceIoDailyEligible
} from "../../../lib/dreamface-io";
import { isDreamfaceIoEnabled } from "../../../lib/runtime-config";

const CREDIT_TIMEOUT_MS = 4500;

type CreditPurchasesResult = {
  data: unknown[] | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Credit storage timed out.")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    }

    const signupBonusCredits = signupBonusCreditsForCountry(getRequestCountryCode(request.headers));
    const existingAccount = await withTimeout(getCreditAccount(admin, user.id), CREDIT_TIMEOUT_MS);
    const account = existingAccount || await withTimeout(ensureSignupCreditAccount(admin, user.id, request.headers), CREDIT_TIMEOUT_MS);
    const ledger = await withTimeout(listCreditLedger(admin, user.id), CREDIT_TIMEOUT_MS).catch(() => []);
    const { data: purchases } = await withTimeout<CreditPurchasesResult>(
      admin
        .from("credit_purchases")
        .select("id, stripe_checkout_id, pack_id, credits, amount_cents, currency, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25) as unknown as Promise<CreditPurchasesResult>,
      CREDIT_TIMEOUT_MS
    ).catch(() => ({ data: [] }));
    const subscriptions = await withTimeout(listUserSubscriptions(admin, user.id), CREDIT_TIMEOUT_MS).catch(() => []);
    const dreamfaceIoEnabled = (await isDreamfaceIoEnabled(admin)) && isDreamfaceIoConfigured();
    const dreamfaceIoEligible = dreamfaceIoEnabled
      ? await isDreamfaceIoDailyEligible(admin, user.id).catch(() => false)
      : false;
    const dreamfaceIoUsage = dreamfaceIoEligible
      ? await getDreamfaceIoDailyUsage(admin, user.id).catch(() => ({ usedUnits: 0, remainingUnits: 0 }))
      : { usedUnits: 0, remainingUnits: 0 };
    return NextResponse.json({
      balance: account.balance,
      freeGranted: account.free_granted,
      signupBonusAllowed: account.free_granted,
      signupBonusBlockedByIp: !account.free_granted && !existingAccount,
      ledger,
      purchases: purchases || [],
      subscriptions,
      signupBonusCredits,
      dreamfaceIo: {
        enabled: dreamfaceIoEnabled,
        eligible: dreamfaceIoEligible,
        dailyUnits: DREAMFACE_IO_DAILY_UNITS,
        usedUnits: dreamfaceIoUsage.usedUnits,
        remainingUnits: dreamfaceIoUsage.remainingUnits
      }
    });
  } catch (error) {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (user && process.env.NODE_ENV !== "production") {
      const account = getDevCreditAccount(user.id);
      return NextResponse.json({
        balance: account.balance,
        freeGranted: account.free_granted,
        ledger: getDevCreditLedger(user.id),
        signupBonusCredits: signupBonusCreditsForCountry(getRequestCountryCode(request.headers)),
        storageWarning: "Using local development credits because cloud credit storage is unavailable."
      });
    }

    return NextResponse.json(
      {
        balance: null,
        storageWarning: error instanceof Error ? error.message : "Unable to load credit balance.",
        signupBonusCredits: signupBonusCreditsForCountry(getRequestCountryCode(request.headers))
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_CREDIT_TOPUP !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let userId: string | null = null;
  let amount = 0;

  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }
    userId = user.id;

    const body = (await request.json().catch(() => null)) as { amount?: number } | null;
    amount = Number(body?.amount || 0);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    }

    const balance = await withTimeout(addCredits(admin, user.id, amount, "manual_top_up_dev"), CREDIT_TIMEOUT_MS);
    return NextResponse.json({ balance });
  } catch (error) {
    if (userId && Number.isInteger(amount) && amount > 0 && amount <= 100000) {
      return NextResponse.json({
        balance: addDevCredits(userId, amount),
        storageWarning: "Using local development credits because cloud credit storage is unavailable."
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to add credits."
      },
      { status: 500 }
    );
  }
}
