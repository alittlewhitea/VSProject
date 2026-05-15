import type { SupabaseClient } from "@supabase/supabase-js";

export const SIGNUP_BONUS_CREDITS = 120;

type CreditAccount = { user_id: string; balance: number; free_granted: boolean };
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
      .insert({
        user_id: userId,
        balance: SIGNUP_BONUS_CREDITS,
        free_granted: true
      })
      .select("user_id, balance, free_granted")
      .single();

    if (error) {
      throw error;
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

export async function addCredits(admin: SupabaseClient, userId: string, amount: number, reason: string, referenceId?: string) {
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

  const { data: existingRefund, error: refundLookupError } = await admin
    .from("credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", reason)
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (refundLookupError) {
    throw refundLookupError;
  }
  if (existingRefund) {
    const account = await ensureCreditAccount(admin, userId);
    return account.balance;
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

  const nextBalance = account.balance - amount;

  if (canUseDevCreditFallback() && devCreditAccounts.has(userId)) {
    devCreditAccounts.set(userId, { ...account, balance: nextBalance });
    addDevLedgerEntry(userId, -amount, reason, referenceId);
    return {
      ok: true as const,
      balance: nextBalance
    };
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
    amount: -amount,
    reason,
    reference_id: referenceId || null
  });

  return {
    ok: true as const,
    balance: nextBalance
  };
}
