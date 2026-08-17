"use client";

import Link from "next/link";
import { useState } from "react";

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
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const activeCount = tasks.filter((task) => task.status === "Queued" || task.status === "Running").length;
  const doneCount = tasks.filter((task) => task.status === "Completed").length;
  const failedCount = tasks.filter((task) => task.status === "Failed").length;
  const statusLabel = (status: TaskStatus) => t(`studio.task.${status.toLowerCase()}`);
  const typeLabel = (type: ProjectTask["type"]) => t(`studio.task.${type.toLowerCase()}`);
  const title = (task: ProjectTask) => task.title || task.prompt?.trim().split(/\s+/).slice(0, 8).join(" ") || `${providerLabel(task.provider)} ${task.type}`;
  const copyPrompt = (task: ProjectTask) => {
    if (!task.prompt) return;
    navigator.clipboard.writeText(task.prompt).then(() => {
      setCopiedTaskId(task.id);
      window.setTimeout(() => setCopiedTaskId((current) => current === task.id ? null : current), 1600);
    }).catch(() => null);
  };

  const thumbnail = (task: ProjectTask) => (
    <span className="relative grid h-[66px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-xl border border-[#eaecf0] bg-[linear-gradient(135deg,#f3f1ff,#f7f8fb)] text-lg font-black text-[#6a5af9]">
      {task.mediaUrl && task.type === "Image" ? <img src={task.mediaUrl} alt="" className="h-full w-full object-cover" /> : null}
      {task.mediaUrl && task.type === "Video" ? <video src={task.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : null}
      {task.type === "Audio" ? <span aria-hidden="true">{"\u266b"}</span> : !task.mediaUrl ? <span aria-hidden="true">{task.type === "Video" ? "\u25b6" : "\u2726"}</span> : null}
      {task.status === "Running" || task.status === "Queued" ? <span className="absolute inset-x-0 bottom-0 h-1 bg-[#ede9fe]"><span className="block h-full bg-[#7c69ff]" style={{ width: `${taskProgress(task, duration)}%` }} /></span> : null}
    </span>
  );

  return (
    <div className="w-full min-w-0 max-w-full text-start">
      <section className="mb-4 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
        <div className="flex flex-col gap-4 border-b border-[#f1f3f7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[0.13em] text-[#7c69ff]">{t("studio.projects.eyebrow")}</p><h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#101828]">{t("studio.projects.title")}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#667085] sm:text-sm">{t("studio.projects.description")}</p></div>
          <Link href="/studio?mode=image&workflow=text-to-image" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#744bfb,#6757f6_55%,#7d53ff)] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(106,90,249,0.18)]"><span aria-hidden="true">+</span>{t("studio.projects.new")}</Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#f1f3f7] rtl:divide-x-reverse">
          {[[t("studio.projects.active"), activeCount, "#f59e0b"], [t("studio.projects.done"), doneCount, "#12b76a"], [t("studio.projects.failed"), failedCount, "#f04438"]].map(([label, value, color]) => <div key={label} className="flex min-w-0 items-center justify-center gap-2 px-2 py-3 sm:gap-3 sm:py-4"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: String(color) }} /><strong className="text-lg font-black tabular-nums text-[#101828] sm:text-xl">{value}</strong><span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#98a2b3] sm:text-xs">{label}</span></div>)}
        </div>
      </section>

      {historyNote ? <p className="mb-4 rounded-xl border border-[#e4e7ec] bg-white px-4 py-3 text-xs font-semibold text-[#667085] shadow-sm sm:text-sm">{historyNote}</p> : null}

      <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] xl:order-1">
          <div className="flex items-center justify-between gap-3 border-b border-[#f1f3f7] px-4 py-3.5"><div className="min-w-0"><h3 className="text-sm font-black text-[#101828]">{t("studio.projects.list")}</h3><p className="mt-0.5 truncate text-[11px] text-[#98a2b3]">{t("studio.projects.savedTasks", { count: tasks.length, label: t(tasks.length === 1 ? "studio.projects.task" : "studio.projects.tasks") })}</p></div><span className="rounded-full bg-[#f1efff] px-2.5 py-1.5 text-[10px] font-black text-[#6a5af9]">{tasks.length}</span></div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto p-2.5 xl:max-h-[720px]">
            {tasks.length ? tasks.map((task) => <Link key={task.id} href={projectHref(task.id)} className={`flex min-h-[94px] items-start gap-3 rounded-2xl border p-2.5 text-start transition ${selectedTask?.id === task.id ? "border-[#a99fff] bg-[linear-gradient(135deg,#f5f2ff,#fff)] shadow-[0_0_0_2px_#eeeaff]" : "border-[#eaecf0] bg-white hover:border-[#d7d1ff] hover:bg-[#fbfaff]"}`}>{thumbnail(task)}<span className="min-w-0 flex-1 py-0.5"><span className="flex min-w-0 items-start justify-between gap-2"><strong className="min-w-0 truncate text-[13px] font-black text-[#101828]">{title(task)}</strong><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ring-1 ${statusPillClass(task.status)}`}>{statusLabel(task.status)}</span></span><span className="mt-1 block truncate text-[10px] font-semibold text-[#7b879b]">{providerLabel(task.provider)} · {formatTaskDate(task.createdAt)}</span><span className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold text-[#98a2b3]"><span>{typeLabel(task.type)}</span><span>{task.cost} {t("studio.common.credits")}</span></span></span></Link>) : <div className="m-1 grid min-h-[240px] place-items-center rounded-2xl border border-dashed border-[#d7d1ff] bg-[#faf9ff] px-6 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eeeaff] text-xl text-[#6a5af9]">{"\u2726"}</span><p className="mt-4 text-sm font-black text-[#101828]">{t("studio.projects.none")}</p><p className="mt-2 text-xs leading-5 text-[#7b879b]">{t("studio.projects.empty")}</p></div></div>}
          </div>
        </aside>

        <section className="order-1 min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] sm:p-4 xl:order-2 xl:min-h-[720px]">
          {selectedTask ? (
            <div className="grid h-full min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1fr)_330px]">
              <article className="min-w-0 overflow-hidden rounded-2xl border border-[#202020] bg-[#101010] p-2.5 sm:p-3">
                <div className="mb-3 flex min-w-0 items-start justify-between gap-3 px-1"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/45">{t("studio.projects.preview")}</p><h3 className="mt-1 truncate text-sm font-black text-white sm:text-base">{title(selectedTask)}</h3><p className="mt-1 truncate text-[11px] text-white/45">{providerLabel(selectedTask.provider)} · {typeLabel(selectedTask.type)} · {formatTaskDate(selectedTask.createdAt)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-black ring-1 ${statusPillClass(selectedTask.status)}`}>{statusLabel(selectedTask.status)}</span></div>
                <div className="relative grid min-h-[240px] w-full min-w-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(124,105,255,0.18),transparent_38%),#090909] sm:min-h-[400px] lg:min-h-[560px]">
                  {selectedTask.mediaUrl ? selectedTask.type === "Video" ? <video src={selectedTask.mediaUrl} controls playsInline preload="metadata" className="block max-h-[68dvh] w-full min-w-0 max-w-full bg-black object-contain sm:max-h-[520px] md:max-h-[620px]" /> : selectedTask.type === "Audio" ? <div className="m-2 w-[calc(100%-1rem)] min-w-0 max-w-xl rounded-[1.2rem] border border-white/10 bg-white/[0.08] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:m-0 sm:w-full sm:rounded-[1.4rem] sm:p-6"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/45">{t("studio.projects.voiceover")}</p><audio src={selectedTask.mediaUrl} controls className="w-full min-w-0 max-w-full" /></div> : <button type="button" onClick={() => onPreviewImage(selectedTask.mediaUrl || "")} className="block max-h-[420px] max-w-full overflow-hidden rounded-[1.2rem] shadow-[0_30px_90px_rgba(0,0,0,0.38)] transition hover:scale-[1.01] md:max-h-[620px]"><img src={selectedTask.mediaUrl} alt={selectedTask.id} className="max-h-[420px] w-full object-contain md:max-h-[620px]" /></button> : <div className="max-w-sm px-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-lg font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">{selectedTask.status === "Failed" ? "!" : "..."}</div><p className="mt-5 text-base font-semibold text-white">{selectedTask.status === "Failed" ? t("studio.projects.generationFailed") : t("studio.projects.providerCreating")}</p><p className="mt-2 text-sm leading-6 text-white/55">{selectedTask.status === "Failed" ? selectedTask.failureReason || t("studio.projects.refundDefault") : selectedTask.type === "Video" ? t("studio.projects.videoWaitHint", { range: estimatedWaitRange(selectedTask) }) : t("studio.projects.providerCreatingDescription")}</p>{selectedTask.status === "Queued" || selectedTask.status === "Running" ? <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#8b5cf6)] transition-all" style={{ width: `${taskProgress(selectedTask, duration)}%` }} /></div> : null}</div>}
                </div>
              </article>

              <aside className="min-w-0 space-y-3">
                <div className="min-w-0 rounded-2xl border border-[#eaecf0] bg-white p-3"><div className="grid min-w-0 grid-cols-2 gap-2">{selectedTask.mediaUrl ? <a href={`/api/generate/download?taskId=${encodeURIComponent(selectedTask.id)}&name=${encodeURIComponent(selectedTask.id)}`} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-[#101828] px-3 text-center text-xs font-black text-white">{"\u21e9"} <span className="ms-1">{t("studio.projects.download")}</span></a> : null}<button type="button" onClick={() => copyPrompt(selectedTask)} disabled={!selectedTask.prompt} className="min-h-11 min-w-0 rounded-xl border border-[#e4e7ec] bg-white px-3 text-xs font-black text-[#344054] disabled:opacity-45">{copiedTaskId === selectedTask.id ? "\u2713 " : ""}{t("studio.projects.copyPrompt")}</button><Link href={regenerateHref(selectedTask)} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-[#e4e7ec] bg-white px-3 text-center text-xs font-black text-[#344054]">{selectedTask.status === "Failed" ? t("studio.projects.retry") : t("studio.projects.regenerate")}</Link>{selectedTask.mediaUrl && selectedTask.type !== "Audio" ? <Link href={useAsReferenceHref(selectedTask)} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-[#d7d1ff] bg-[#f5f2ff] px-3 text-center text-xs font-black text-[#6a5af9]">{t("studio.projects.useReference")}</Link> : null}</div></div>
                <div className="min-w-0 rounded-2xl border border-[#eaecf0] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#98a2b3]">{t("studio.projects.prompt")}</p><p className="mt-3 max-h-[210px] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-[#344054]">{selectedTask.prompt || t("studio.projects.noPrompt")}</p></div>
                <div className="min-w-0 rounded-2xl border border-[#eaecf0] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#98a2b3]">{t("studio.projects.details")}</p><dl className="mt-3 space-y-0 text-xs">{[[t("studio.projects.model"), providerLabel(selectedTask.provider)], [t("studio.projects.mode"), typeLabel(selectedTask.type)], [t("studio.projects.created"), formatTaskDate(selectedTask.createdAt)], [t("studio.projects.charged"), `${selectedTask.chargedCredits ?? selectedTask.cost} ${t("studio.common.credits")}`], [t("studio.projects.refund"), selectedTask.refundedCredits ? `${selectedTask.refundedCredits} ${t("studio.common.credits")}` : selectedTask.refundStatus || "not_applicable"], [t("studio.projects.transport"), selectedTask.transport || "real"]].map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 border-b border-[#f1f3f7] py-2.5 first:pt-0 last:border-0 last:pb-0"><dt className="min-w-0 break-words font-semibold text-[#98a2b3]">{label}</dt><dd className="min-w-0 break-words text-end font-bold text-[#344054]">{value}</dd></div>)}</dl></div>
              </aside>
            </div>
          ) : <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-[#d7d1ff] bg-[radial-gradient(circle_at_50%_25%,rgba(124,105,255,0.08),transparent_38%),#faf9ff] px-5 text-center sm:min-h-[620px]"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#eeeaff] text-2xl text-[#6a5af9] shadow-[inset_0_0_0_1px_#ddd7ff]">{"\u2723"}</span><p className="mt-5 text-lg font-black text-[#101828]">{t("studio.projects.start")}</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7b879b]">{t("studio.projects.startDescription")}</p><Link href="/studio?mode=image&workflow=text-to-image" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[linear-gradient(90deg,#744bfb,#6757f6_55%,#7d53ff)] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(106,90,249,0.18)]">{t("studio.projects.createNow")}</Link></div></div>}
        </section>
      </div>
    </div>
  );
}
