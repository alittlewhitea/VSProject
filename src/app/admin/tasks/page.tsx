"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "../../../components/top-nav";
import { AppButton } from "../../../components/ui/button";
import { createBrowserSupabaseClient } from "../../../lib/supabase-client";

type AdminTask = {
  id: string;
  userId: string;
  mode: "image" | "video" | "audio";
  provider: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  estimatedCredits: number;
  chargedCredits: number;
  chargeLedgerId: number | string | null;
  refundedCredits: number;
  refundLedgerId: number | string | null;
  refundStatus: "refunded" | "not_refunded" | "not_applicable";
  transport: "real" | "mock";
  providerRequestId: string | null;
  outputUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  title: string | null;
  failureCode: string | null;
  failureReason: string | null;
  lastCheckedAt: string | null;
  timedOutAt: string | null;
  reconciliationEvents?:{action:string;actor:string;note:string;at:string}[];
};

type AdminTasksPayload = {
  adminEmail?: string;
  items?: AdminTask[];
  totals?: {
    all: number;
    failed: number;
    refunded: number;
    notRefundedFailures: number;
  };
  error?: string;
};

const statusOptions = ["all", "queued", "running", "completed", "failed"] as const;

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusTone(status: AdminTask["status"]) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "running") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function refundTone(status: AdminTask["refundStatus"]) {
  if (status === "refunded") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "not_refunded") return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-neutral-100 text-neutral-600 ring-neutral-200";
}

export default function AdminTasksPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [totals, setTotals] = useState<AdminTasksPayload["totals"]>();
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("all");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [reviewOnly,setReviewOnly]=useState(false);
  const [reviewTask,setReviewTask]=useState<AdminTask|null>(null);
  const [reviewRequestId,setReviewRequestId]=useState("");
  const [reviewNote,setReviewNote]=useState("");
  const [reviewCost,setReviewCost]=useState("0");
  const [providerConfirmed,setProviderConfirmed]=useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || null;
      if (!accessToken) {
        router.replace("/auth?next=/admin/tasks");
        return;
      }
      setToken(accessToken);
    });
  }, [router, supabase]);

  async function loadTasks(accessToken = token) {
    if (!accessToken) return;
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ limit: "50" });
    if (status !== "all") params.set("status", status);
    if (userId.trim()) params.set("userId", userId.trim());
    if(reviewOnly)params.set("review","1");

    try {
      const response = await fetch(`/api/admin/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const payload = (await response.json()) as AdminTasksPayload;
      if (!response.ok) throw new Error(payload.error || "Admin tasks could not be loaded.");
      setTasks(payload.items || []);
      setTotals(payload.totals);
      setAdminEmail(payload.adminEmail || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function syncProviderTask(taskId: string, accessToken = token) {
    if (!accessToken) return;
    setSyncingTaskId(taskId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ action: "sync_provider", taskId })
      });
      const payload = (await response.json()) as {
        task?: AdminTask | null;
        providerStatus?: string;
        timedOut?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Provider sync failed.");
      if (payload.task) {
        setTasks((current) => current.map((task) => (task.id === taskId ? (payload.task as AdminTask) : task)));
      }
      setMessage(
        `Provider sync completed for ${taskId}. Provider status: ${payload.providerStatus || "unknown"}.`
      );
      await loadTasks(accessToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider sync failed.");
    } finally {
      setSyncingTaskId(null);
    }
  }

  async function reviewAction(action:"attach_tracking"|"cancel_provider"|"resolve_no_job",task=reviewTask) {
    if(!task||!token)return;
    setSyncingTaskId(task.id);setMessage("");
    try {
      const response=await fetch("/api/admin/tasks",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,taskId:task.id,requestId:reviewRequestId.trim(),note:reviewNote.trim(),confirmedCostUsd:Number(reviewCost),providerConfirmedNoJob:providerConfirmed})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"The task could not be reconciled.");
      setReviewTask(null);await loadTasks(token);setMessage(`Task ${task.id}: ${payload.providerStatus||"reconciliation recorded"}.`);
    } catch(error){setMessage(error instanceof Error?error.message:"The task could not be reconciled.");}
    finally{setSyncingTaskId(null);}
  }

  useEffect(() => {
    if (token) loadTasks(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, reviewOnly]);

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-[#1d1d1f]">
      <div className="mx-auto w-full max-w-[1760px] px-4 py-6 md:px-8">
        <TopNav />

        <section className="mt-8 rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#6e6e73]">Admin Operations</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Generation Tasks</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                Monitor task failures, charged credits, refund state, and ledger IDs from one place.
              </p>
              {adminEmail ? <p className="mt-2 text-xs text-[#86868b]">Signed in as {adminEmail}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/gallery">
                <AppButton variant="secondary">Gallery Admin</AppButton>
              </Link>
              <AppButton onClick={() => loadTasks()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </AppButton>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-[#6e6e73]">
            <input type="checkbox" checked={reviewOnly} onChange={event=>setReviewOnly(event.target.checked)} />
            Show tasks awaiting provider confirmation
          </label>

          {reviewTask ? (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-semibold">Review pending task</h2><p className="mt-1 break-all text-xs text-[#6e6e73]">{reviewTask.id}</p></div>
                <button type="button" onClick={()=>setReviewTask(null)} className="text-sm underline">Close</button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">Provider request ID
                  <input value={reviewRequestId} onChange={event=>setReviewRequestId(event.target.value)} placeholder="ID from the provider dashboard" className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2" />
                </label>
                <label className="text-sm">Confirmed total provider cost (USD)
                  <input type="number" min="0" step="0.000001" value={reviewCost} onChange={event=>setReviewCost(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2" />
                </label>
                <label className="text-sm sm:col-span-2">Provider evidence and resolution reason
                  <textarea value={reviewNote} onChange={event=>setReviewNote(event.target.value)} maxLength={1000} rows={3} placeholder="Record the provider support reference, confirmed task state and cost." className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2" />
                </label>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm leading-6"><input type="checkbox" checked={providerConfirmed} onChange={event=>setProviderConfirmed(event.target.checked)} className="mt-1.5" />The provider confirmed no active job remains, and the total cost above includes all generation stages.</label>
              <div className="mt-4 flex flex-wrap gap-3">
                <AppButton variant="secondary" disabled={Boolean(syncingTaskId)||!reviewRequestId.trim()||reviewNote.trim().length<12} onClick={()=>reviewAction("attach_tracking")}>Verify and attach request</AppButton>
                <AppButton disabled={Boolean(syncingTaskId)||!providerConfirmed||reviewNote.trim().length<12||!reviewCost.trim()||!Number.isFinite(Number(reviewCost))||Number(reviewCost)<0} onClick={()=>reviewAction("resolve_no_job")}>Settle confirmed failure</AppButton>
              </div>
            </section>
          ) : null}

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Recent tasks", totals?.all ?? tasks.length],
              ["Failed", totals?.failed ?? 0],
              ["Refunded", totals?.refunded ?? 0],
              ["Failed not refunded", totals?.notRefundedFailures ?? 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-black/10 bg-[#fbfbfd] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}
              className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/30"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All statuses" : option}
                </option>
              ))}
            </select>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Filter by user UUID"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/30"
            />
            <AppButton variant="secondary" onClick={() => loadTasks()} disabled={loading}>
              Apply
            </AppButton>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <div className="mt-7 overflow-hidden rounded-2xl border border-black/10">
            <div className="hidden grid-cols-[1.1fr_0.8fr_0.8fr_1fr_1fr_1.6fr] gap-4 bg-[#f5f5f7] px-4 py-3 text-xs uppercase tracking-[0.1em] text-[#86868b] lg:grid">
              <span>Task</span>
              <span>Status</span>
              <span>Credits</span>
              <span>Refund</span>
              <span>Checked</span>
              <span>Failure</span>
            </div>

            <div className="divide-y divide-black/10 bg-white">
              {loading ? (
                <div className="p-6 text-sm text-[#6e6e73]">Loading tasks...</div>
              ) : tasks.length ? (
                tasks.map((task) => (
                  <article
                    key={task.id}
                    className="grid gap-4 px-4 py-5 text-sm lg:grid-cols-[1.1fr_0.8fr_0.8fr_1fr_1fr_1.6fr]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.title || task.prompt || task.id}</p>
                      <p className="mt-1 break-all text-xs text-[#86868b]">{task.id}</p>
                      <p className="mt-1 truncate text-xs text-[#86868b]">
                        {task.userId} · {task.provider} · {task.mode}
                      </p>
                      {task.providerRequestId ? <p className="mt-1 break-all text-xs text-[#86868b]">Provider {task.providerRequestId}</p> : null}
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(task.status)}`}>
                        {task.status}
                      </span>
                      <p className="mt-2 text-xs text-[#86868b]">{formatDate(task.createdAt)}</p>
                    </div>
                    <div className="text-sm">
                      <p>Est. {task.estimatedCredits}</p>
                      <p className="text-xs text-[#86868b]">Charged {task.chargedCredits || 0}</p>
                      <p className="break-all text-xs text-[#86868b]">Ledger {task.chargeLedgerId || "none"}</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${refundTone(task.refundStatus)}`}>
                        {task.refundStatus.replace("_", " ")}
                      </span>
                      <p className="mt-2 text-xs text-[#86868b]">Refunded {task.refundedCredits || 0}</p>
                      <p className="break-all text-xs text-[#86868b]">Ledger {task.refundLedgerId || "none"}</p>
                    </div>
                    <div className="text-xs text-[#86868b]">
                      <p>{formatDate(task.lastCheckedAt)}</p>
                      {task.timedOutAt ? <p className="mt-1 text-rose-600">Timed out {formatDate(task.timedOutAt)}</p> : null}
                      {task.transport === "real" && (task.status === "queued" || task.status === "running") ? (
                        <button
                          type="button"
                          onClick={() => syncProviderTask(task.id)}
                          disabled={Boolean(syncingTaskId)}
                          className="mt-3 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] shadow-sm transition hover:bg-[#f8fbff] disabled:opacity-60"
                        >
                          {syncingTaskId === task.id ? "Syncing..." : "Sync provider"}
                        </button>
                      ) : null}
                      {task.transport==="real"&&["queued","running"].includes(task.status)?(
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" disabled={Boolean(syncingTaskId)} onClick={()=>{setReviewTask(task);setReviewRequestId(task.providerRequestId||"");setReviewNote("");setReviewCost("0");setProviderConfirmed(false);window.scrollTo({top:0,behavior:"smooth"});}} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">Review</button>
                          {task.providerRequestId?<button type="button" disabled={Boolean(syncingTaskId)} onClick={()=>reviewAction("cancel_provider",task)} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60">Request cancellation</button>:null}
                        </div>
                      ):null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1d1d1f]">{task.failureCode || "No failure code"}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#6e6e73]">
                        {task.failureReason || "No failure reason recorded."}
                      </p>
                      {task.reconciliationEvents?.length?<details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Reconciliation history</summary><ul className="mt-2 space-y-2">{task.reconciliationEvents.map((event,index)=><li key={index} className="break-words rounded-lg bg-neutral-50 p-2"><p>{event.action} · {event.actor}</p><p className="mt-1 text-[#6e6e73]">{event.note}</p><p className="mt-1 text-[#86868b]">{formatDate(event.at)}</p></li>)}</ul></details>:null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="p-6 text-sm text-[#6e6e73]">No tasks found.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
