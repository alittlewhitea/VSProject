"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";

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
  ratio?: string;
  transport?: "real" | "mock";
  createdAt?: string;
  updatedAt?: string | null;
  statusUrl?: string | null;
  responseUrl?: string | null;
  mediaUrl?: string | null;
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
  status_url?: string | null;
  response_url?: string | null;
  output_url?: string | null;
  raw_result?: unknown;
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

const SESSION_TASKS_KEY = "nova_session_tasks";

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

function readSessionTasks(): CreationTask[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(SESSION_TASKS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CreationTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionTasks(tasks: CreationTask[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_TASKS_KEY, JSON.stringify(tasks.slice(0, 30)));
}

function mergeTasks(remoteTasks: CreationTask[], sessionTasks: CreationTask[]) {
  const seen = new Set<string>();
  return [...remoteTasks, ...sessionTasks].filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

function formatDate(value?: string | null) {
  if (!value) return "This session";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function providerLabel(provider?: string) {
  const labels: Record<string, string> = {
    "chatgpt-image": "OpenAI GPT-Image-2",
    "flux-image": "FLUX Schnell",
    "recraft-image": "Recraft",
    "seedance-video": "Seedance",
    "kling-video": "Kling",
    "veo-video": "Veo"
  };
  return provider ? labels[provider] || provider : "Unknown provider";
}

function taskTitle(task: CreationTask) {
  return task.title || providerLabel(task.provider);
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
    statusUrl: task.status_url || null,
    responseUrl: task.response_url || null,
    mediaUrl: task.output_url || pickMediaUrl(task.raw_result) || null,
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
  const params = new URLSearchParams({
    mode: task.type === "Image" ? "image" : "video"
  });
  if (task.type === "Image") params.set("workflow", "text-to-image");
  if (task.prompt) params.set("prompt", task.prompt);
  if (task.provider) params.set("provider", task.provider);
  if (task.ratio) params.set("ratio", task.ratio);
  return `/studio?${params.toString()}`;
}

export default function CreationsPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<CreationTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  async function loadTasks(token: string, options?: { quiet?: boolean }) {
    if (!options?.quiet) {
      setLoading(true);
      setSyncNote("Refreshing cloud history and background tasks...");
    }

    try {
      const response = await fetch("/api/tasks", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Creation history could not be loaded.");
      const payload = (await response.json()) as {
        tasks: ApiTask[];
        storageWarning?: string;
      };
      const remoteTasks = payload.tasks.map(taskFromApi);
      const merged = mergeTasks(remoteTasks, readSessionTasks());
      setTasks(merged);
      saveSessionTasks(merged);
      setSelectedId((prev) => (prev && merged.some((task) => task.id === prev) ? prev : merged[0]?.id || null));
      setNote(merged.length ? "" : payload.storageWarning || "");
      setSyncNote(payload.storageWarning ? "Cloud history unavailable. Showing browser-saved creations." : "History is up to date.");
    } catch (error) {
      const sessionTasks = readSessionTasks();
      setTasks(sessionTasks);
      setSelectedId((prev) => (prev && sessionTasks.some((task) => task.id === prev) ? prev : sessionTasks[0]?.id || null));
      if (sessionTasks.length) {
        setNote("");
        setSyncNote("Cloud history unavailable. Showing browser-saved creations.");
      } else {
        setNote(error instanceof Error ? error.message : "Creation history is temporarily unavailable.");
        setSyncNote("");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const sessionTasks = readSessionTasks();
    if (sessionTasks.length) {
      setTasks(sessionTasks);
      setSelectedId(sessionTasks[0].id);
      setSyncNote("Refreshing cloud history and background tasks...");
    }

    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token || null;
      if (!token) {
        router.replace("/auth?next=/creations");
        return;
      }

      setAccessToken(token);
      await loadTasks(token, { quiet: true });
    });
  }, [router]);

  useEffect(() => {
    const selectedTask = tasks.find((task) => task.id === selectedId) || tasks[0] || null;
    setTitleDraft(selectedTask?.title || "");
    setCopiedPrompt(false);
  }, [selectedId, tasks]);

  const selectedTask = tasks.find((task) => task.id === selectedId) || tasks[0] || null;
  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "Completed").length,
      running: tasks.filter((task) => task.status === "Running" || task.status === "Queued").length,
      favorites: tasks.filter((task) => task.isFavorite).length
    }),
    [tasks]
  );

  async function patchTask(id: string, patch: { title?: string | null; isFavorite?: boolean }) {
    if (!accessToken) throw new Error("Please sign in again.");
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ id, ...patch })
    });
    const payload = (await response.json().catch(() => null)) as { task?: ApiTask; error?: string } | null;
    if (!response.ok || !payload?.task) {
      throw new Error(payload?.error || "Task could not be updated.");
    }
    const updatedTask = taskFromApi(payload.task);
    setTasks((prev) => {
      const next = prev.map((task) => (task.id === id ? { ...task, ...updatedTask } : task));
      saveSessionTasks(next);
      return next;
    });
    return updatedTask;
  }

  async function handleSaveTitle() {
    if (!selectedTask || savingTitle) return;
    setSavingTitle(true);
    setActionNote("");
    try {
      await patchTask(selectedTask.id, { title: titleDraft });
      setActionNote("Title saved.");
    } catch (error) {
      setActionNote(error instanceof Error ? error.message : "Title could not be saved.");
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleToggleFavorite(task: CreationTask) {
    setActionNote("");
    try {
      await patchTask(task.id, { isFavorite: !task.isFavorite });
      setActionNote(!task.isFavorite ? "Added to favorites." : "Removed from favorites.");
    } catch (error) {
      setActionNote(error instanceof Error ? error.message : "Favorite could not be updated.");
    }
  }

  async function handleDeleteTask(task: CreationTask) {
    if (!accessToken) {
      setActionNote("Please sign in again.");
      return;
    }
    if (!window.confirm("Delete this creation from your history?")) return;
    setActionNote("");
    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(task.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Task could not be deleted.");
      setTasks((prev) => {
        const next = prev.filter((item) => item.id !== task.id);
        saveSessionTasks(next);
        setSelectedId(next[0]?.id || null);
        return next;
      });
      setActionNote("Creation deleted.");
    } catch (error) {
      setActionNote(error instanceof Error ? error.message : "Task could not be deleted.");
    }
  }

  async function handleCopyPrompt(task: CreationTask) {
    if (!task.prompt) {
      setActionNote("This older task does not have a saved prompt.");
      return;
    }
    try {
      await navigator.clipboard.writeText(task.prompt);
      setCopiedPrompt(true);
      setActionNote("Prompt copied.");
    } catch {
      setActionNote("Prompt could not be copied by this browser.");
    }
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="hero-sheen rounded-[2rem] border border-black/5 bg-gradient-to-b from-white to-[#f7f9fd] p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Personal Creative Center</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Creations</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374]">
                Manage generated assets, recover background tasks, reuse prompts, and keep favorite outputs close.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AppButton href="/studio?mode=image&workflow=text-to-image" variant="primary">New image</AppButton>
              <AppButton href="/studio?mode=video&workflow=text-to-video" variant="secondary">New video</AppButton>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "Total creations", value: stats.total },
            { label: "Completed", value: stats.completed },
            { label: "Queued or running", value: stats.running },
            { label: "Favorites", value: stats.favorites }
          ].map((item) => (
            <div key={item.label} className="card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</p>
            </div>
          ))}
        </section>

        {note ? (
          <p className="mt-5 rounded-xl border border-[#d8b85d]/30 bg-[#fff8df] px-4 py-3 text-sm text-[#705d1d]">
            {note}
          </p>
        ) : null}
        {actionNote ? (
          <p className="mt-5 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#4f5a6d]">
            {actionNote}
          </p>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
          <article className="card rounded-3xl p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">History</h2>
                {syncNote ? <p className="mt-1 text-xs text-[#667084]">{syncNote}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => accessToken && loadTasks(accessToken)}
                disabled={loading || !accessToken}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f] disabled:opacity-50"
              >
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </div>

            {loading && !tasks.length ? (
              <p className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">Loading creations...</p>
            ) : tasks.length ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedId(task.id)}
                    className={`motion-smooth grid w-full grid-cols-[72px_1fr] gap-3 rounded-2xl border p-3 text-left ${
                      selectedTask?.id === task.id
                        ? "border-[#0071e3]/40 bg-[#f1f7ff]"
                        : "border-black/10 bg-white hover:bg-[#f8fbff]"
                    }`}
                  >
                    <div className="flex h-[72px] items-center justify-center overflow-hidden rounded-xl bg-[#eef2f7]">
                      {task.mediaUrl ? (
                        task.type === "Video" ? (
                          <video src={task.mediaUrl} className="h-full w-full object-cover" muted />
                        ) : (
                          <img src={task.mediaUrl} alt={task.id} className="h-full w-full object-cover" />
                        )
                      ) : (
                        <span className="text-xs font-semibold text-[#667084]">{task.type}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {task.isFavorite ? "* " : ""}{taskTitle(task)}
                        </p>
                        <span className="shrink-0 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] text-[#5f6779]">
                          {task.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667084]">
                        {task.prompt || "Prompt not available for this saved session item."}
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[#8a93a3]">{formatDate(task.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm leading-7 text-[#667084]">
                No creations yet. Start a new generation and it will appear here.
              </div>
            )}
          </article>

          <article className="card rounded-3xl p-5 md:p-6">
            {selectedTask ? (
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Task detail</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{taskTitle(selectedTask)}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(selectedTask)}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
                      >
                        {selectedTask.isFavorite ? "Unfavorite" : "Favorite"}
                      </button>
                      {selectedTask.mediaUrl ? (
                        <a
                          href={`/api/generate/download?url=${encodeURIComponent(selectedTask.mediaUrl)}&name=${encodeURIComponent(selectedTask.id)}`}
                          className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white/80 p-4">
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.14em] text-[#667487]">Title</span>
                      <input
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        placeholder={providerLabel(selectedTask.provider)}
                        className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#77a8e8]"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTitle}
                        disabled={savingTitle}
                        className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingTitle ? "Saving" : "Save title"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTitleDraft("")}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Status", value: selectedTask.status },
                      { label: "Type", value: selectedTask.type },
                      { label: "Credits charged", value: String(selectedTask.chargedCredits ?? selectedTask.cost) },
                      { label: "Ratio", value: selectedTask.ratio || "Not saved" },
                      { label: "Transport", value: selectedTask.transport || "Unknown" },
                      { label: "Created", value: formatDate(selectedTask.createdAt) },
                      { label: "Last checked", value: formatDate(selectedTask.lastCheckedAt) },
                      { label: "Failure code", value: selectedTask.failureCode || "None" }
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-black/10 bg-white/80 p-3">
                        <dt className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">{item.label}</dt>
                        <dd className="mt-1 text-sm font-semibold text-[#1d1d1f]">{item.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {selectedTask.failureReason ? (
                    <div className="mt-5 rounded-2xl border border-[#b03439]/20 bg-[#fff7f7] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#b03439]">Failure reason</p>
                      <p className="mt-2 text-sm leading-7 text-[#6f3033]">{selectedTask.failureReason}</p>
                      {selectedTask.timedOutAt ? (
                        <p className="mt-2 text-xs text-[#8f5558]">Timed out at {formatDate(selectedTask.timedOutAt)}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Credit trust log</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-black/10 bg-white p-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Charge ledger</p>
                        <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                          {selectedTask.chargeLedgerId ? `#${selectedTask.chargeLedgerId}` : "Pending ledger sync"}
                        </p>
                        <p className="mt-1 text-xs text-[#667084]">
                          Charged {selectedTask.chargedCredits ?? selectedTask.cost} credits
                        </p>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-white p-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Refund status</p>
                        <p
                          className={`mt-1 text-sm font-semibold ${
                            selectedTask.refundStatus === "refunded"
                              ? "text-[#197a46]"
                              : selectedTask.refundStatus === "not_refunded"
                                ? "text-[#b03439]"
                                : "text-[#1d1d1f]"
                          }`}
                        >
                          {selectedTask.refundStatus === "refunded"
                            ? "Refunded"
                            : selectedTask.refundStatus === "not_refunded"
                              ? "Not refunded yet"
                              : "Not applicable"}
                        </p>
                        <p className="mt-1 text-xs text-[#667084]">
                          {selectedTask.refundLedgerId
                            ? `Ledger #${selectedTask.refundLedgerId}, +${selectedTask.refundedCredits || 0} credits`
                            : selectedTask.status === "Failed"
                              ? "Refresh if the provider failure was just detected."
                              : "Refunds appear here only when a task fails."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Prompt</p>
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(selectedTask)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#1d1d1f]"
                      >
                        {copiedPrompt ? "Copied" : "Copy prompt"}
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#343d4d]">
                      {selectedTask.prompt || "Prompt was not saved for this older session item."}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={regenerateHref(selectedTask)}
                      className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Regenerate
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(selectedTask)}
                      className="rounded-full border border-[#b03439]/30 bg-white px-4 py-2 text-sm font-semibold text-[#b03439]"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Task ID</p>
                    <p className="mt-2 break-all text-sm font-medium text-[#343d4d]">{selectedTask.id}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  {selectedTask.mediaUrl ? (
                    selectedTask.type === "Video" ? (
                      <video src={selectedTask.mediaUrl} controls className="max-h-[680px] w-full rounded-xl bg-black object-contain" />
                    ) : (
                      <img src={selectedTask.mediaUrl} alt={selectedTask.id} className="max-h-[680px] w-full rounded-xl bg-[#eef2f7] object-contain" />
                    )
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-[#eef2f7] p-6 text-center text-sm text-[#667084]">
                      Preview will appear when the task completes. Use Refresh after returning to this page.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-black/10 bg-white p-6 text-sm text-[#667084]">
                Select a creation to inspect its details.
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
