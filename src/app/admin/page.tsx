"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";

type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  balance: number;
  freeGranted: boolean;
  creditAccountUpdatedAt: string | null;
  countryCode: string | null;
  countryName: string | null;
  countryEventCount: number;
  creditsSpent: number;
  creditsRefunded: number;
  creditsPurchased: number;
  purchaseRevenueCents: number;
  completedPurchases: number;
  generationTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  lastTaskAt: string | null;
  hasSpentCredits: boolean;
  subscriptionPlan: string | null;
  subscriptionCycle: string | null;
  subscriptionStatus: string | null;
};

type Account = {
  user_id: string;
  balance: number;
  free_granted: boolean;
  created_at: string;
  updated_at: string;
};

type Ledger = {
  id: number | string;
  user_id: string;
  amount: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

type Purchase = {
  id: number | string;
  user_id: string;
  payment_provider: "stripe" | "paypal";
  provider_order_id: string | null;
  provider_transaction_id: string | null;
  provider_capture_id: string | null;
  stripe_checkout_id: string | null;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Subscription = {
  id: number | string;
  user_id: string;
  payment_provider: "stripe" | "paypal";
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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

type PaymentIncident = {
  id: number | string;
  payment_provider: "paypal";
  event_type: string;
  user_id: string | null;
  purchase_id: number | string | null;
  provider_transaction_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  status: "review_required" | "resolved" | "ignored";
  reason: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  user_id: string;
  mode: "image" | "video" | "audio";
  provider: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  provider_request_id: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

type OpsFinding = {
  kind: "failed_without_refund" | "orphan_without_tracking" | "task_timeout" | "completed_without_output";
  severity: "critical" | "warning";
  label: string;
  count: number;
  description: string;
  taskIds: string[];
};

type SystemHealth = {
  ok: boolean;
  critical: number;
  warnings: number;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "critical";
    detail: string;
  }>;
};

type FunnelStep = {
  event: string;
  label: string;
  count: number;
  uniqueSessions: number;
  uniqueUsers: number;
  conversionFromPrevious: number | null;
};

type CountrySummaryRow = {
  countryCode: string;
  countryName: string;
  users: number;
  events: number;
};

type AnalyticsEvent = {
  event_name: string;
  user_id: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

type OpsPayload = {
  adminEmail?: string;
  summary?: Record<string, number>;
  analytics?: {
    summary: {
      totalEvents: number;
      todayEvents: number;
      uniqueSessions: number;
      uniqueUsers: number;
      byEvent: Record<string, number>;
      byModel: Record<string, number>;
      byMode: Record<string, number>;
      byCountry: Record<string, number>;
    };
    funnel: FunnelStep[];
    countries: CountrySummaryRow[];
    recentEvents: AnalyticsEvent[];
    storageWarning: string | null;
  };
  health?: SystemHealth;
  findings?: OpsFinding[];
  users?: AdminUser[];
  accounts?: Account[];
  ledger?: Ledger[];
  purchases?: Purchase[];
  subscriptions?: Subscription[];
  paymentIncidents?: PaymentIncident[];
  tasks?: Task[];
  failedTasks?: Task[];
  error?: string;
  runtimeConfig?: {
    dreamfaceIoEnabled: boolean;
    dreamfaceIoConfigured: boolean;
    paymentProvider: "stripe" | "paypal";
    stripeConfigured: boolean;
    paypalConfigured: boolean;
    paypalPlansConfigured: number;
    paypalPlansTotal: number;
    paypalUpgradeCompatible: boolean;
    paypalProductCount: number;
    paypalPlanChecks: Array<{ key: string; env: string; valid: boolean; productId: string | null; error: string | null }>;
  };
};

const USERS_PER_PAGE = 10;

const adminSections = [
  ["overview", "Overview"],
  ["user-detail", "User detail"],
  ["analytics", "Analytics"],
  ["health", "Health"],
  ["generation-safety", "Safety"],
  ["users", "Users"],
  ["countries", "Countries"],
  ["credit-accounts", "Accounts"],
  ["credit-ledger", "Ledger"],
  ["purchases", "Purchases"],
  ["subscriptions", "Subscriptions"],
  ["payment-incidents", "Payment incidents"],
  ["tasks", "Tasks"],
  ["failed-tasks", "Failed"],
  ["events", "Events"]
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatUsd(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "running") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function amountClass(amount: number) {
  return amount >= 0 ? "text-emerald-700" : "text-rose-700";
}

function healthClass(status: "ok" | "warning" | "critical") {
  if (status === "critical") return "border-rose-200 bg-rose-50/70 text-rose-700";
  if (status === "warning") return "border-amber-200 bg-amber-50/70 text-amber-700";
  return "border-emerald-200 bg-emerald-50/70 text-emerald-700";
}

function countryLabel(user: AdminUser) {
  if (!user.countryCode) return "Unknown";
  return `${user.countryName || user.countryCode} (${user.countryCode})`;
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadUsersCsv(users: AdminUser[]) {
  const headers = [
    "email",
    "user_id",
    "registered_at",
    "last_sign_in_at",
    "country_code",
    "country_name",
    "balance",
    "free_granted",
    "has_spent_credits",
    "credits_spent",
    "credits_refunded",
    "credits_purchased",
    "completed_purchases",
    "purchase_revenue_cents",
    "generation_tasks",
    "completed_tasks",
    "failed_tasks",
    "running_tasks",
    "last_task_at",
    "subscription_plan",
    "subscription_cycle",
    "subscription_status"
  ];
  const rows = users.map((user) => [
    user.email,
    user.id,
    user.createdAt,
    user.lastSignInAt,
    user.countryCode,
    user.countryName,
    user.balance,
    user.freeGranted,
    user.hasSpentCredits,
    user.creditsSpent,
    user.creditsRefunded,
    user.creditsPurchased,
    user.completedPurchases,
    user.purchaseRevenueCents,
    user.generationTasks,
    user.completedTasks,
    user.failedTasks,
    user.runningTasks,
    user.lastTaskAt,
    user.subscriptionPlan,
    user.subscriptionCycle,
    user.subscriptionStatus
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dreamface-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value || "unknown", (counts.get(value || "unknown") || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

export default function AdminHomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [payload, setPayload] = useState<OpsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [savingModelSwitch, setSavingModelSwitch] = useState(false);
  const [reconcilingPayPal, setReconcilingPayPal] = useState(false);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<number | string | null>(null);
  const [userPage, setUserPage] = useState(1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || null;
      if (!accessToken) {
        router.replace("/auth?next=/admin");
        return;
      }
      setToken(accessToken);
    });
  }, [router, supabase]);

  async function loadOps(accessToken = token, userId = filterUserId) {
    if (!accessToken) return;
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    if (userId.trim()) params.set("userId", userId.trim());

    try {
      const response = await fetch(`/api/admin/ops?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const nextPayload = (await response.json()) as OpsPayload;
      if (!response.ok) throw new Error(nextPayload.error || "Admin data could not be loaded.");
      setPayload(nextPayload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadOps(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "credit_adjustment",
          userId: adjustUserId,
          amount: Number(adjustAmount),
          note: adjustNote
        })
      });
      const result = (await response.json()) as { error?: string; balance?: number };
      if (!response.ok) throw new Error(result.error || "Credit adjustment failed.");
      setMessage(`Adjustment saved. New balance: ${result.balance ?? "unknown"}.`);
      setAdjustAmount("");
      setAdjustNote("");
      await loadOps(token, filterUserId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Credit adjustment failed.");
    } finally {
      setSaving(false);
    }
  }

  async function repairGenerationSafety() {
    if (!token || repairing) return;
    setRepairing(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "repair_generation_safety",
          userId: filterUserId.trim() || undefined
        })
      });
      const result = (await response.json()) as {
        error?: string;
        repair?: { totalRepaired: number; failedRefunded: number; orphanRefunded: number; timedOutRefunded: number };
      };
      if (!response.ok) throw new Error(result.error || "Generation safety repair failed.");
      setMessage(
        `Repair complete. ${result.repair?.totalRepaired ?? 0} tasks repaired: ${
          result.repair?.failedRefunded ?? 0
        } failed refunds, ${result.repair?.orphanRefunded ?? 0} orphan tasks, ${
          result.repair?.timedOutRefunded ?? 0
        } timed-out tasks.`
      );
      await loadOps(token, filterUserId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation safety repair failed.");
    } finally {
      setRepairing(false);
    }
  }

  async function setDreamfaceIoEnabled(enabled: boolean) {
    if (!token || savingModelSwitch) return;
    setSavingModelSwitch(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "set_dreamface_io_enabled",
          enabled
        })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Model switch could not be updated.");
      setPayload((current) => current?.runtimeConfig
        ? {
            ...current,
            runtimeConfig: {
              ...current.runtimeConfig,
              dreamfaceIoEnabled: enabled
            }
          }
        : current);
      setMessage(`DreamFace IO is now ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Model switch could not be updated.");
    } finally {
      setSavingModelSwitch(false);
    }
  }

  async function reconcilePayPal() {
    if (!token || reconcilingPayPal) return;
    setReconcilingPayPal(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "reconcile_paypal" })
      });
      const result = (await response.json()) as { error?: string; reconciliation?: { purchasesCompleted: number; subscriptionsUpdated: number; errors: unknown[] } };
      if (!response.ok) throw new Error(result.error || "PayPal reconciliation failed.");
      setMessage(`PayPal reconciliation complete: ${result.reconciliation?.purchasesCompleted ?? 0} purchases completed, ${result.reconciliation?.subscriptionsUpdated ?? 0} subscriptions updated, ${result.reconciliation?.errors.length ?? 0} errors.`);
      await loadOps(token, filterUserId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PayPal reconciliation failed.");
    } finally {
      setReconcilingPayPal(false);
    }
  }

  async function resolvePaymentIncident(incidentId: number | string) {
    if (!token || resolvingIncidentId) return;
    const note = window.prompt("Describe what was reviewed and any credit adjustment applied:")?.trim();
    if (!note) return;
    setResolvingIncidentId(incidentId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "resolve_payment_incident", incidentId, note })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Payment incident could not be resolved.");
      setMessage("Payment incident marked resolved.");
      await loadOps(token, filterUserId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment incident could not be resolved.");
    } finally {
      setResolvingIncidentId(null);
    }
  }

  const summary = payload?.summary || {};
  const users = payload?.users || [];
  const accounts = payload?.accounts || [];
  const ledger = payload?.ledger || [];
  const purchases = payload?.purchases || [];
  const subscriptions = payload?.subscriptions || [];
  const paymentIncidents = payload?.paymentIncidents || [];
  const tasks = payload?.tasks || [];
  const failedTasks = payload?.failedTasks || [];
  const findings = payload?.findings || [];
  const health = payload?.health;
  const analytics = payload?.analytics;
  const funnel = analytics?.funnel || [];
  const countries = analytics?.countries || [];
  const analyticsSummary = analytics?.summary;
  const criticalFindingCount = findings.filter((finding) => finding.severity === "critical").reduce((sum, finding) => sum + finding.count, 0);
  const selectedUser = filterUserId.trim() ? users[0] || null : null;
  const selectedSubscription = filterUserId.trim() ? subscriptions[0] || null : null;
  const selectedCompletedPurchases = purchases.filter((purchase) => purchase.status === "completed");
  const userPageCount = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const visibleUsers = users.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

  useEffect(() => {
    setUserPage(1);
  }, [filterUserId, users.length]);

  const selectedUserStats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "completed").length;
    const failed = tasks.filter((task) => task.status === "failed").length;
    const running = tasks.filter((task) => task.status === "queued" || task.status === "running").length;
    const creditsSpent = Math.abs(ledger.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0));
    const creditsRefunded = ledger.filter((entry) => entry.reason === "generation_refund").reduce((sum, entry) => sum + entry.amount, 0);
    const creditsPurchased = selectedCompletedPurchases.reduce((sum, purchase) => sum + purchase.credits, 0);
    const revenueCents = selectedCompletedPurchases.reduce((sum, purchase) => sum + purchase.amount_cents, 0);

    return {
      completed,
      failed,
      running,
      creditsSpent,
      creditsRefunded,
      creditsPurchased,
      revenueCents,
      byMode: countValues(tasks.map((task) => task.mode)),
      byProvider: countValues(tasks.map((task) => task.provider)),
      byStatus: countValues(tasks.map((task) => task.status))
    };
  }, [ledger, selectedCompletedPurchases, tasks]);

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-[#1d1d1f]">
      <div className="mx-auto w-full max-w-[1760px] px-4 py-6 md:px-8">
        <TopNav />

        <section id="overview" className="scroll-mt-6 rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#6e6e73]">DreamFace Admin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Operations Console</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                Users, balances, payments, credit ledger, generation tasks, failures, and manual credit adjustments.
              </p>
              {payload?.adminEmail ? <p className="mt-2 text-xs text-[#86868b]">Signed in as {payload.adminEmail}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/gallery"><AppButton variant="secondary">Gallery</AppButton></Link>
              <Link href="/admin/tasks"><AppButton variant="secondary">Task Detail</AppButton></Link>
              <AppButton onClick={() => loadOps()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</AppButton>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Users", summary.authUsers ?? users.length],
              ["Outstanding credits", summary.totalOutstandingCredits ?? 0],
              ["Revenue", formatUsd(summary.completedPurchaseRevenueCents ?? 0)],
              ["Failed tasks", summary.failedTasks ?? failedTasks.length],
              ["Critical findings", criticalFindingCount],
              ["Credits purchased", summary.creditsPurchased ?? 0],
              ["Credits spent", summary.creditsSpent ?? 0],
              ["Credits refunded", summary.creditsRefunded ?? 0],
              ["Running tasks", summary.runningTasks ?? 0],
              ["Active subs", summary.activeSubscriptions ?? 0],
              ["Past due subs", summary.pastDueSubscriptions ?? 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
              <p className="text-sm font-semibold">Filter by user</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={filterUserId}
                  onChange={(event) => setFilterUserId(event.target.value)}
                  placeholder="User UUID"
                  className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <AppButton variant="secondary" onClick={() => loadOps()} disabled={loading}>Apply</AppButton>
              </div>
            </div>

            <form onSubmit={submitAdjustment} className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
              <p className="text-sm font-semibold">Manual credits adjustment</p>
              <div className="mt-3 grid gap-2 md:grid-cols-[1.4fr_0.6fr_1fr_auto]">
                <input
                  value={adjustUserId}
                  onChange={(event) => setAdjustUserId(event.target.value)}
                  placeholder="User UUID"
                  className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <input
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                  placeholder="+100 / -50"
                  className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <input
                  value={adjustNote}
                  onChange={(event) => setAdjustNote(event.target.value)}
                  placeholder="Reason note"
                  className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <AppButton disabled={saving}>{saving ? "Saving..." : "Save"}</AppButton>
              </div>
            </form>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">DreamFace IO</p>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  Master switch for the text-to-video and image-to-video model.
                  {payload?.runtimeConfig?.dreamfaceIoConfigured ? "" : " API key is not configured."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(payload?.runtimeConfig?.dreamfaceIoEnabled)}
                disabled={savingModelSwitch}
                onClick={() => setDreamfaceIoEnabled(!payload?.runtimeConfig?.dreamfaceIoEnabled)}
                className={`relative h-8 w-14 rounded-full transition ${
                  payload?.runtimeConfig?.dreamfaceIoEnabled ? "bg-emerald-500" : "bg-[#d1d5db]"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                    payload?.runtimeConfig?.dreamfaceIoEnabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">PayPal checkout</p>
                  <span className="rounded-full bg-[#e8f7ef] px-2.5 py-1 text-[11px] font-semibold text-[#087443]">Primary</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
                  All new credit and subscription checkouts use PayPal. Stripe checkout is paused; its webhook and portal remain available only for historical Stripe subscriptions.
                </p>
                <p className="mt-1 text-xs text-[#86868b]">
                  PayPal {payload?.runtimeConfig?.paypalConfigured ? "ready" : `not ready (${payload?.runtimeConfig?.paypalPlansConfigured ?? 0}/${payload?.runtimeConfig?.paypalPlansTotal ?? 6} plans verified)`} · Stripe historical compatibility {payload?.runtimeConfig?.stripeConfigured ? "ready" : "not configured"}
                </p>
                <p className={`mt-1 text-xs ${payload?.runtimeConfig?.paypalUpgradeCompatible ? "text-[#087443]" : "text-[#a14a15]"}`}>
                  In-place upgrades {payload?.runtimeConfig?.paypalUpgradeCompatible ? "ready" : `not ready (${payload?.runtimeConfig?.paypalProductCount ?? 0} PayPal product groups detected)`}
                </p>
                {(payload?.runtimeConfig?.paypalPlanChecks || []).some((check) => !check.valid) ? (
                  <div className="mt-3 space-y-1 text-xs text-[#a14a15]">
                    {(payload?.runtimeConfig?.paypalPlanChecks || []).filter((check) => !check.valid).map((check) => (
                      <p key={check.key}><span className="font-semibold">{check.key}</span>: {check.error || `${check.env} is invalid`}</p>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={reconcilingPayPal || !payload?.runtimeConfig?.paypalConfigured}
                onClick={reconcilePayPal}
                className="self-start rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 sm:self-auto"
              >
                {reconcilingPayPal ? "Reconciling..." : "Reconcile PayPal"}
              </button>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#4f5a6d]">
              {message}
            </div>
          ) : null}
        </section>

        <nav className="mt-6 rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap gap-2">
            {adminSections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-black/10 bg-[#fbfbfd] px-3 py-2 text-xs font-semibold text-[#4f5a6d] transition hover:border-black/20 hover:bg-white hover:text-[#1d1d1f]"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        {filterUserId.trim() ? (
          <section id="user-detail" className="mt-6 scroll-mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#86868b]">User detail</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{selectedUser?.email || "Selected user"}</h2>
                <p className="mt-2 break-all text-xs text-[#86868b]">{filterUserId.trim()}</p>
                {selectedUser ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#4f5a6d]">
                    <span className="rounded-full border border-black/10 bg-[#fbfbfd] px-3 py-1.5">Country: {countryLabel(selectedUser)}</span>
                    <span className="rounded-full border border-black/10 bg-[#fbfbfd] px-3 py-1.5">Created: {formatDate(selectedUser.createdAt)}</span>
                    <span className="rounded-full border border-black/10 bg-[#fbfbfd] px-3 py-1.5">Last sign-in: {formatDate(selectedUser.lastSignInAt)}</span>
                    <span className="rounded-full border border-black/10 bg-[#fbfbfd] px-3 py-1.5">Balance: {selectedUser.balance.toLocaleString()} credits</span>
                    {selectedSubscription ? (
                      <span className="rounded-full border border-black/10 bg-[#fbfbfd] px-3 py-1.5">
                        Subscription: {selectedSubscription.plan_id} / {selectedSubscription.cycle} / {selectedSubscription.status}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#86868b]">{loading ? "Loading selected user..." : "No auth user was found for this id."}</p>
                )}
              </div>
              <AppButton
                variant="secondary"
                onClick={() => {
                  setFilterUserId("");
                  setAdjustUserId("");
                  if (token) loadOps(token, "");
                }}
                disabled={loading}
              >
                Clear user
              </AppButton>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Creations", tasks.length.toLocaleString()],
                ["Completed", selectedUserStats.completed.toLocaleString()],
                ["Running", selectedUserStats.running.toLocaleString()],
                ["Failed", selectedUserStats.failed.toLocaleString()],
                ["Credits spent", selectedUserStats.creditsSpent.toLocaleString()],
                ["Credits refunded", selectedUserStats.creditsRefunded.toLocaleString()],
                ["Credits purchased", selectedUserStats.creditsPurchased.toLocaleString()],
                ["Revenue", formatUsd(selectedUserStats.revenueCents, selectedCompletedPurchases[0]?.currency || "usd")]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <AnalyticsBreakdown title="Creation type" values={selectedUserStats.byMode} />
              <AnalyticsBreakdown title="Model usage" values={selectedUserStats.byProvider} />
              <AnalyticsBreakdown title="Task status" values={selectedUserStats.byStatus} />
            </div>

            <div className="mt-5 rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Recent creations</p>
                <span className="text-xs text-[#86868b]">Latest {Math.min(tasks.length, 8)} of {tasks.length}</span>
              </div>
              <TaskList tasks={tasks.slice(0, 8)} loading={loading} />
            </div>
          </section>
        ) : null}

        <section id="analytics" className="mt-6 scroll-mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#86868b]">Conversion funnel</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">GTM + GA4 event mirror</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                These events are pushed to dataLayer for GTM/GA4 and stored in Supabase for operational reporting. Window: last 7 days.
              </p>
              {analytics?.storageWarning ? (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Analytics storage warning: {analytics.storageWarning}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-right md:grid-cols-4">
              {[
                ["Events", analyticsSummary?.totalEvents ?? 0],
                ["Today", analyticsSummary?.todayEvents ?? 0],
                ["Sessions", analyticsSummary?.uniqueSessions ?? 0],
                ["Users", analyticsSummary?.uniqueUsers ?? 0]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {funnel.map((step, index) => (
              <div key={step.event} className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{step.label}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#6e6e73]">#{index + 1}</span>
                </div>
                <p className="mt-3 text-3xl font-semibold">{step.count.toLocaleString()}</p>
                <p className="mt-1 text-xs text-[#86868b]">
                  {step.uniqueSessions} sessions / {step.uniqueUsers} users
                </p>
                <p className="mt-2 text-xs text-[#4f5a6d]">
                  Previous step conversion: {step.conversionFromPrevious === null ? "--" : `${step.conversionFromPrevious}%`}
                </p>
              </div>
            ))}
            {!funnel.length ? <Empty loading={loading} /> : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <AnalyticsBreakdown title="Top events" values={analyticsSummary?.byEvent || {}} />
            <AnalyticsBreakdown title="Model interest" values={analyticsSummary?.byModel || {}} />
            <AnalyticsBreakdown title="Mode interest" values={analyticsSummary?.byMode || {}} />
            <AnalyticsBreakdown title="Country events" values={analyticsSummary?.byCountry || {}} />
          </div>
        </section>

        <section id="health" className="mt-6 scroll-mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#86868b]">Production health</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">System readiness</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                Checks critical environment variables, billing readiness, recent generation failure rate, pending purchases, and task recovery risk.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.12em] text-[#86868b]">Status</p>
              <p className={`mt-1 text-lg font-semibold ${health?.ok ? "text-emerald-700" : "text-rose-700"}`}>
                {health ? (health.ok ? "Healthy" : `${health.critical} critical / ${health.warnings} warning`) : "Loading"}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(health?.checks || []).map((check) => (
              <div key={check.key} className={`rounded-2xl border p-4 ${healthClass(check.status)}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1d1d1f]">{check.label}</p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase">
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#5f6779]">{check.detail}</p>
              </div>
            ))}
            {!health?.checks?.length ? <Empty loading={loading} /> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/health/network"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
            >
              Open network probe
            </a>
            <AppButton variant="secondary" onClick={() => loadOps()} disabled={loading}>
              Refresh health
            </AppButton>
          </div>
        </section>

        <section id="generation-safety" className="mt-6 scroll-mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#86868b]">Generation safety</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Recovery findings</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                Detect charged failures without refunds, provider tasks missing tracking, and tasks past timeout. Repair is idempotent and uses the same refund ledger reference as normal generation failures.
              </p>
            </div>
            <AppButton onClick={repairGenerationSafety} disabled={repairing || loading}>
              {repairing ? "Repairing..." : filterUserId.trim() ? "Repair filtered user" : "Repair generation safety"}
            </AppButton>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {findings.map((finding) => (
              <div
                key={finding.kind}
                className={`rounded-2xl border p-4 ${
                  finding.severity === "critical"
                    ? "border-rose-200 bg-rose-50/70"
                    : "border-amber-200 bg-amber-50/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1d1d1f]">{finding.label}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1d1d1f]">
                    {finding.count}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#5f6779]">{finding.description}</p>
                {finding.taskIds.length ? (
                  <p className="mt-2 truncate text-[11px] text-[#86868b]">{finding.taskIds.slice(0, 3).join(", ")}</p>
                ) : null}
              </div>
            ))}
            {!findings.length ? <Empty loading={loading} /> : null}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel id="users" title="Users" count={users.length} className="xl:col-span-2">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-[#6e6e73]">
                Default {USERS_PER_PAGE} per page. Includes auth profile, country signal, balance, spending, purchases, tasks, and latest subscription.
              </p>
              <div className="flex flex-wrap gap-2">
                <AppButton variant="secondary" onClick={() => downloadUsersCsv(users)} disabled={!users.length}>
                  Export CSV
                </AppButton>
                <AppButton
                  variant="secondary"
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  disabled={userPage <= 1}
                >
                  Previous
                </AppButton>
                <AppButton
                  variant="secondary"
                  onClick={() => setUserPage((page) => Math.min(userPageCount, page + 1))}
                  disabled={userPage >= userPageCount}
                >
                  Next
                </AppButton>
              </div>
            </div>
            <div className="mb-3 text-xs font-semibold text-[#86868b]">
              Page {userPage} / {userPageCount}
            </div>
            {users.length ? (
              <div className="overflow-x-auto rounded-2xl border border-black/10">
                <div className="min-w-[1200px]">
                <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.75fr_0.75fr_0.75fr_0.75fr] gap-3 bg-[#f5f5f7] px-3 py-2 text-xs uppercase tracking-[0.1em] text-[#86868b]">
                  <span>User</span>
                  <span>Country</span>
                  <span>Dates</span>
                  <span>Balance</span>
                  <span>Credits</span>
                  <span>Tasks</span>
                  <span>Paid</span>
                </div>
                <div className="divide-y divide-black/10">
                  {visibleUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setFilterUserId(user.id);
                        setAdjustUserId(user.id);
                        if (token) loadOps(token, user.id);
                      }}
                      className="grid w-full grid-cols-[1.4fr_0.7fr_0.8fr_0.75fr_0.75fr_0.75fr_0.75fr] gap-3 px-3 py-3 text-left text-xs transition hover:bg-[#fbfbfd]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#1d1d1f]">{user.email || "No email"}</span>
                        <span className="block break-all text-[#86868b]">{user.id}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#4f5a6d]">{countryLabel(user)}</span>
                        <span className="block text-[#86868b]">{user.countryEventCount || 0} events</span>
                      </span>
                      <span className="text-[#4f5a6d]">
                        <span className="block">Reg {formatDate(user.createdAt)}</span>
                        <span className="block">Login {formatDate(user.lastSignInAt)}</span>
                      </span>
                      <span className="font-semibold text-[#1d1d1f]">{user.balance.toLocaleString()}</span>
                      <span className="text-[#4f5a6d]">
                        <span className="block">Spent {user.creditsSpent.toLocaleString()}</span>
                        <span className="block">Refund {user.creditsRefunded.toLocaleString()}</span>
                        <span className="block">{user.hasSpentCredits ? "Consumed" : "No spend"}</span>
                      </span>
                      <span className="text-[#4f5a6d]">
                        <span className="block">{user.generationTasks.toLocaleString()} total</span>
                        <span className="block">{user.completedTasks} done / {user.failedTasks} failed</span>
                        <span className="block">{user.runningTasks} running</span>
                      </span>
                      <span className="text-[#4f5a6d]">
                        <span className="block">{user.creditsPurchased.toLocaleString()} credits</span>
                        <span className="block">{formatUsd(user.purchaseRevenueCents)}</span>
                        <span className="block">{user.subscriptionStatus ? `${user.subscriptionPlan} ${user.subscriptionStatus}` : "No sub"}</span>
                      </span>
                    </button>
                  ))}
                </div>
                </div>
              </div>
            ) : (
              <Empty loading={loading} />
            )}
          </Panel>

          <Panel id="countries" title="User Countries" count={countries.length}>
            <Table
              headers={["Country", "Code", "Users", "Events"]}
              rows={countries.map((country) => [
                country.countryName,
                country.countryCode,
                country.users.toLocaleString(),
                country.events.toLocaleString()
              ])}
              loading={loading}
            />
          </Panel>

          <Panel id="credit-accounts" title="Credit Accounts" count={accounts.length}>
            <Table
              headers={["User", "Balance", "Free", "Updated"]}
              rows={accounts.slice(0, 24).map((account) => [
                account.user_id,
                account.balance.toLocaleString(),
                account.free_granted ? "Yes" : "No",
                formatDate(account.updated_at)
              ])}
              loading={loading}
            />
          </Panel>

          <Panel id="credit-ledger" title="Credit Ledger" count={ledger.length}>
            <div className="divide-y divide-black/10">
              {ledger.slice(0, 30).map((entry) => (
                <div key={entry.id} className="grid gap-2 py-3 md:grid-cols-[0.8fr_0.7fr_1fr]">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${amountClass(entry.amount)}`}>
                      {entry.amount > 0 ? "+" : ""}{entry.amount} credits
                    </p>
                    <p className="text-xs text-[#86868b]">{formatDate(entry.created_at)}</p>
                  </div>
                  <p className="break-all text-xs text-[#86868b]">{entry.user_id}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{entry.reason}</p>
                    <p className="break-all text-xs text-[#86868b]">{entry.reference_id || "No reference"}</p>
                  </div>
                </div>
              ))}
              {!ledger.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel id="purchases" title="Purchases" count={purchases.length}>
            <div className="divide-y divide-black/10">
              {purchases.slice(0, 30).map((purchase) => (
                <div key={purchase.id} className="grid gap-2 py-3 md:grid-cols-[0.8fr_0.8fr_1fr]">
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(purchase.status)}`}>
                      {purchase.status}
                    </span>
                    <p className="mt-2 text-xs text-[#86868b]">{formatDate(purchase.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{purchase.pack_id}</p>
                    <p className="text-xs text-[#86868b]">{purchase.credits.toLocaleString()} credits · {formatUsd(purchase.amount_cents, purchase.currency)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="break-all text-xs text-[#86868b]">{purchase.user_id}</p>
                    <p className="text-xs font-semibold capitalize text-[#4f5a6d]">{purchase.payment_provider}</p>
                    <p className="break-all text-xs text-[#86868b]">{purchase.provider_transaction_id || purchase.stripe_checkout_id || "No transaction id"}</p>
                  </div>
                </div>
              ))}
              {!purchases.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel id="subscriptions" title="Subscriptions" count={subscriptions.length}>
            <div className="divide-y divide-black/10">
              {subscriptions.slice(0, 30).map((subscription) => (
                <div key={subscription.id} className="grid gap-2 py-3 md:grid-cols-[0.7fr_0.8fr_1fr]">
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(subscription.status)}`}>
                      {subscription.status}
                    </span>
                    <p className="mt-2 text-xs text-[#86868b]">
                      {subscription.cancel_at_period_end ? "Cancels at period end" : "Renews normally"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{subscription.plan_id} / {subscription.cycle}</p>
                    <p className="text-xs text-[#86868b]">{subscription.credits_per_cycle.toLocaleString()} credits per cycle</p>
                    <p className="text-xs text-[#86868b]">Period end {formatDate(subscription.current_period_end)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="break-all text-xs text-[#86868b]">{subscription.user_id}</p>
                    <p className="text-xs font-semibold capitalize text-[#4f5a6d]">{subscription.payment_provider}</p>
                    <p className="break-all text-xs text-[#86868b]">{subscription.provider_subscription_id || subscription.stripe_subscription_id || "No subscription id"}</p>
                    <p className="break-all text-xs text-[#86868b]">{subscription.provider_customer_id || subscription.stripe_customer_id || "No customer id"}</p>
                  </div>
                </div>
              ))}
              {!subscriptions.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel id="payment-incidents" title="Payment Incidents" count={paymentIncidents.length}>
            <div className="divide-y divide-black/10">
              {paymentIncidents.slice(0, 50).map((incident) => (
                <div key={incident.id} className="grid gap-3 py-4 md:grid-cols-[0.65fr_1.5fr_0.8fr]">
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(incident.status)}`}>
                      {incident.status.replaceAll("_", " ")}
                    </span>
                    <p className="mt-2 text-xs text-[#86868b]">{formatDate(incident.created_at)}</p>
                    {incident.amount_cents != null ? <p className="text-xs font-semibold">{formatUsd(incident.amount_cents, incident.currency || "usd")}</p> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{incident.event_type}</p>
                    <p className="mt-1 text-xs leading-5 text-[#4f5a6d]">{incident.reason}</p>
                    <p className="mt-1 break-all text-xs text-[#86868b]">User: {incident.user_id || "Not matched"}</p>
                    {incident.resolution_note ? <p className="mt-2 text-xs text-[#087443]">Resolution: {incident.resolution_note}</p> : null}
                  </div>
                  <div className="md:text-right">
                    <p className="break-all text-xs text-[#86868b]">Transaction: {incident.provider_transaction_id || "Not matched"}</p>
                    {incident.status === "review_required" ? (
                      <button
                        type="button"
                        disabled={resolvingIncidentId != null}
                        onClick={() => resolvePaymentIncident(incident.id)}
                        className="mt-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
                      >
                        {resolvingIncidentId === incident.id ? "Saving..." : "Mark resolved"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!paymentIncidents.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel id="tasks" title="Generation Tasks" count={tasks.length}>
            <TaskList tasks={tasks.slice(0, 30)} loading={loading} />
          </Panel>

          <Panel id="failed-tasks" title="Failed Tasks" count={failedTasks.length}>
            <TaskList tasks={failedTasks.slice(0, 30)} loading={loading} failures />
          </Panel>

          <Panel id="events" title="Recent Analytics Events" count={analytics?.recentEvents?.length || 0}>
            <div className="divide-y divide-black/10">
              {(analytics?.recentEvents || []).slice(0, 30).map((event, index) => (
                <div key={`${event.event_name}-${event.created_at}-${index}`} className="grid gap-2 py-3 md:grid-cols-[0.6fr_1fr_1fr]">
                  <div>
                    <p className="text-sm font-semibold">{event.event_name}</p>
                    <p className="text-xs text-[#86868b]">{formatDate(event.created_at)}</p>
                  </div>
                  <p className="break-all text-xs text-[#86868b]">{event.user_id || event.anonymous_id || "Anonymous"}</p>
                  <p className="line-clamp-2 text-xs leading-5 text-[#4f5a6d]">
                    {event.properties ? JSON.stringify(event.properties) : "{}"}
                  </p>
                </div>
              ))}
              {!analytics?.recentEvents?.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function AnalyticsBreakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);
  return (
    <div className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {entries.length ? (
          entries.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-[#4f5a6d]">{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#86868b]">No events yet.</p>
        )}
      </div>
    </div>
  );
}

function Panel({ id, title, count, className = "", children }: { id?: string; title: string; count: number; className?: string; children: ReactNode }) {
  return (
    <article id={id} className={`scroll-mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">{count}</span>
      </div>
      {children}
    </article>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return <p className="rounded-xl border border-black/10 bg-[#fbfbfd] px-4 py-3 text-sm text-[#86868b]">{loading ? "Loading..." : "No records found."}</p>;
}

function Table({ headers, rows, loading }: { headers: string[]; rows: string[][]; loading: boolean }) {
  if (!rows.length) return <Empty loading={loading} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10">
      <div className="grid grid-cols-4 bg-[#f5f5f7] px-3 py-2 text-xs uppercase tracking-[0.1em] text-[#86868b]">
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div className="divide-y divide-black/10">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-4 gap-2 px-3 py-3 text-xs">
            {row.map((cell, cellIndex) => (
              <span key={cellIndex} className="break-all text-[#4f5a6d]">{cell}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskList({ tasks, loading, failures = false }: { tasks: Task[]; loading: boolean; failures?: boolean }) {
  if (!tasks.length) return <Empty loading={loading} />;
  return (
    <div className="divide-y divide-black/10">
      {tasks.map((task) => (
        <div key={task.id} className="grid gap-2 py-3 md:grid-cols-[0.7fr_1fr_1.2fr]">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(task.status)}`}>
              {task.status}
            </span>
            <p className="mt-2 text-xs text-[#86868b]">{formatDate(task.created_at)}</p>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{task.provider} · {task.mode}</p>
            <p className="break-all text-xs text-[#86868b]">{task.id}</p>
            {task.provider_request_id ? <p className="break-all text-xs text-[#86868b]">Provider {task.provider_request_id}</p> : null}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-xs leading-5 text-[#4f5a6d]">{failures ? task.failure_reason || task.prompt : task.prompt}</p>
            <p className="mt-1 text-xs text-[#86868b]">
              {task.estimated_credits} credits · {task.failure_code || task.transport}
            </p>
            <p className="break-all text-xs text-[#86868b]">{task.user_id}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
