import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { addCredits, spendCredits } from "../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

const RECENT_LIMIT = 80;

type CreditAccountRow = {
  user_id: string;
  balance: number;
  free_granted: boolean;
  created_at: string;
  updated_at: string;
};

type LedgerRow = {
  id: number | string;
  user_id: string;
  amount: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

type PurchaseRow = {
  id: number | string;
  user_id: string;
  stripe_checkout_id: string;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: "pending" | "completed" | "cancelled" | "failed";
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  mode: "image" | "video";
  provider: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  provider_request_id: string | null;
  output_url: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

type AdjustmentPayload = {
  userId?: string;
  amount?: number;
  note?: string;
};

function formatAuthUser(user: { id: string; email?: string; created_at?: string; last_sign_in_at?: string }) {
  return {
    id: user.id,
    email: user.email || null,
    createdAt: user.created_at || null,
    lastSignInAt: user.last_sign_in_at || null
  };
}

function summarize(accounts: CreditAccountRow[], ledger: LedgerRow[], purchases: PurchaseRow[], tasks: TaskRow[]) {
  return {
    usersWithCreditAccounts: accounts.length,
    totalOutstandingCredits: accounts.reduce((sum, account) => sum + account.balance, 0),
    completedPurchaseRevenueCents: purchases
      .filter((purchase) => purchase.status === "completed")
      .reduce((sum, purchase) => sum + purchase.amount_cents, 0),
    creditsPurchased: purchases
      .filter((purchase) => purchase.status === "completed")
      .reduce((sum, purchase) => sum + purchase.credits, 0),
    creditsSpent: Math.abs(
      ledger
        .filter((entry) => entry.amount < 0)
        .reduce((sum, entry) => sum + entry.amount, 0)
    ),
    creditsRefunded: ledger
      .filter((entry) => entry.reason === "generation_refund")
      .reduce((sum, entry) => sum + entry.amount, 0),
    tasks: tasks.length,
    failedTasks: tasks.filter((task) => task.status === "failed").length,
    runningTasks: tasks.filter((task) => task.status === "queued" || task.status === "running").length
  };
}

export async function GET(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();

  const [authUsersResult, accountsResult, ledgerResult, purchasesResult, tasksResult] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
    admin
      .from("user_credit_accounts")
      .select("user_id,balance,free_granted,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("credit_ledger")
      .select("id,user_id,amount,reason,reference_id,created_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    admin
      .from("credit_purchases")
      .select("id,user_id,stripe_checkout_id,pack_id,credits,amount_cents,currency,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    admin
      .from("generation_tasks")
      .select(
        "id,user_id,mode,provider,prompt,status,estimated_credits,transport,provider_request_id,output_url,failure_code,failure_reason,created_at,updated_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT)
  ]);

  if (authUsersResult.error) return NextResponse.json({ error: authUsersResult.error.message }, { status: 500 });
  if (accountsResult.error) return NextResponse.json({ error: accountsResult.error.message }, { status: 500 });
  if (ledgerResult.error) return NextResponse.json({ error: ledgerResult.error.message }, { status: 500 });
  if (purchasesResult.error) return NextResponse.json({ error: purchasesResult.error.message }, { status: 500 });
  if (tasksResult.error) return NextResponse.json({ error: tasksResult.error.message }, { status: 500 });

  const authUsers = (authUsersResult.data.users || []).map(formatAuthUser);
  const accounts = (accountsResult.data || []) as CreditAccountRow[];
  const ledger = (ledgerResult.data || []) as LedgerRow[];
  const purchases = (purchasesResult.data || []) as PurchaseRow[];
  const tasks = (tasksResult.data || []) as TaskRow[];
  const accountByUserId = new Map(accounts.map((account) => [account.user_id, account]));

  const users = authUsers.map((user) => {
    const account = accountByUserId.get(user.id);
    return {
      ...user,
      balance: account?.balance ?? 0,
      freeGranted: account?.free_granted ?? false,
      creditAccountUpdatedAt: account?.updated_at ?? null
    };
  });

  return NextResponse.json({
    adminEmail: adminUser.email,
    summary: summarize(accounts, ledger, purchases, tasks),
    users: userId ? users.filter((user) => user.id === userId) : users,
    accounts: userId ? accounts.filter((account) => account.user_id === userId) : accounts,
    ledger: userId ? ledger.filter((entry) => entry.user_id === userId) : ledger,
    purchases: userId ? purchases.filter((purchase) => purchase.user_id === userId) : purchases,
    tasks: userId ? tasks.filter((task) => task.user_id === userId) : tasks,
    failedTasks: (userId ? tasks.filter((task) => task.user_id === userId) : tasks).filter((task) => task.status === "failed")
  });
}

export async function POST(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as AdjustmentPayload | null;
  const userId = body?.userId?.trim();
  const amount = Number(body?.amount);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 160) : "";

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "Amount must be a non-zero integer." }, { status: 400 });
  }

  const referenceId = `admin_${Date.now()}_${randomUUID()}`;
  const reason = note ? `admin_adjustment:${note}` : "admin_adjustment";

  if (amount > 0) {
    const balance = await addCredits(admin, userId, amount, reason, referenceId);
    return NextResponse.json({ ok: true, userId, amount, balance, referenceId, adminEmail: adminUser.email });
  }

  const spendResult = await spendCredits(admin, userId, Math.abs(amount), reason, referenceId);
  if (!spendResult.ok) {
    return NextResponse.json(
      { error: `Insufficient credits. Current balance is ${spendResult.balance}.`, balance: spendResult.balance },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    userId,
    amount,
    balance: spendResult.balance,
    referenceId,
    adminEmail: adminUser.email
  });
}
