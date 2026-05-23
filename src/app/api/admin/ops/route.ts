import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { addCredits, refundCredits, spendCredits } from "../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

const RECENT_LIMIT = 80;
const DEFAULT_TASK_TIMEOUT_MINUTES = 45;
const DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES = 10;

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
  action?: "credit_adjustment" | "repair_generation_safety";
  userId?: string;
  amount?: number;
  note?: string;
};

type OpsFinding = {
  kind: "failed_without_refund" | "orphan_without_tracking" | "task_timeout" | "completed_without_output";
  severity: "critical" | "warning";
  label: string;
  count: number;
  description: string;
  taskIds: string[];
};

function taskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_TASK_TIMEOUT_MINUTES || DEFAULT_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TASK_TIMEOUT_MINUTES;
}

function orphanTaskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_ORPHAN_TIMEOUT_MINUTES || DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES;
}

function isOlderThan(value: string, minutes: number) {
  return Date.now() - new Date(value).getTime() > minutes * 60 * 1000;
}

function ledgerByReference(ledger: LedgerRow[]) {
  const map = new Map<string, LedgerRow[]>();
  for (const entry of ledger) {
    if (!entry.reference_id) continue;
    const entries = map.get(entry.reference_id) || [];
    entries.push(entry);
    map.set(entry.reference_id, entries);
  }
  return map;
}

function hasLedger(entries: LedgerRow[] | undefined, reason: string) {
  return Boolean(entries?.some((entry) => entry.reason === reason));
}

function buildOpsFindings(tasks: TaskRow[], ledger: LedgerRow[]): OpsFinding[] {
  const byRef = ledgerByReference(ledger);
  const failedWithoutRefund = tasks.filter((task) => {
    const entries = byRef.get(task.id);
    return task.status === "failed" && hasLedger(entries, "generation_task") && !hasLedger(entries, "generation_refund");
  });
  const orphanWithoutTracking = tasks.filter(
    (task) =>
      task.transport === "real" &&
      (task.status === "queued" || task.status === "running") &&
      !task.provider_request_id &&
      isOlderThan(task.created_at, orphanTaskTimeoutMinutes())
  );
  const timedOutTasks = tasks.filter(
    (task) =>
      task.transport === "real" &&
      (task.status === "queued" || task.status === "running") &&
      Boolean(task.provider_request_id) &&
      isOlderThan(task.created_at, taskTimeoutMinutes())
  );
  const completedWithoutOutput = tasks.filter((task) => task.status === "completed" && !task.output_url);

  return [
    {
      kind: "failed_without_refund",
      severity: "critical",
      label: "Failed tasks without refund",
      count: failedWithoutRefund.length,
      description: "These tasks failed after a generation charge but do not show a refund ledger entry yet.",
      taskIds: failedWithoutRefund.map((task) => task.id)
    },
    {
      kind: "orphan_without_tracking",
      severity: "critical",
      label: "Charged tasks missing provider tracking",
      count: orphanWithoutTracking.length,
      description: `Real provider tasks older than ${orphanTaskTimeoutMinutes()} minutes without a provider request id or status URL should be failed and refunded.`,
      taskIds: orphanWithoutTracking.map((task) => task.id)
    },
    {
      kind: "task_timeout",
      severity: "critical",
      label: "Provider tasks past timeout",
      count: timedOutTasks.length,
      description: `Queued or running provider tasks older than ${taskTimeoutMinutes()} minutes should be failed and refunded.`,
      taskIds: timedOutTasks.map((task) => task.id)
    },
    {
      kind: "completed_without_output",
      severity: "warning",
      label: "Completed tasks without output URL",
      count: completedWithoutOutput.length,
      description: "Completed tasks without a stored output URL may need a provider result refresh or support review.",
      taskIds: completedWithoutOutput.map((task) => task.id)
    }
  ];
}

async function repairGenerationSafety(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId?: string) {
  let query = admin
    .from("generation_tasks")
    .select(
      "id,user_id,mode,provider,prompt,status,estimated_credits,transport,provider_request_id,output_url,failure_code,failure_reason,created_at,updated_at"
    )
    .is("deleted_at", null)
    .in("status", ["queued", "running", "failed"])
    .order("created_at", { ascending: false })
    .limit(300);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: taskData, error: taskError } = await query;
  if (taskError) throw taskError;

  const tasks = (taskData || []) as TaskRow[];
  const taskIds = tasks.map((task) => task.id);
  const ledger =
    taskIds.length > 0
      ? ((await admin
          .from("credit_ledger")
          .select("id,user_id,amount,reason,reference_id,created_at")
          .in("reference_id", taskIds)
          .in("reason", ["generation_task", "generation_refund"])).data || []) as LedgerRow[]
      : [];
  const byRef = ledgerByReference(ledger);
  const now = new Date().toISOString();
  let failedRefunded = 0;
  let orphanRefunded = 0;
  let timedOutRefunded = 0;

  for (const task of tasks) {
    const entries = byRef.get(task.id);
    const hasCharge = hasLedger(entries, "generation_task");
    const hasRefund = hasLedger(entries, "generation_refund");

    if (task.status === "failed" && hasCharge && !hasRefund) {
      await refundCredits(admin, task.user_id, task.estimated_credits, "generation_refund", task.id);
      failedRefunded += 1;
      continue;
    }

    if (
      task.transport === "real" &&
      (task.status === "queued" || task.status === "running") &&
      !task.provider_request_id &&
      isOlderThan(task.created_at, orphanTaskTimeoutMinutes())
    ) {
      await refundCredits(admin, task.user_id, task.estimated_credits, "generation_refund", task.id);
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: "provider_tracking_missing",
          failure_reason: `Admin repair: task was charged but never received provider tracking within ${orphanTaskTimeoutMinutes()} minutes. Credits were refunded.`,
          last_checked_at: now,
          timed_out_at: now,
          updated_at: now
        })
        .eq("id", task.id)
        .eq("user_id", task.user_id);
      orphanRefunded += 1;
      continue;
    }

    if (
      task.transport === "real" &&
      (task.status === "queued" || task.status === "running") &&
      Boolean(task.provider_request_id) &&
      isOlderThan(task.created_at, taskTimeoutMinutes())
    ) {
      await refundCredits(admin, task.user_id, task.estimated_credits, "generation_refund", task.id);
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: "task_timeout",
          failure_reason: `Admin repair: provider task exceeded ${taskTimeoutMinutes()} minutes. Credits were refunded.`,
          last_checked_at: now,
          timed_out_at: now,
          updated_at: now
        })
        .eq("id", task.id)
        .eq("user_id", task.user_id);
      timedOutRefunded += 1;
    }
  }

  return {
    failedRefunded,
    orphanRefunded,
    timedOutRefunded,
    totalRepaired: failedRefunded + orphanRefunded + timedOutRefunded
  };
}

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
    findings: buildOpsFindings(tasks, ledger),
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
  const action = body?.action || "credit_adjustment";
  const userId = body?.userId?.trim();

  if (action === "repair_generation_safety") {
    const repair = await repairGenerationSafety(admin, userId);
    return NextResponse.json({ ok: true, repair, adminEmail: adminUser.email });
  }

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
