"use client";

import Link from "next/link";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
type TaskStatus = "Queued" | "Running" | "Completed" | "Failed";
export type ProjectTask = {
  id: string;
  type: "Image" | "Video" | "Audio";
  status: TaskStatus;
  cost: number;
  title?: string | null;
  provider?: string;
  prompt?: string;
  transport?: "real" | "mock";
  createdAt?: string;
  mediaUrl?: string | null;
  settings?: Record<string, unknown> | null;
  chargedCredits?: number;
  refundedCredits?: number;
  refundStatus?: "refunded" | "not_refunded" | "not_applicable";
  failureReason?: string | null;
};

function formatTaskDate(value?: string | null) {
  if (!value) return "Just now";
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusPillClass(status: TaskStatus) {
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "Failed") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "Running") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function projectHref(taskId: string) {
  return `/studio?view=projects&taskId=${encodeURIComponent(taskId)}`;
}

function estimatedWaitRange(task: ProjectTask) {
  const rawDuration = typeof task.settings?.duration === "string" ? task.settings.duration : "";
  const seconds = Number.parseInt(rawDuration, 10);
  if (Number.isFinite(seconds) && seconds >= 10) return "3-4";
  if (Number.isFinite(seconds) && seconds <= 5) return "2-3";
  return "2-4";
}

function regenerateHref(task: ProjectTask) {
  const mode = task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video";
  const workflow = task.type === "Image" ? "text-to-image" : task.type === "Audio" ? task.provider === "minimax-music-2.6" ? "text-to-music" : "text-to-audio" : "text-to-video";
  const params = new URLSearchParams({ mode, workflow });
  if (task.provider) params.set("provider", task.provider);
  if (task.prompt) params.set("prompt", task.prompt);
  return `/studio?${params.toString()}`;
}

function useAsReferenceHref(task: ProjectTask) {
  const params = new URLSearchParams({ mode: task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video", workflow: task.type === "Image" ? "image-to-image" : "image-to-video" });
  if (task.mediaUrl) params.set("reference", task.mediaUrl);
  if (task.prompt) params.set("prompt", task.prompt);
  return `/studio?${params.toString()}`;
}

function taskProgress(task: ProjectTask, duration: string) {
  if (task.status === "Completed" || task.status === "Failed") return 100;
  const rawSeconds = Number.parseInt(duration, 10);
  const estimate = task.type === "Image" ? 90 : task.type === "Audio" ? 60 : rawSeconds >= 10 ? 150 : rawSeconds >= 8 ? 125 : 95;
  const startedAt = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return Math.min(94, Math.max(task.status === "Running" ? 25 : 8, Math.round((elapsed / estimate) * 100)));
}

type StudioProjectsProps = {
  t: Translate;
  tasks: ProjectTask[];
  selectedTask: ProjectTask | null;
  historyNote: string;
  duration: string;
  providerLabel: (provider?: string) => string;
  onPreviewImage: (url: string) => void;
};

export function StudioProjects({ t, tasks, selectedTask, historyNote, duration, providerLabel, onPreviewImage }: StudioProjectsProps) {
  const activeCount = tasks.filter((task) => task.status === "Queued" || task.status === "Running").length;
  const doneCount = tasks.filter((task) => task.status === "Completed").length;
  const failedCount = tasks.filter((task) => task.status === "Failed").length;
  const statusLabel = (status: TaskStatus) => t(`studio.task.${status.toLowerCase()}`);
  const typeLabel = (type: ProjectTask["type"]) => t(`studio.task.${type.toLowerCase()}`);
  const title = (task: ProjectTask) => task.title || task.prompt?.trim().split(/\s+/).slice(0, 8).join(" ") || `${providerLabel(task.provider)} ${task.type}`;

  return (
    <div className="mx-auto mt-4 w-full min-w-0 max-w-7xl overflow-hidden md:mt-10">
      <div className="mb-4 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b95a7]">{t("studio.projects.eyebrow")}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#202633] md:text-5xl">{t("studio.projects.title")}</h2><p className="mt-2 max-w-2xl break-words text-sm leading-6 text-[#7a8496] md:mt-3">{t("studio.projects.description")}</p></div>
        <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 rounded-[1.25rem] border border-black/[0.06] bg-white/72 p-1.5 shadow-sm sm:gap-2 sm:rounded-[1.5rem] sm:p-2 md:w-auto md:min-w-[300px]">
          {[[t("studio.projects.active"), activeCount], [t("studio.projects.done"), doneCount], [t("studio.projects.failed"), failedCount]].map(([label, value]) => <div key={label} className="min-w-0 rounded-[1rem] bg-[#f8fbff] px-1.5 py-2.5 text-center sm:rounded-2xl sm:px-3 md:px-4 md:py-3"><p className="text-lg font-semibold text-[#202633]">{value}</p><p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8b95a7] sm:text-[11px] sm:tracking-[0.14em]">{label}</p></div>)}
        </div>
      </div>
      {historyNote ? <p className="mb-5 rounded-2xl border border-black/[0.06] bg-white/76 px-4 py-3 text-sm font-medium text-[#667085] shadow-sm">{historyNote}</p> : null}

      <div className="grid min-w-0 gap-4 md:gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 rounded-[1.35rem] border border-black/[0.06] bg-white/76 p-2.5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-3 md:rounded-[2rem] xl:order-1">
          <div className="flex items-center justify-between px-3 py-2"><div><h3 className="text-sm font-semibold text-[#202633]">{t("studio.projects.list")}</h3><p className="text-xs font-medium text-[#8b95a7]">{t("studio.projects.savedTasks", { count: tasks.length, label: t(tasks.length === 1 ? "studio.projects.task" : "studio.projects.tasks") })}</p></div><Link href="/studio?mode=image&workflow=text-to-image" className="rounded-full bg-[#0ea5e9] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_26px_rgba(14,165,233,0.22)]">{t("studio.projects.new")}</Link></div>
          <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1 md:max-h-[520px] xl:max-h-[680px]">
            {tasks.length ? tasks.map((task) => <Link key={task.id} href={projectHref(task.id)} className={`block rounded-[1.5rem] border p-4 text-left transition ${selectedTask?.id === task.id ? "border-[#93c5fd] bg-[linear-gradient(135deg,#ffffff,#eef7ff)] shadow-[0_16px_40px_rgba(14,165,233,0.14)]" : "border-black/[0.05] bg-white/72 hover:border-[#bae6fd] hover:bg-white"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#202633]">{title(task)}</p><p className="mt-1 text-xs font-medium text-[#8b95a7]">{providerLabel(task.provider)} / {formatTaskDate(task.createdAt)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPillClass(task.status)}`}>{statusLabel(task.status)}</span></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-[#7a8496]">{task.prompt || t("studio.projects.noPrompt")}</p><div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa4b5]"><span>{typeLabel(task.type)}</span><span>{task.cost} {t("studio.common.credits")}</span></div></Link>) : <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-white/70 p-8 text-center"><p className="text-sm font-semibold text-[#202633]">{t("studio.projects.none")}</p><p className="mt-2 text-xs leading-5 text-[#8b95a7]">{t("studio.projects.empty")}</p></div>}
          </div>
        </aside>

        <section className="order-1 min-w-0 overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-[linear-gradient(135deg,#fbfdff,#f7f9fd)] p-2 shadow-[0_18px_54px_rgba(15,23,42,0.09)] sm:p-3 md:rounded-[2rem] md:p-6 md:shadow-[0_26px_86px_rgba(15,23,42,0.10)] xl:order-2 xl:min-h-[680px]">
          {selectedTask ? (
            <div className="grid h-full min-w-0 gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:gap-5">
              <article className="relative min-w-0 overflow-hidden rounded-[1.15rem] bg-[#111827] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_rgba(15,23,42,0.2)] sm:p-3 md:rounded-[1.75rem] md:p-4 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.22)]">
                <div className="pointer-events-none absolute -left-20 top-10 h-60 w-60 rounded-full bg-[#60a5fa]/20 blur-3xl" /><div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-[#c084fc]/18 blur-3xl" />
                <div className="relative mb-3 flex min-w-0 items-start justify-between gap-2 px-1 pt-1 sm:mb-4 sm:gap-3 sm:px-0 sm:pt-0"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{t("studio.projects.preview")}</p><h3 className="mt-1 line-clamp-2 max-w-xl break-words text-sm font-semibold leading-5 text-white sm:text-base md:text-lg">{title(selectedTask)}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 sm:px-3 sm:py-1.5 sm:text-xs ${statusPillClass(selectedTask.status)}`}>{statusLabel(selectedTask.status)}</span></div>
                <div className="relative grid min-h-[220px] w-full min-w-0 place-items-center overflow-hidden rounded-[0.95rem] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(96,165,250,0.16),transparent_35%),linear-gradient(180deg,#182131,#0d121d)] sm:min-h-[380px] sm:rounded-[1.1rem] md:min-h-[520px] md:rounded-[1.35rem]">
                  {selectedTask.mediaUrl ? selectedTask.type === "Video" ? <video src={selectedTask.mediaUrl} controls playsInline preload="metadata" className="block max-h-[68dvh] w-full min-w-0 max-w-full bg-black object-contain sm:max-h-[520px] md:max-h-[620px]" /> : selectedTask.type === "Audio" ? <div className="m-2 w-[calc(100%-1rem)] min-w-0 max-w-xl rounded-[1.2rem] border border-white/10 bg-white/[0.08] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:m-0 sm:w-full sm:rounded-[1.4rem] sm:p-6"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/45">{t("studio.projects.voiceover")}</p><audio src={selectedTask.mediaUrl} controls className="w-full min-w-0 max-w-full" /></div> : <button type="button" onClick={() => onPreviewImage(selectedTask.mediaUrl || "")} className="block max-h-[420px] max-w-full overflow-hidden rounded-[1.2rem] shadow-[0_30px_90px_rgba(0,0,0,0.38)] transition hover:scale-[1.01] md:max-h-[620px]"><img src={selectedTask.mediaUrl} alt={selectedTask.id} className="max-h-[420px] w-full object-contain md:max-h-[620px]" /></button> : <div className="max-w-sm px-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-lg font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">{selectedTask.status === "Failed" ? "!" : "..."}</div><p className="mt-5 text-base font-semibold text-white">{selectedTask.status === "Failed" ? t("studio.projects.generationFailed") : t("studio.projects.providerCreating")}</p><p className="mt-2 text-sm leading-6 text-white/55">{selectedTask.status === "Failed" ? selectedTask.failureReason || t("studio.projects.refundDefault") : selectedTask.type === "Video" ? t("studio.projects.videoWaitHint", { range: estimatedWaitRange(selectedTask) }) : t("studio.projects.providerCreatingDescription")}</p>{selectedTask.status === "Queued" || selectedTask.status === "Running" ? <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#8b5cf6)] transition-all" style={{ width: `${taskProgress(selectedTask, duration)}%` }} /></div> : null}</div>}
                </div>
              </article>

              <aside className="min-w-0 space-y-2.5 md:space-y-4">
                <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-white p-3 shadow-sm sm:p-4 md:rounded-[1.75rem] md:p-5"><div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">{selectedTask.mediaUrl ? <a href={`/api/generate/download?taskId=${encodeURIComponent(selectedTask.id)}&name=${encodeURIComponent(selectedTask.id)}`} className="flex min-w-0 items-center justify-center rounded-xl bg-[#202633] px-3 py-2.5 text-center text-xs font-semibold text-white sm:rounded-full sm:px-4 sm:py-2 sm:text-sm">{t("studio.projects.download")}</a> : null}<button type="button" onClick={() => { if (selectedTask.prompt) navigator.clipboard.writeText(selectedTask.prompt).catch(() => null); }} className="min-w-0 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-xs font-semibold text-[#202633] sm:rounded-full sm:px-4 sm:py-2 sm:text-sm">{t("studio.projects.copyPrompt")}</button><Link href={regenerateHref(selectedTask)} className="flex min-w-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-center text-xs font-semibold text-[#202633] sm:rounded-full sm:px-4 sm:py-2 sm:text-sm">{selectedTask.status === "Failed" ? t("studio.projects.retry") : t("studio.projects.regenerate")}</Link>{selectedTask.mediaUrl && selectedTask.type !== "Audio" ? <Link href={useAsReferenceHref(selectedTask)} className="flex min-w-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-center text-xs font-semibold text-[#202633] sm:rounded-full sm:px-4 sm:py-2 sm:text-sm">{t("studio.projects.useReference")}</Link> : null}</div></div>
                <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-sm md:rounded-[1.75rem] md:p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7]">{t("studio.projects.prompt")}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#354052]">{selectedTask.prompt || t("studio.projects.noPrompt")}</p></div>
                <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-sm md:rounded-[1.75rem] md:p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7]">{t("studio.projects.details")}</p><dl className="mt-4 space-y-3 text-sm">{[[t("studio.projects.model"), providerLabel(selectedTask.provider)], [t("studio.projects.mode"), typeLabel(selectedTask.type)], [t("studio.projects.created"), formatTaskDate(selectedTask.createdAt)], [t("studio.projects.charged"), `${selectedTask.chargedCredits ?? selectedTask.cost} ${t("studio.common.credits")}`], [t("studio.projects.refund"), selectedTask.refundedCredits ? `${selectedTask.refundedCredits} ${t("studio.common.credits")}` : selectedTask.refundStatus || "not_applicable"], [t("studio.projects.transport"), selectedTask.transport || "real"]].map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 border-b border-black/[0.05] pb-3 last:border-0 last:pb-0"><dt className="min-w-0 break-words font-medium text-[#8b95a7]">{label}</dt><dd className="min-w-0 break-words text-right font-semibold text-[#202633]">{value}</dd></div>)}</dl></div>
              </aside>
            </div>
          ) : <div className="grid min-h-[430px] place-items-center rounded-[1.25rem] border border-dashed border-black/[0.08] bg-white/70 px-5 text-center sm:min-h-[520px] md:min-h-[620px] md:rounded-[1.75rem]"><div><p className="text-lg font-semibold text-[#202633]">{t("studio.projects.start")}</p><p className="mt-2 text-sm text-[#8b95a7]">{t("studio.projects.startDescription")}</p><Link href="/studio?mode=image&workflow=text-to-image" className="mt-5 inline-flex rounded-full bg-[#0ea5e9] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(14,165,233,0.22)]">{t("studio.projects.createNow")}</Link></div></div>}
        </section>
      </div>
    </div>
  );
}
