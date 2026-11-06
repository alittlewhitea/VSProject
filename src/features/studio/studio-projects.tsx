"use client";

import Link from "./studio-link";
import { missingOutputCopy, formatStudioTaskDate } from "./studio-display-copy";
import { PromptEnhancementHistory } from "./prompt-enhancement-history";
import { useEffect, useRef, useState } from "react";
import { copyStudioText } from "./studio-clipboard";
import { StudioMediaLoadError, useStudioMediaFeedback } from "./studio-media-feedback";

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
  mediaUrls?: string[];
  settings?: Record<string, unknown> | null;
  chargedCredits?: number;
  refundedCredits?: number;
  refundStatus?: "refunded" | "not_refunded" | "not_applicable";
  failureReason?: string | null;
};

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
  if (task.type === "Video" && task.mediaUrl) {
    return `/studio?${new URLSearchParams({mode:"video",workflow:"reference-to-video",provider:"heygen-video",referenceVideo:task.mediaUrl,...(task.prompt ? {prompt:task.prompt} : {})}).toString()}`;
  }
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
  locale?: string;
  tasks: ProjectTask[];
  selectedTask: ProjectTask | null;
  historyNote: string;
  duration: string;
  providerLabel: (provider?: string) => string;
  onPreviewImage: (url: string) => void;
};

export function StudioProjects({ t, tasks, selectedTask:baseSelectedTask, historyNote, duration, providerLabel, onPreviewImage, locale = "en" }: StudioProjectsProps) {
  const [outputIndex,setOutputIndex]=useState(0);
  const outputImages=baseSelectedTask?.type==="Image"?baseSelectedTask.mediaUrls||[]:[];
  const selectedTask=baseSelectedTask?{...baseSelectedTask,mediaUrl:outputImages[outputIndex]||baseSelectedTask.mediaUrl}:null;
  useEffect(()=>setOutputIndex(0),[baseSelectedTask?.id]);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [manualTaskId, setManualTaskId] = useState<string | null>(null);
  const manualCopyRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const mediaFeedback = useStudioMediaFeedback(selectedTask?.mediaUrl);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => { setCopiedTaskId(null); setManualTaskId(null); }, [selectedTask?.id]);
  useEffect(() => {
    if (manualTaskId === selectedTask?.id) { manualCopyRef.current?.focus(); manualCopyRef.current?.select(); }
  }, [manualTaskId, selectedTask?.id]);
  const activeCount = tasks.filter((task) => task.status === "Queued" || task.status === "Running").length;
  const doneCount = tasks.filter((task) => task.status === "Completed").length;
  const failedCount = tasks.filter((task) => task.status === "Failed").length;
  const statusLabel = (status: TaskStatus) => t(`studio.task.${status.toLowerCase()}`);
  const typeLabel = (type: ProjectTask["type"]) => t(`studio.task.${type.toLowerCase()}`);
  const title = (task: ProjectTask) => task.title || task.prompt?.trim().split(/\s+/).slice(0, 8).join(" ") || `${providerLabel(task.provider)} ${task.type}`;
  const copyPrompt = async (task: ProjectTask) => {
    if (!task.prompt) return;
    setManualTaskId(null);
    try {
      await copyStudioText(task.prompt);
      if (!mounted.current) return;
      setCopiedTaskId(task.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedTaskId((current) => current === task.id ? null : current), 1600);
    } catch {
      if (mounted.current) { setCopiedTaskId(null); setManualTaskId(task.id); }
    }
  };

  const thumbnail = (task: ProjectTask) => (
    <span className="relative grid h-[66px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] text-lg font-semibold text-[var(--studio-accent)]">
      {task.mediaUrl && task.type === "Image" ? <img src={task.mediaUrl} alt="" className="h-full w-full object-cover" /> : null}
      {task.mediaUrl && task.type === "Video" ? <video src={task.mediaUrl} muted playsInline preload="none" className="h-full w-full object-cover" /> : null}
      {task.type === "Audio" ? <span aria-hidden="true">{"\u266b"}</span> : !task.mediaUrl ? <span aria-hidden="true">{task.type === "Video" ? "\u25b6" : "\u2726"}</span> : null}
      {task.status === "Running" || task.status === "Queued" ? <span className="absolute inset-x-0 bottom-0 h-1 bg-[var(--studio-accent-soft)]"><span className="block h-full bg-[var(--studio-accent-soft)]" style={{ width: `${taskProgress(task, duration)}%` }} /></span> : null}
    </span>
  );

  return (
    <div className="df-projects w-full min-w-0 max-w-full text-start">
      <section className="mb-4 overflow-hidden rounded-[20px] border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none">
        <div className="flex flex-col gap-4 border-b border-[var(--studio-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--studio-accent)]">{t("studio.projects.eyebrow")}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--studio-text)]">{t("studio.projects.title")}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--studio-muted)] sm:text-sm">{t("studio.projects.description")}</p></div>
          <Link href="/studio?mode=image&workflow=text-to-image" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--studio-primary)] px-5 text-sm font-semibold text-white shadow-none"><span aria-hidden="true">+</span>{t("studio.projects.new")}</Link>
        </div>
        <div className="df-project-status-strip grid grid-cols-3 divide-x divide-[#f1f3f7] rtl:divide-x-reverse">
          {[[t("studio.projects.active"), activeCount, "#f59e0b"], [t("studio.projects.done"), doneCount, "#12b76a"], [t("studio.projects.failed"), failedCount, "#f04438"]].map(([label, value, color]) => <div key={label} className="flex min-w-0 items-center justify-center gap-2 px-2 py-3 sm:gap-3 sm:py-4"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: String(color) }} /><strong className="text-lg font-semibold tabular-nums text-[var(--studio-text)] sm:text-xl">{value}</strong><span className="truncate text-xs font-bold uppercase tracking-[0.08em] text-[var(--studio-muted)] sm:text-xs">{label}</span></div>)}
        </div>
      </section>

      {historyNote ? <p className="mb-4 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-3 text-xs font-semibold text-[var(--studio-muted)] shadow-sm sm:text-sm">{historyNote}</p> : null}

      <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 overflow-hidden rounded-[20px] border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none xl:order-1">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--studio-border)] px-4 py-3.5"><div className="min-w-0"><h3 className="text-sm font-semibold text-[var(--studio-text)]">{t("studio.projects.list")}</h3><p className="mt-0.5 truncate text-[11px] text-[var(--studio-muted)]">{t("studio.projects.savedTasks", { count: tasks.length, label: t(tasks.length === 1 ? "studio.projects.task" : "studio.projects.tasks") })}</p></div><span className="rounded-full bg-[var(--studio-accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--studio-accent)]">{tasks.length}</span></div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto p-2.5 xl:max-h-[720px]">
            {tasks.length ? tasks.map((task) => <Link key={task.id} href={projectHref(task.id)} className={`flex min-h-[94px] items-start gap-3 rounded-2xl border p-2.5 text-start transition ${selectedTask?.id === task.id ? "border-[var(--studio-accent-border)] bg-[var(--studio-surface)] shadow-none" : "border-[var(--studio-border)] bg-[var(--studio-panel)] hover:border-[var(--studio-accent-border)] hover:bg-[var(--studio-accent-soft)]"}`}>{thumbnail(task)}<span className="min-w-0 flex-1 py-0.5"><span className="flex min-w-0 items-start justify-between gap-2"><strong className="min-w-0 truncate text-[13px] font-semibold text-[var(--studio-text)]">{title(task)}</strong><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ring-1 ${statusPillClass(task.status)}`}>{statusLabel(task.status)}</span></span><span className="mt-1 block truncate text-xs font-semibold text-[var(--studio-muted)]">{providerLabel(task.provider)} · {formatStudioTaskDate(task.createdAt, locale)}</span><span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-[var(--studio-muted)]"><span>{typeLabel(task.type)}</span><span>{task.cost} {t("studio.common.credits")}</span></span></span></Link>) : <div className="m-1 grid min-h-[240px] place-items-center rounded-2xl border border-dashed border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-6 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--studio-accent-soft)] text-xl text-[var(--studio-accent)]">{"\u2726"}</span><p className="mt-4 text-sm font-semibold text-[var(--studio-text)]">{t("studio.projects.none")}</p><p className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{t("studio.projects.empty")}</p></div></div>}
          </div>
        </aside>

        <section className="order-1 min-w-0 overflow-hidden rounded-[20px] border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 shadow-none sm:p-4 xl:order-2 xl:min-h-[720px]">
          {selectedTask ? (
            <div className="grid h-full min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1fr)_330px]">
              <article className="df-project-media min-w-0 overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--df-stage)] p-2.5 sm:p-3">
                <div className="mb-3 flex min-w-0 items-start justify-between gap-3 px-1"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--df-stage-muted)]">{t("studio.projects.preview")}</p><h3 className="mt-1 truncate text-sm font-semibold text-white sm:text-base">{title(selectedTask)}</h3><p className="mt-1 truncate text-[11px] text-[var(--df-stage-muted)]">{providerLabel(selectedTask.provider)} · {typeLabel(selectedTask.type)} · {formatStudioTaskDate(selectedTask.createdAt, locale)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-1 ${statusPillClass(selectedTask.status)}`}>{statusLabel(selectedTask.status)}</span></div>
                <div className="relative grid min-h-[240px] w-full min-w-0 place-items-center overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[radial-gradient(circle_at_50%_35%,rgba(124,105,255,0.18),transparent_38%),#090909] sm:min-h-[400px] lg:min-h-[560px]">
                  {mediaFeedback.failed ? <StudioMediaLoadError translate={t} onRetry={mediaFeedback.retry} originalUrl={selectedTask.mediaUrl || undefined} /> : null}
                  {selectedTask.mediaUrl ? selectedTask.type === "Video" ? <video key={mediaFeedback.mediaKey} onError={mediaFeedback.onError} hidden={mediaFeedback.failed} src={selectedTask.mediaUrl} controls playsInline preload="metadata" className="block max-h-[68dvh] w-full min-w-0 max-w-full bg-black object-contain sm:max-h-[520px] md:max-h-[620px]" /> : selectedTask.type === "Audio" ? <div hidden={mediaFeedback.failed} className="m-2 w-[calc(100%-1rem)] min-w-0 max-w-xl rounded-[1.2rem] border border-[var(--studio-border)] bg-white/[0.08] p-4 text-white shadow-none sm:m-0 sm:w-full sm:rounded-[1.4rem] sm:p-6"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--df-stage-muted)]">{t("studio.projects.voiceover")}</p><audio key={mediaFeedback.mediaKey} onError={mediaFeedback.onError} src={selectedTask.mediaUrl} controls className="w-full min-w-0 max-w-full" /></div> : <button type="button" hidden={mediaFeedback.failed} onClick={() => onPreviewImage(selectedTask.mediaUrl || "")} className="block max-h-[420px] max-w-full overflow-hidden rounded-[1.2rem] shadow-none transition hover:scale-[1.01] md:max-h-[620px]"><img key={mediaFeedback.mediaKey} onError={mediaFeedback.onError} src={selectedTask.mediaUrl} alt={selectedTask.id} className="max-h-[420px] w-full object-contain md:max-h-[620px]" /></button> : <div className="max-w-sm px-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--studio-panel)] text-lg font-semibold text-white shadow-none">{selectedTask.status === "Failed" ? "!" : "..."}</div><p className="mt-5 text-base font-semibold text-white">{selectedTask.status === "Failed" ? t("studio.projects.generationFailed") : selectedTask.status === "Completed" ? t("studio.task.completed") : t("studio.projects.providerCreating")}</p><p className="mt-2 text-sm leading-6 text-[var(--df-stage-muted)]">{selectedTask.status === "Failed" ? selectedTask.failureReason || t("studio.projects.refundDefault") : selectedTask.status === "Completed" ? missingOutputCopy(locale) : selectedTask.type === "Video" ? t("studio.projects.videoWaitHint", { range: estimatedWaitRange(selectedTask) }) : t("studio.projects.providerCreatingDescription")}</p>{selectedTask.status === "Queued" || selectedTask.status === "Running" ? <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--studio-panel)]"><div className="h-full rounded-full bg-[var(--studio-primary)] transition-all" style={{ width: `${taskProgress(selectedTask, duration)}%` }} /></div> : null}</div>}
                </div>
                {outputImages.length>1?<div data-project-image-outputs className="df-stage-history mt-3">{outputImages.map((url,index)=><button type="button" key={url+index} className="df-stage-thumbnail" aria-label={`${t("studio.reference.image")} ${index+1}`} aria-pressed={outputIndex===index} onClick={()=>setOutputIndex(index)}><img src={url} alt="" loading="lazy" /><span>{index+1}</span></button>)}</div>:null}
              </article>

              <aside className="min-w-0 space-y-3">
                <div className="min-w-0 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3"><div className="grid min-w-0 grid-cols-2 gap-2">{selectedTask.mediaUrl ? <a href={`/api/generate/download?taskId=${encodeURIComponent(selectedTask.id)}&name=${encodeURIComponent(selectedTask.id)}&index=${selectedTask.type==="Image"&&outputIndex<outputImages.length?outputIndex:0}`} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-[var(--studio-primary)] px-3 text-center text-xs font-semibold text-white">{"\u21e9"} <span className="ms-1">{t("studio.projects.download")}</span></a> : null}<button type="button" onClick={() => copyPrompt(selectedTask)} disabled={!selectedTask.prompt} className="min-h-11 min-w-0 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-xs font-semibold text-[var(--studio-text)] disabled:opacity-45">{copiedTaskId === selectedTask.id ? "\u2713 " : ""}{t("studio.projects.copyPrompt")}</button><Link href={regenerateHref(selectedTask)} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-center text-xs font-semibold text-[var(--studio-text)]">{selectedTask.status === "Failed" ? t("studio.projects.retry") : t("studio.projects.regenerate")}</Link>{selectedTask.mediaUrl && selectedTask.type !== "Audio" ? <Link href={useAsReferenceHref(selectedTask)} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-3 text-center text-xs font-semibold text-[var(--studio-accent)]">{t("studio.projects.useReference")}</Link> : null}</div></div>
                <div className="min-w-0 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--studio-muted)]">{t("studio.projects.prompt")}</p><span role="status" className="sr-only">{copiedTaskId === selectedTask.id ? t("studio.gallery.copyDone") : ""}</span>
                {manualTaskId === selectedTask.id ? <><p role="alert" className="mt-3 text-sm text-[var(--studio-text)]">{t("studio.gallery.copyFailed")}</p><textarea ref={manualCopyRef} readOnly value={selectedTask.prompt || ""} dir="auto" aria-label={t("studio.projects.prompt")} rows={5} onFocus={event => event.currentTarget.select()} className="mt-3 w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-sm text-[var(--studio-text)]" /></> : <p className="mt-3 max-h-[210px] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-[var(--studio-text)]">{selectedTask.prompt || t("studio.projects.noPrompt")}</p>}<PromptEnhancementHistory settings={selectedTask.settings} translate={t} /></div>
                <div className="min-w-0 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--studio-muted)]">{t("studio.projects.details")}</p><dl className="mt-3 space-y-0 text-xs">{[[t("studio.projects.model"), providerLabel(selectedTask.provider)], [t("studio.projects.mode"), typeLabel(selectedTask.type)], [t("studio.projects.created"), formatStudioTaskDate(selectedTask.createdAt, locale)], [t("studio.projects.charged"), `${selectedTask.chargedCredits ?? selectedTask.cost} ${t("studio.common.credits")}`], [t("studio.projects.refund"), selectedTask.refundedCredits ? `${selectedTask.refundedCredits} ${t("studio.common.credits")}` : selectedTask.refundStatus || "not_applicable"], [t("studio.projects.transport"), selectedTask.transport || "real"]].map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 border-b border-[var(--studio-border)] py-2.5 first:pt-0 last:border-0 last:pb-0"><dt className="min-w-0 break-words font-semibold text-[var(--studio-muted)]">{label}</dt><dd className="min-w-0 break-words text-end font-bold text-[var(--studio-text)]">{value}</dd></div>)}</dl></div>
              </aside>
            </div>
          ) : <div className="df-project-empty grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-[var(--studio-border)] bg-[var(--df-surface)] px-5 text-center sm:min-h-[620px]"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--studio-accent-soft)] text-2xl text-[var(--studio-accent)] shadow-none">{"\u2723"}</span><p className="mt-5 text-lg font-semibold text-[var(--studio-text)]">{t("studio.projects.start")}</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--studio-muted)]">{t("studio.projects.startDescription")}</p><Link href="/studio?mode=image&workflow=text-to-image" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--studio-primary)] px-5 text-sm font-semibold text-white shadow-none">{t("studio.projects.createNow")}</Link></div></div>}
        </section>
      </div>
    </div>
  );
}
