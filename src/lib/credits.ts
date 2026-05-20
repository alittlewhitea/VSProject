import type { SupabaseClient } from "@supabase/supabase-js";

export const SIGNUP_BONUS_CREDITS = 120;

type CreditAccount = { user_id: string; balance: number; free_granted: boolean };
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

export async function ensureCreditAccount(admin: SupabaseClient, userId: string) {
  try {
    const { data: existing, error: selectError } = await admin
      .from("user_credit_accounts")
      .select("user_id, balance, free_granted")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existing) {
      return existing as CreditAccount;
    }

    const { data, error } = await admin
      .from("user_credit_accounts")
      .upsert(
        {
          user_id: userId,
          balance: SIGNUP_BONUS_CREDITS,
          free_granted: true
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

    await admin.from("credit_ledger").insert({
      user_id: userId,
      amount: SIGNUP_BONUS_CREDITS,
      reason: "signup_bonus"
    });

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
