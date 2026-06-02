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

type SubscriptionRow = {
  id: number | string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  plan_id: string;
  cycle: string;
  credits_per_cycle: number;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  mode: "image" | "video" | "audio";
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

type AnalyticsRow = {
  event_name: string;
  user_id: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

type UserCountryInfo = {
  countryCode: string | null;
  countryName: string | null;
  eventCount: number;
};

type CountrySummaryRow = {
  countryCode: string;
  countryName: string;
  users: number;
  events: number;
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

type SystemHealthCheck = {
  key: string;
  label: string;
  status: "ok" | "warning" | "critical";
  detail: string;
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

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function requiredEnvCheck(name: string, label = name): SystemHealthCheck {
  const present = envPresent(name);
  return {
    key: `env_${name}`,
    label,
    status: present ? "ok" : "critical",
    detail: present ? "Configured" : `${name} is missing`
  };
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

function buildSystemHealth(tasks: TaskRow[], ledger: LedgerRow[], purchases: PurchaseRow[]) {
  const findings = buildOpsFindings(tasks, ledger);
  const criticalFindings = findings
    .filter((finding) => finding.severity === "critical")
    .reduce((sum, finding) => sum + finding.count, 0);
  const recentTasks = tasks.filter((task) => isOlderThan(task.created_at, 24 * 60) === false);
  const recentFailed = recentTasks.filter((task) => task.status === "failed").length;
  const recentCompleted = recentTasks.filter((task) => task.status === "completed").length;
  const recentFailureRate = recentTasks.length ? recentFailed / recentTasks.length : 0;
  const pendingPurchases = purchases.filter((purchase) => purchase.status === "pending").length;

  const checks: SystemHealthCheck[] = [
    requiredEnvCheck("NEXT_PUBLIC_SUPABASE_URL", "Supabase URL"),
    requiredEnvCheck("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key"),
    requiredEnvCheck("SUPABASE_SERVICE_ROLE_KEY", "Supabase service role"),
    requiredEnvCheck("ADMIN_EMAILS", "Admin allowlist"),
    requiredEnvCheck("FAL_KEY", "fal.ai API key"),
    {
      key: "stripe_secret_key",
      label: "Stripe secret key",
      status: envPresent("STRIPE_SECRET_KEY") ? "ok" : "warning",
      detail: envPresent("STRIPE_SECRET_KEY") ? "Configured" : "Missing; checkout cannot create paid sessions"
    },
    {
      key: "stripe_webhook_secret",
      label: "Stripe webhook secret",
      status: envPresent("STRIPE_WEBHOOK_SECRET") ? "ok" : "critical",
      detail: envPresent("STRIPE_WEBHOOK_SECRET") ? "Configured" : "Missing; paid credits cannot be granted safely"
    },
    {
      key: "app_url",
      label: "Public app URL",
      status: envPresent("NEXT_PUBLIC_APP_URL") ? "ok" : "warning",
      detail: envPresent("NEXT_PUBLIC_APP_URL") ? "Configured" : "Missing; checkout callback will fall back to request origin"
    },
    {
      key: "generation_safety",
      label: "Generation safety findings",
      status: criticalFindings ? "critical" : "ok",
      detail: criticalFindings ? `${criticalFindings} critical generation records need repair` : "No critical generation records detected"
    },
    {
      key: "recent_failure_rate",
      label: "Recent failure rate",
      status: recentFailureRate > 0.35 ? "critical" : recentFailureRate > 0.18 ? "warning" : "ok",
      detail: `${recentFailed}/${recentTasks.length} recent tasks failed (${Math.round(recentFailureRate * 100)}%)`
    },
    {
      key: "recent_completion_volume",
      label: "Recent completions",
      status: recentTasks.length > 0 && recentCompleted === 0 && recentFailed > 0 ? "warning" : "ok",
      detail: `${recentCompleted} completed tasks in the recent sample`
    },
    {
      key: "pending_stripe_purchases",
      label: "Pending Stripe purchases",
      status: pendingPurchases > 5 ? "warning" : "ok",
      detail: `${pendingPurchases} pending purchase records in recent sample`
    }
  ];

  return {
    ok: checks.every((check) => check.status === "ok"),
    critical: checks.filter((check) => check.status === "critical").length,
    warnings: checks.filter((check) => check.status === "warning").length,
    checks
  };
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

function normalizeCountryCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function eventCountryCode(event: AnalyticsRow) {
  return (
    normalizeCountryCode(event.properties?.countryCode) ||
    normalizeCountryCode(event.properties?.country) ||
    normalizeCountryCode(event.properties?.country_code)
  );
}

function buildUserCountryMap(events: AnalyticsRow[]) {
  const byUser = new Map<string, UserCountryInfo>();

  for (const event of events) {
    if (!event.user_id) continue;
    const code = eventCountryCode(event);
    if (!code) continue;

    const existing = byUser.get(event.user_id);
    byUser.set(event.user_id, {
      countryCode: existing?.countryCode || code,
      countryName: existing?.countryName || countryName(code),
      eventCount: (existing?.eventCount || 0) + 1
    });
  }

  return byUser;
}

function buildCountrySummary(events: AnalyticsRow[]): CountrySummaryRow[] {
  const byCountry = new Map<string, { events: number; users: Set<string> }>();

  for (const event of events) {
    const code = eventCountryCode(event);
    if (!code) continue;
    const current = byCountry.get(code) || { events: 0, users: new Set<string>() };
    current.events += 1;
    if (event.user_id) current.users.add(event.user_id);
    byCountry.set(code, current);
  }

  return [...byCountry.entries()]
    .map(([countryCode, value]) => ({
      countryCode,
      countryName: countryName(countryCode),
      users: value.users.size,
      events: value.events
    }))
    .sort((a, b) => b.users - a.users || b.events - a.events)
    .slice(0, 12);
}

function summarize(accounts: CreditAccountRow[], ledger: LedgerRow[], purchases: PurchaseRow[], tasks: TaskRow[], subscriptions: SubscriptionRow[] = []) {
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
    runningTasks: tasks.filter((task) => task.status === "queued" || task.status === "running").length,
    activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length,
    pastDueSubscriptions: subscriptions.filter((subscription) => subscription.status === "past_due").length
  };
}

function countUnique(events: AnalyticsRow[], key: "session_id" | "anonymous_id" | "user_id") {
  return new Set(events.map((event) => event[key]).filter(Boolean)).size;
}

function buildFunnel(events: AnalyticsRow[]) {
  const steps = [
    { event: "home_view", label: "Home viewed" },
    { event: "studio_view", label: "Studio viewed" },
    { event: "generate_clicked", label: "Generate clicked" },
    { event: "generate_login_required", label: "Login required" },
    { event: "login_success", label: "Login success" },
    { event: "generation_queued", label: "Generation queued" },
    { event: "generation_completed", label: "Generation completed" },
    { event: "checkout_started", label: "Checkout started" },
    { event: "checkout_success", label: "Checkout success" }
  ];

  const eventCounts = new Map<string, AnalyticsRow[]>();
  for (const event of events) {
    eventCounts.set(event.event_name, [...(eventCounts.get(event.event_name) || []), event]);
  }

  return steps.map((step, index) => {
    const rows = eventCounts.get(step.event) || [];
    const previousRows = index > 0 ? eventCounts.get(steps[index - 1].event) || [] : [];
    const count = rows.length;
    const previous = index > 0 ? previousRows.length : count;
    return {
      event: step.event,
      label: step.label,
      count,
      uniqueSessions: countUnique(rows, "session_id"),
      uniqueUsers: countUnique(rows, "user_id"),
      conversionFromPrevious: previous ? Math.round((count / previous) * 100) : null
    };
  });
}

function buildAnalyticsSummary(events: AnalyticsRow[]) {
  const today = startOfTodayIso();
  const todayEvents = events.filter((event) => event.created_at >= today);
  const byEvent = new Map<string, number>();
  const byModel = new Map<string, number>();
  const byMode = new Map<string, number>();
  const byCountry = new Map<string, number>();

  for (const event of events) {
    byEvent.set(event.event_name, (byEvent.get(event.event_name) || 0) + 1);
    const provider = typeof event.properties?.provider === "string" ? event.properties.provider : null;
    const mode = typeof event.properties?.mode === "string" ? event.properties.mode : null;
    const country = eventCountryCode(event);
    if (provider) byModel.set(provider, (byModel.get(provider) || 0) + 1);
    if (mode) byMode.set(mode, (byMode.get(mode) || 0) + 1);
    if (country) {
      const label = countryName(country);
      byCountry.set(label, (byCountry.get(label) || 0) + 1);
    }
  }

  return {
    totalEvents: events.length,
    todayEvents: todayEvents.length,
    uniqueSessions: countUnique(events, "session_id"),
    uniqueUsers: countUnique(events, "user_id"),
    byEvent: Object.fromEntries([...byEvent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)),
    byModel: Object.fromEntries([...byModel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)),
    byMode: Object.fromEntries([...byMode.entries()].sort((a, b) => b[1] - a[1])),
    byCountry: Object.fromEntries([...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
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

  let accountsQuery = admin
    .from("user_credit_accounts")
    .select("user_id,balance,free_granted,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(userId ? 1 : 100);
  let ledgerQuery = admin
    .from("credit_ledger")
    .select("id,user_id,amount,reason,reference_id,created_at")
    .order("created_at", { ascending: false })
    .limit(userId ? 300 : RECENT_LIMIT);
  let purchasesQuery = admin
    .from("credit_purchases")
    .select("id,user_id,stripe_checkout_id,pack_id,credits,amount_cents,currency,status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(userId ? 300 : RECENT_LIMIT);
  let subscriptionsQuery = admin
    .from("user_subscriptions")
    .select(
      "id,user_id,stripe_customer_id,stripe_subscription_id,plan_id,cycle,credits_per_cycle,status,cancel_at_period_end,current_period_start,current_period_end,canceled_at,created_at,updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(userId ? 50 : RECENT_LIMIT);
  let tasksQuery = admin
    .from("generation_tasks")
    .select(
      "id,user_id,mode,provider,prompt,status,estimated_credits,transport,provider_request_id,output_url,failure_code,failure_reason,created_at,updated_at"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(userId ? 300 : RECENT_LIMIT);
  let analyticsQuery = admin
    .from("analytics_events")
    .select("event_name,user_id,anonymous_id,session_id,properties,created_at")
    .gte("created_at", daysAgoIso(7))
    .order("created_at", { ascending: false })
    .limit(600);

  if (userId) {
    accountsQuery = accountsQuery.eq("user_id", userId);
    ledgerQuery = ledgerQuery.eq("user_id", userId);
    purchasesQuery = purchasesQuery.eq("user_id", userId);
    subscriptionsQuery = subscriptionsQuery.eq("user_id", userId);
    tasksQuery = tasksQuery.eq("user_id", userId);
    analyticsQuery = analyticsQuery.eq("user_id", userId);
  }

  const [authUsersResult, accountsResult, ledgerResult, purchasesResult, subscriptionsResult, tasksResult, analyticsResult] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
    accountsQuery,
    ledgerQuery,
    purchasesQuery,
    subscriptionsQuery,
    tasksQuery,
    analyticsQuery
  ]);

  if (authUsersResult.error) return NextResponse.json({ error: authUsersResult.error.message }, { status: 500 });
  if (accountsResult.error) return NextResponse.json({ error: accountsResult.error.message }, { status: 500 });
  if (ledgerResult.error) return NextResponse.json({ error: ledgerResult.error.message }, { status: 500 });
  if (purchasesResult.error) return NextResponse.json({ error: purchasesResult.error.message }, { status: 500 });
  if (subscriptionsResult.error) return NextResponse.json({ error: subscriptionsResult.error.message }, { status: 500 });
  if (tasksResult.error) return NextResponse.json({ error: tasksResult.error.message }, { status: 500 });

  const authUsers = (authUsersResult.data.users || []).map(formatAuthUser);
  const accounts = (accountsResult.data || []) as CreditAccountRow[];
  const ledger = (ledgerResult.data || []) as LedgerRow[];
  const purchases = (purchasesResult.data || []) as PurchaseRow[];
  const subscriptions = (subscriptionsResult.data || []) as SubscriptionRow[];
  const tasks = (tasksResult.data || []) as TaskRow[];
  const analytics = (analyticsResult.error ? [] : analyticsResult.data || []) as AnalyticsRow[];
  const accountByUserId = new Map(accounts.map((account) => [account.user_id, account]));
  const countryByUserId = buildUserCountryMap(analytics);

  const users = authUsers.map((user) => {
    const account = accountByUserId.get(user.id);
    const country = countryByUserId.get(user.id);
    return {
      ...user,
      balance: account?.balance ?? 0,
      freeGranted: account?.free_granted ?? false,
      creditAccountUpdatedAt: account?.updated_at ?? null,
      countryCode: country?.countryCode ?? null,
      countryName: country?.countryName ?? null,
      countryEventCount: country?.eventCount ?? 0
    };
  });

  return NextResponse.json({
    adminEmail: adminUser.email,
    summary: summarize(accounts, ledger, purchases, tasks, subscriptions),
    analytics: {
      summary: buildAnalyticsSummary(analytics),
      funnel: buildFunnel(analytics),
      countries: buildCountrySummary(analytics),
      recentEvents: userId ? analytics.filter((event) => event.user_id === userId).slice(0, 80) : analytics.slice(0, 80),
      storageWarning: analyticsResult.error ? analyticsResult.error.message : null
    },
    health: buildSystemHealth(tasks, ledger, purchases),
    findings: buildOpsFindings(tasks, ledger),
    users: userId ? users.filter((user) => user.id === userId) : users,
    accounts: userId ? accounts.filter((account) => account.user_id === userId) : accounts,
    ledger: userId ? ledger.filter((entry) => entry.user_id === userId) : ledger,
    purchases: userId ? purchases.filter((purchase) => purchase.user_id === userId) : purchases,
    subscriptions: userId ? subscriptions.filter((subscription) => subscription.user_id === userId) : subscriptions,
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
