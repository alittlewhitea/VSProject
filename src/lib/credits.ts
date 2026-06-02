import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SIGNUP_BONUS_CREDITS = 100;
export const LIMITED_REGION_SIGNUP_BONUS_CREDITS = 10;
const LIMITED_SIGNUP_BONUS_COUNTRIES = new Set(["IN", "ID", "NG", "PK", "BD", "ET", "NP"]);

type CreditAccount = { user_id: string; balance: number; free_granted: boolean };
type EnsureCreditAccountOptions = {
  signupBonusCredits?: number;
  signupBonusReferenceId?: string | null;
};
type CreditApplyResult = {
  balance: number;
  ledger_id: number | string | null;
  duplicate: boolean;
  applied: boolean;
};
export type CreditLedgerEntry = {
  id: number | string;
  amount: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

const devCreditAccounts = new Map<string, CreditAccount>();
const devCreditLedger = new Map<string, CreditLedgerEntry[]>();

function canUseDevCreditFallback() {
  return process.env.NODE_ENV !== "production";
}

export function getDevCreditAccount(userId: string) {
  const existing = devCreditAccounts.get(userId);
  if (existing) return existing;

  const account = {
    user_id: userId,
    balance: SIGNUP_BONUS_CREDITS,
    free_granted: true
  };
  devCreditAccounts.set(userId, account);
  return account;
}

export function addDevCredits(userId: string, amount: number) {
  const account = getDevCreditAccount(userId);
  const next = { ...account, balance: account.balance + amount };
  devCreditAccounts.set(userId, next);
  addDevLedgerEntry(userId, amount, "manual_top_up_dev");
  return next.balance;
}

function addDevLedgerEntry(userId: string, amount: number, reason: string, referenceId?: string) {
  const entries = devCreditLedger.get(userId) || [];
  if (referenceId && entries.some((entry) => entry.reason === reason && entry.reference_id === referenceId)) {
    return;
  }
  entries.unshift({
    id: `dev_${Date.now()}_${entries.length}`,
    amount,
    reason,
    reference_id: referenceId || null,
    created_at: new Date().toISOString()
  });
  devCreditLedger.set(userId, entries.slice(0, 50));
}

export function getDevCreditLedger(userId: string) {
  return devCreditLedger.get(userId) || [];
}

export function getRequestIp(headers: Headers) {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("forwarded")?.match(/for="?([^;,"]+)/i)?.[1]
  ];
  return candidates.map((value) => value?.trim()).find(Boolean) || null;
}

function cleanCountryCode(value: string | null) {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

export function getRequestCountryCode(headers: Headers) {
  return (
    cleanCountryCode(headers.get("cf-ipcountry")) ||
    cleanCountryCode(headers.get("x-vercel-ip-country")) ||
    cleanCountryCode(headers.get("x-country-code")) ||
    cleanCountryCode(headers.get("cloudfront-viewer-country"))
  );
}

export function signupBonusCreditsForCountry(countryCode: string | null) {
  return countryCode && LIMITED_SIGNUP_BONUS_COUNTRIES.has(countryCode)
    ? LIMITED_REGION_SIGNUP_BONUS_CREDITS
    : SIGNUP_BONUS_CREDITS;
}

function signupIpSecret() {
  return process.env.SIGNUP_IP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL || "local-signup-ip-secret";
}

function hashSignupIp(ip: string) {
  return createHmac("sha256", signupIpSecret()).update(ip.trim().toLowerCase()).digest("hex");
}

export async function claimSignupBonusForIp(admin: SupabaseClient, userId: string, ip: string | null) {
  if (!ip) {
    return { allowed: false, ipHash: null, duplicateUserId: null };
  }

  const ipHash = hashSignupIp(ip);
  const { error } = await admin.from("signup_ip_claims").insert({
    ip_hash: ipHash,
    user_id: userId
  });

  if (!error) {
    return { allowed: true, ipHash, duplicateUserId: null };
  }

  if (error.code !== "23505") {
    throw error;
  }

  const { data, error: selectError } = await admin
    .from("signup_ip_claims")
    .select("user_id")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const duplicateUserId = typeof data?.user_id === "string" ? data.user_id : null;
  return {
    allowed: duplicateUserId === userId,
    ipHash,
    duplicateUserId
  };
}

export async function getCreditAccount(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("user_credit_accounts")
    .select("user_id, balance, free_granted")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CreditAccount | null) || null;
}

export async function ensureCreditAccount(admin: SupabaseClient, userId: string, options: EnsureCreditAccountOptions = {}) {
  const signupBonusCredits = Math.max(0, Math.trunc(options.signupBonusCredits || 0));
  try {
    const existing = await getCreditAccount(admin, userId);
    if (existing) {
      return existing;
    }

    const { data, error } = await admin
      .from("user_credit_accounts")
      .upsert(
        {
          user_id: userId,
          balance: signupBonusCredits,
          free_granted: signupBonusCredits > 0
        },
        { onConflict: "user_id", ignoreDuplicates: true }
      )
      .select("user_id, balance, free_granted")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      const { data: selected, error: selectedError } = await admin
        .from("user_credit_accounts")
        .select("user_id, balance, free_granted")
        .eq("user_id", userId)
        .single();

      if (selectedError) {
        throw selectedError;
      }
      return selected as CreditAccount;
    }

    if (signupBonusCredits > 0) {
      await admin.from("credit_ledger").insert({
        user_id: userId,
        amount: signupBonusCredits,
        reason: "signup_bonus",
        reference_id: options.signupBonusReferenceId || null
      });
    }

    return data as CreditAccount;
  } catch (error) {
    if (canUseDevCreditFallback()) {
      return getDevCreditAccount(userId);
    }
    throw error;
  }
}

async function applyCreditLedgerOnce(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
  referenceId: string | null,
  allowNegative = false
) {
  const { data, error } = await admin.rpc("apply_credit_ledger_once", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId,
    p_allow_negative: allowNegative
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.balance !== "number") {
    throw new Error("Credit ledger operation did not return a balance.");
  }

  return result as CreditApplyResult;
}

async function addCreditsLegacy(admin: SupabaseClient, userId: string, amount: number, reason: string, referenceId?: string) {
  const account = await ensureCreditAccount(admin, userId);
  const nextBalance = account.balance + amount;

  if (canUseDevCreditFallback() && devCreditAccounts.has(userId)) {
    devCreditAccounts.set(userId, { ...account, balance: nextBalance });
    addDevLedgerEntry(userId, amount, reason, referenceId);
    return nextBalance;
  }

  const { error } = await admin
    .from("user_credit_accounts")
    .update({
      balance: nextBalance,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  await admin.from("credit_ledger").insert({
    user_id: userId,
    amount,
    reason,
    reference_id: referenceId || null
  });

  return nextBalance;
}

export async function addCredits(admin: SupabaseClient, userId: string, amount: number, reason: string, referenceId?: string) {
  await ensureCreditAccount(admin, userId);

  if (canUseDevCreditFallback() && devCreditAccounts.has(userId)) {
    return addCreditsLegacy(admin, userId, amount, reason, referenceId);
  }

  const result = await applyCreditLedgerOnce(admin, userId, amount, reason, referenceId || null);
  return result.balance;
}

export async function refundCredits(admin: SupabaseClient, userId: string, amount: number, reason: string, referenceId: string) {
  if (canUseDevCreditFallback() && devCreditAccounts.has(userId)) {
    const alreadyRefunded = getDevCreditLedger(userId).some(
      (entry) => entry.reason === reason && entry.reference_id === referenceId
    );
    if (alreadyRefunded) return getDevCreditAccount(userId).balance;
    const account = getDevCreditAccount(userId);
    const balance = account.balance + amount;
    devCreditAccounts.set(userId, { ...account, balance });
    addDevLedgerEntry(userId, amount, reason, referenceId);
    return balance;
  }

  return addCredits(admin, userId, amount, reason, referenceId);
}

export async function listCreditLedger(admin: SupabaseClient, userId: string) {
  if (canUseDevCreditFallback() && devCreditAccounts.has(userId)) {
    return getDevCreditLedger(userId);
  }

  const { data, error } = await admin
    .from("credit_ledger")
    .select("id, amount, reason, reference_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data || []) as CreditLedgerEntry[];
}

export async function spendCredits(admin: SupabaseClient, userId: string, amount: number, reason: string, referenceId?: string) {
  const account = await ensureCreditAccount(admin, userId);

  if (account.balance < amount) {
    return {
      ok: false as const,
      balance: account.balance
    };
  }

  if (canUseDevCreditFallback() && devCreditAccounts.has(userId)) {
    if (referenceId) {
      const existingCharge = getDevCreditLedger(userId).some(
        (entry) => entry.reason === reason && entry.reference_id === referenceId
      );
      if (existingCharge) {
        return {
          ok: true as const,
          balance: account.balance,
          duplicate: true as const
        };
      }
    }
    const nextBalance = account.balance - amount;
    devCreditAccounts.set(userId, { ...account, balance: nextBalance });
    addDevLedgerEntry(userId, -amount, reason, referenceId);
    return {
      ok: true as const,
      balance: nextBalance
    };
  }

  const result = await applyCreditLedgerOnce(admin, userId, -amount, reason, referenceId || null);
  if (!result.applied && !result.duplicate) {
    return {
      ok: false as const,
      balance: result.balance
    };
  }

  return {
    ok: true as const,
    balance: result.balance,
    duplicate: result.duplicate ? (true as const) : undefined
  };
}
