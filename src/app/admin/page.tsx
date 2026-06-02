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
  stripe_checkout_id: string;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: "pending" | "completed" | "cancelled" | "failed";
  created_at: string;
  updated_at: string;
};

type Subscription = {
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
  tasks?: Task[];
  failedTasks?: Task[];
  error?: string;
};

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

  const summary = payload?.summary || {};
  const users = payload?.users || [];
  const accounts = payload?.accounts || [];
  const ledger = payload?.ledger || [];
  const purchases = payload?.purchases || [];
  const subscriptions = payload?.subscriptions || [];
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

        <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#6e6e73]">DreamFace Admin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Operations Console</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                Users, balances, Stripe purchases, credit ledger, generation tasks, failures, and manual credit adjustments.
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
              ["Users", summary.usersWithCreditAccounts ?? accounts.length],
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

          {message ? (
            <div className="mt-5 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#4f5a6d]">
              {message}
            </div>
          ) : null}
        </section>

        {filterUserId.trim() ? (
          <section className="mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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

        <section className="mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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

        <section className="mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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

        <section className="mt-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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
          <Panel title="Users" count={users.length}>
            <div className="divide-y divide-black/10">
              {users.slice(0, 24).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setFilterUserId(user.id);
                    setAdjustUserId(user.id);
                    if (token) loadOps(token, user.id);
                  }}
                  className="grid w-full gap-2 py-3 text-left md:grid-cols-[1fr_0.55fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.email || "No email"}</p>
                    <p className="break-all text-xs text-[#86868b]">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{countryLabel(user)}</p>
                    <p className="text-xs text-[#86868b]">
                      {user.countryEventCount ? `${user.countryEventCount} recent events` : "No recent geo signal"}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm font-semibold">{user.balance.toLocaleString()} credits</p>
                    <p className="text-xs text-[#86868b]">Last sign-in {formatDate(user.lastSignInAt)}</p>
                  </div>
                </button>
              ))}
              {!users.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel title="User Countries" count={countries.length}>
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

          <Panel title="Credit Accounts" count={accounts.length}>
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

          <Panel title="Credit Ledger" count={ledger.length}>
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

          <Panel title="Stripe Purchases" count={purchases.length}>
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
                    <p className="break-all text-xs text-[#86868b]">{purchase.stripe_checkout_id}</p>
                  </div>
                </div>
              ))}
              {!purchases.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel title="Subscriptions" count={subscriptions.length}>
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
                    <p className="break-all text-xs text-[#86868b]">{subscription.stripe_subscription_id}</p>
                    <p className="break-all text-xs text-[#86868b]">{subscription.stripe_customer_id || "No customer id"}</p>
                  </div>
                </div>
              ))}
              {!subscriptions.length ? <Empty loading={loading} /> : null}
            </div>
          </Panel>

          <Panel title="Generation Tasks" count={tasks.length}>
            <TaskList tasks={tasks.slice(0, 30)} loading={loading} />
          </Panel>

          <Panel title="Failed Tasks" count={failedTasks.length}>
            <TaskList tasks={failedTasks.slice(0, 30)} loading={loading} failures />
          </Panel>

          <Panel title="Recent Analytics Events" count={analytics?.recentEvents?.length || 0}>
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

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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
