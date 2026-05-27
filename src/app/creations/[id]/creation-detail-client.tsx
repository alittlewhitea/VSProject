"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "../../../components/top-nav";
import { createBrowserSupabaseClient } from "../../../lib/supabase-client";

type TaskStatus = "Queued" | "Running" | "Completed" | "Failed";

type CreationTask = {
  id: string;
  type: "Image" | "Video";
  status: TaskStatus;
  cost: number;
  title?: string | null;
  isFavorite?: boolean;
  provider?: string;
  prompt?: string;
  transport?: "real" | "mock";
  createdAt?: string;
  updatedAt?: string | null;
  mediaUrl?: string | null;
  settings?: Record<string, unknown> | null;
  chargedCredits?: number;
  chargeLedgerId?: number | string | null;
  refundedCredits?: number;
  refundLedgerId?: number | string | null;
  refundStatus?: "refunded" | "not_refunded" | "not_applicable";
  failureCode?: string | null;
  failureReason?: string | null;
  lastCheckedAt?: string | null;
  timedOutAt?: string | null;
};

type ApiTask = {
  id: string;
  mode: "image" | "video";
  provider?: string;
  prompt?: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport?: "real" | "mock";
  created_at?: string;
  updated_at?: string | null;
  output_url?: string | null;
  raw_result?: unknown;
  request_settings?: Record<string, unknown> | null;
  title?: string | null;
  is_favorite?: boolean;
  charged_credits?: number;
  charge_ledger_id?: number | string | null;
  refunded_credits?: number;
  refund_ledger_id?: number | string | null;
  refund_status?: "refunded" | "not_refunded" | "not_applicable";
  failure_code?: string | null;
  failure_reason?: string | null;
  last_checked_at?: string | null;
  timed_out_at?: string | null;
};

function pickMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") return payload.url;
  if (Array.isArray(payload.images) && payload.images[0] && typeof payload.images[0] === "object") {
    const first = payload.images[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }
  if (payload.video && typeof payload.video === "object") {
    const video = payload.video as Record<string, unknown>;
    if (typeof video.url === "string") return video.url;
  }
  if (Array.isArray(payload.videos) && payload.videos[0] && typeof payload.videos[0] === "object") {
    const first = payload.videos[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }
  return null;
}

function providerLabel(provider?: string) {
  const labels: Record<string, string> = {
    "chatgpt-image": "OpenAI GPT-Image-2",
    "nano-banana-image": "Nano Banana 2",
    "nano-banana-edit": "Nano Banana 2 Edit",
    "flux-image": "FLUX Schnell",
    "flux-dev": "FLUX Dev",
    "recraft-image": "Recraft",
    "seedance-video": "Seedance",
    "kling-video": "Kling",
    "veo-video": "Veo",
    "grok-video": "Grok Imagine Video"
  };
  return provider ? labels[provider] || provider : "Unknown provider";
}

function taskTitle(task: CreationTask) {
  return task.title || providerLabel(task.provider);
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function valueText(value: unknown) {
  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? "" : "s"}` : "None";
  if (value === null || typeof value === "undefined" || value === "") return "Not saved";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function taskFromApi(task: ApiTask): CreationTask {
  return {
    id: task.id,
    type: task.mode === "image" ? "Image" : "Video",
    status:
      task.status === "queued"
        ? "Queued"
        : task.status === "running"
          ? "Running"
          : task.status === "completed"
            ? "Completed"
            : "Failed",
    cost: task.estimated_credits,
    title: task.title || null,
    isFavorite: Boolean(task.is_favorite),
    provider: task.provider,
    prompt: task.prompt,
    transport: task.transport,
    createdAt: task.created_at,
    updatedAt: task.updated_at || null,
    mediaUrl: task.output_url || pickMediaUrl(task.raw_result) || null,
    settings: task.request_settings || null,
    chargedCredits: typeof task.charged_credits === "number" ? task.charged_credits : task.estimated_credits,
    chargeLedgerId: task.charge_ledger_id || null,
    refundedCredits: typeof task.refunded_credits === "number" ? task.refunded_credits : 0,
    refundLedgerId: task.refund_ledger_id || null,
    refundStatus: task.refund_status || (task.status === "failed" ? "not_refunded" : "not_applicable"),
    failureCode: task.failure_code || null,
    failureReason: task.failure_reason || null,
    lastCheckedAt: task.last_checked_at || null,
    timedOutAt: task.timed_out_at || null
  };
}

function regenerateHref(task: CreationTask) {
  const settings = task.settings || {};
  const workflow = typeof settings.workflow === "string" ? settings.workflow : task.type === "Image" ? "text-to-image" : "text-to-video";
  const params = new URLSearchParams({
    mode: task.type === "Image" ? "image" : "video",
    workflow
  });
  if (task.prompt) params.set("prompt", task.prompt);
  if (task.provider) params.set("provider", task.provider === "nano-banana-edit" ? "nano-banana-image" : task.provider);
  if (typeof settings.ratio === "string") params.set("ratio", settings.ratio);
  if (typeof settings.image_size === "string") params.set("imageSize", settings.image_size);
  if (typeof settings.duration === "string") params.set("duration", settings.duration);
  if (typeof settings.resolution === "string") params.set("resolution", settings.resolution);
  return `/studio?${params.toString()}`;
}

function useAsReferenceHref(task: CreationTask) {
  const params = new URLSearchParams({
    mode: "image",
    workflow: "image-to-image",
    provider: "nano-banana-image"
  });
  if (task.prompt) params.set("prompt", task.prompt);
  if (task.mediaUrl) params.set("reference", task.mediaUrl);
  return `/studio?${params.toString()}`;
}

function statusClass(status: TaskStatus) {
  if (status === "Completed") return "bg-[#ecfdf3] text-[#197a46]";
  if (status === "Failed") return "bg-[#fff1f1] text-[#b03439]";
  return "bg-[#f3f7ff] text-[#315a9a]";
}

export function CreationDetailClient({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [task, setTask] = useState<CreationTask | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const settingsEntries = useMemo<[string, unknown][]>(() => {
    const settings = task?.settings || {};
    return [
      ["Workflow", settings.workflow],
      ["Model", settings.model_id],
      ["Provider", providerLabel(task?.provider)],
      ["Aspect ratio", settings.ratio],
      ["Image size", settings.image_size],
      ["Duration", settings.duration],
      ["Resolution", settings.resolution],
      ["Output format", settings.output_format],
      ["Reference images", settings.image_urls]
    ];
  }, [task]);

  async function loadTask(token: string) {
    setLoading(true);
    setNote("Refreshing creation detail...");
    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json().catch(() => null)) as { tasks?: ApiTask[]; error?: string; storageWarning?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Creation could not be loaded.");
      const nextTask = payload?.tasks?.[0] ? taskFromApi(payload.tasks[0]) : null;
      if (!nextTask) throw new Error("Creation not found.");
      setTask(nextTask);
      setTitleDraft(nextTask.title || "");
      setNote(payload?.storageWarning || "Creation detail is up to date.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Creation detail is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      if (!token) {
        router.replace(`/auth?next=${encodeURIComponent(`/creations/${taskId}`)}`);
        return;
      }
      setAccessToken(token);
      loadTask(token);
    });
  }, [router, taskId]);

  async function patchTask(patch: { title?: string | null; isFavorite?: boolean }) {
    if (!accessToken || !task) return;
    setSaving(true);
    setNote("");
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ id: task.id, ...patch })
      });
      const payload = (await response.json().catch(() => null)) as { task?: ApiTask; error?: string } | null;
      if (!response.ok || !payload?.task) throw new Error(payload?.error || "Creation could not be updated.");
      const updated = taskFromApi(payload.task);
      setTask((current) => (current ? { ...current, ...updated } : updated));
      setTitleDraft(updated.title || "");
      setNote("Creation updated.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Creation could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrompt() {
    if (!task?.prompt) {
      setNote("Prompt was not saved for this creation.");
      return;
    }
    try {
      await navigator.clipboard.writeText(task.prompt);
      setNote("Prompt copied.");
    } catch {
      setNote("Prompt could not be copied by this browser.");
    }
  }

  async function deleteTask() {
    if (!accessToken || !task) return;
    if (!window.confirm("Delete this creation from your history?")) return;
    const response = await fetch(`/api/tasks?id=${encodeURIComponent(task.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      router.push("/studio?view=projects");
      return;
    }
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setNote(payload?.error || "Creation could not be deleted.");
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="hero-sheen rounded-[2rem] border border-black/5 bg-gradient-to-b from-white to-[#f7f9fd] p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-8">
          <Link
            href={task ? `/studio?view=projects&taskId=${encodeURIComponent(task.id)}` : "/studio?view=projects"}
            className="inline-flex items-center rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(29,29,31,0.18)] transition hover:-translate-y-0.5"
          >
            Back to Projects
          </Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Creation detail</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
                {task ? taskTitle(task) : "Loading creation"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374]">
                Inspect the final asset, prompt, model settings, task status, and credit ledger in one place.
              </p>
            </div>
            {task ? <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusClass(task.status)}`}>{task.status}</span> : null}
          </div>
        </section>

        {note ? (
          <p className="mt-5 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#4f5a6d]">{note}</p>
        ) : null}

        {loading && !task ? (
          <section className="mt-6 rounded-3xl border border-black/10 bg-white p-8 text-sm text-[#667084]">Loading creation detail...</section>
        ) : task ? (
          <section className="mt-6 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
            <article className="card rounded-3xl p-4 md:p-5">
              {task.mediaUrl ? (
                task.type === "Video" ? (
                  <video src={task.mediaUrl} controls className="max-h-[760px] w-full rounded-2xl bg-black object-contain" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="block w-full overflow-hidden rounded-2xl bg-[#eef2f7]"
                    title="Open large preview"
                  >
                    <img src={task.mediaUrl} alt={task.id} className="max-h-[760px] w-full object-contain" />
                  </button>
                )
              ) : (
                <div className="grid min-h-[520px] place-items-center rounded-2xl bg-[#eef2f7] p-8 text-center text-sm text-[#667084]">
                  No output yet. The studio Projects page now keeps this task live while it runs.
                </div>
              )}
            </article>

            <aside className="space-y-5">
              <article className="card rounded-3xl p-5">
                <div className="flex flex-wrap gap-2">
                  {task.mediaUrl ? (
                    <a
                      href={`/api/generate/download?url=${encodeURIComponent(task.mediaUrl)}&name=${encodeURIComponent(task.id)}`}
                      className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Download
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
                  >
                    Copy prompt
                  </button>
                  <Link href={regenerateHref(task)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]">
                    {task.status === "Failed" ? "Retry" : "Regenerate"}
                  </Link>
                  {task.type === "Image" && task.mediaUrl ? (
                    <Link href={useAsReferenceHref(task)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]">
                      Use as reference
                    </Link>
                  ) : null}
                </div>
              </article>

              <article className="card rounded-3xl p-5">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.14em] text-[#667487]">Title</span>
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    placeholder={providerLabel(task.provider)}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#77a8e8]"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => patchTask({ title: titleDraft })}
                    disabled={saving}
                    className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving" : "Save title"}
                  </button>
                  <button
                    type="button"
                    onClick={() => patchTask({ isFavorite: !task.isFavorite })}
                    disabled={saving}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f] disabled:opacity-50"
                  >
                    {task.isFavorite ? "Unfavorite" : "Favorite"}
                  </button>
                </div>
              </article>

              <article className="card rounded-3xl p-5">
                <h2 className="text-xl font-semibold tracking-tight">Model parameters</h2>
                <dl className="mt-4 grid gap-3">
                  {settingsEntries.map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-black/10 bg-white/80 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">{label}</dt>
                      <dd className="mt-1 break-all text-sm font-semibold text-[#1d1d1f]">{valueText(value)}</dd>
                    </div>
                  ))}
                </dl>
              </article>

              <article className="card rounded-3xl p-5">
                <h2 className="text-xl font-semibold tracking-tight">Billing record</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-white/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Charge ledger</p>
                    <p className="mt-1 text-sm font-semibold">{task.chargeLedgerId ? `#${task.chargeLedgerId}` : "Pending sync"}</p>
                    <p className="mt-1 text-xs text-[#667084]">Charged {task.chargedCredits ?? task.cost} credits</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Refund</p>
                    <p className="mt-1 text-sm font-semibold">
                      {task.refundStatus === "refunded" ? "Refunded" : task.refundStatus === "not_refunded" ? "Not refunded" : "Not applicable"}
                    </p>
                    <p className="mt-1 text-xs text-[#667084]">
                      {task.refundLedgerId ? `Ledger #${task.refundLedgerId}, +${task.refundedCredits || 0} credits` : "No refund ledger"}
                    </p>
                  </div>
                </div>
              </article>

              {task.failureReason ? (
                <article className="rounded-3xl border border-[#b03439]/20 bg-[#fff7f7] p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#b03439]">Failure reason</p>
                  <p className="mt-2 text-sm leading-7 text-[#6f3033]">{task.failureReason}</p>
                </article>
              ) : null}

              <article className="card rounded-3xl p-5">
                <h2 className="text-xl font-semibold tracking-tight">Prompt</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#343d4d]">{task.prompt || "Prompt was not saved for this creation."}</p>
              </article>

              <article className="card rounded-3xl p-5">
                <h2 className="text-xl font-semibold tracking-tight">Task metadata</h2>
                <dl className="mt-4 grid gap-3">
                  {[
                    ["Task ID", task.id],
                    ["Created", formatDate(task.createdAt)],
                    ["Updated", formatDate(task.updatedAt)],
                    ["Last checked", formatDate(task.lastCheckedAt)],
                    ["Transport", task.transport || "Unknown"],
                    ["Failure code", task.failureCode || "None"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-black/10 bg-white/80 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">{label}</dt>
                      <dd className="mt-1 break-all text-sm font-semibold text-[#1d1d1f]">{value}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={deleteTask}
                  className="mt-4 rounded-full border border-[#b03439]/30 bg-white px-4 py-2 text-sm font-semibold text-[#b03439]"
                >
                  Delete creation
                </button>
              </article>
            </aside>
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-black/10 bg-white p-8 text-sm text-[#667084]">Creation not found.</section>
        )}
      </div>

      {previewOpen && task?.mediaUrl ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-full border border-white/25 bg-black/40 px-4 py-1.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
            <img src={task.mediaUrl} alt="Expanded creation" className="max-h-[88vh] w-full rounded-2xl bg-black object-contain" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
