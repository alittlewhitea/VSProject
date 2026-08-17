"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { TaskItem } from "./studio-storage";

type WorkbenchMode = "image" | "audio" | "avatar";

type UnifiedWorkbenchLayoutProps = {
  mode: WorkbenchMode;
  editor: ReactNode;
  settings: ReactNode;
  modelSelector?: ReactNode;
  tasks: TaskItem[];
  avatarSamplePreviewUrl?: string;
  translate: (key: string, values?: Record<string, string | number | null | undefined>) => string;
};

function formatTaskDate(value?: string) {
  if (!value) return "Sample creation";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent creation";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function UnifiedWorkbenchLayout({
  mode,
  editor,
  settings,
  modelSelector,
  tasks,
  avatarSamplePreviewUrl,
  translate
}: UnifiedWorkbenchLayoutProps) {
  const taskType = mode === "avatar" ? "Video" : mode === "image" ? "Image" : "Audio";
  const recentTasks = useMemo(() => tasks.filter((task) => {
    if (task.type !== taskType) return false;
    if (mode !== "avatar") return true;
    return Boolean(task.mediaUrl) && (task.settings?.mode === "avatar" || task.settings?.videoWorkflow === "avatar-video");
  }).slice(0, 5), [mode, taskType, tasks]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedTask = recentTasks[selectedIndex] || null;
  const avatarPreview = mode === "avatar" ? selectedTask?.mediaUrl : null;

  const moveSelection = (direction: number) => {
    const count = Math.max(1, recentTasks.length);
    setSelectedIndex((current) => (current + direction + count) % count);
  };

  if (mode === "image") {
    return (
      <div className="w-full max-w-full text-start">
        <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(520px,1.2fr)_minmax(360px,0.8fr)]">
          <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
            {editor}
          </section>
          <section className="min-w-0 self-start overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
            <div className="border-b border-[#f1f3f7] px-4 py-3"><strong className="text-sm text-[#101828]">{translate("studio.workbench.settings")}</strong><span className="ms-2 text-xs text-[#667085]">{translate("studio.workbench.modelOutput")}</span></div>
            {settings}
          </section>
        </div>
      </div>
    );
  }

  if (mode === "audio") {
    return (
      <div className="w-full max-w-full text-start">
        <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(520px,1.2fr)_minmax(360px,0.8fr)]">
          <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
            {editor}
          </section>
          <section className="min-w-0 self-start overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
            <div className="border-b border-[#f1f3f7] px-4 py-3"><strong className="text-sm text-[#101828]">{translate("studio.workbench.settings")}</strong><span className="ms-2 text-xs text-[#667085]">{translate("studio.workbench.modelOutput")}</span></div>
            {settings}
          </section>
        </div>
      </div>
    );
  }

  if (mode === "avatar" && !recentTasks.length && avatarSamplePreviewUrl) {
    return (
      <div className="w-full max-w-full text-start">
        <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(450px,0.84fr)_minmax(520px,1.16fr)]">
          <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] [&>div+div]:border-t [&>div+div]:border-[#f1f3f7]">{modelSelector ? <div className="p-4">{modelSelector}</div> : null}{editor}{settings}</section>
          <section className="min-w-0 self-start overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
            <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-bold text-[#667085]">Kling Avatar <span className="mx-1 text-[#c0c4ce]">{"\u2022"}</span> {translate("studio.workbench.example")}</span><span className="rounded-[9px] bg-[#f1efff] px-2.5 py-1.5 text-[10px] font-bold text-[#6a5af9]">{translate("studio.workbench.preview")}</span></div>
            <video src={avatarSamplePreviewUrl} controls muted playsInline preload="metadata" className="aspect-video w-full rounded-xl border border-[#191919] bg-[#121212] object-cover sm:rounded-2xl" />
            <p className="mt-3 text-xs leading-5 text-[#667085]">{translate("studio.workbench.avatarExampleNote")}</p>
          </section>
        </div>
      </div>
    );
  }

  if (mode === "avatar" && !recentTasks.length) {
    return (
      <div className="w-full max-w-full text-start">
        <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(520px,1.2fr)_minmax(360px,0.8fr)]">
          <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">{modelSelector ? <div className="p-4">{modelSelector}</div> : null}{editor}</section>
          <section className="min-w-0 self-start overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]"><div className="border-b border-[#f1f3f7] px-4 py-3"><strong className="text-sm text-[#101828]">{translate("studio.workbench.settings")}</strong><span className="ms-2 text-xs text-[#667085]">{translate("studio.workbench.modelOutput")}</span></div>{settings}</section>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full text-start">
      <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(450px,0.84fr)_minmax(520px,1.16fr)]">
        <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] [&>div+div]:border-t [&>div+div]:border-[#f1f3f7]">
          {modelSelector ? <div className="p-4">{modelSelector}</div> : null}
          {editor}
          {settings}
        </section>

        <section className="min-h-[550px] min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs font-bold text-[#667085]">{translate("studio.nav.avatar")} <span className="mx-1 text-[#c0c4ce]">{"\u2022"}</span> {translate("studio.nav.video")}</span>
            <div className="flex gap-1.5 sm:gap-2">
              {avatarPreview ? <a href={avatarPreview} download aria-label={translate("studio.projects.download")} className="inline-flex h-11 items-center gap-1 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{"\u21E9"}<span className="hidden sm:inline">{translate("studio.projects.download")}</span></a> : null}
              <Link href="/studio?view=projects" aria-label={translate("studio.workbench.openProjects")} className="grid h-11 min-w-11 place-items-center rounded-[10px] border border-[#eaecf0] bg-white px-2 text-sm text-[#344054]">{"\u26F6"}</Link>
            </div>
          </div>

          <video key={avatarPreview} src={avatarPreview || undefined} controls muted playsInline preload="metadata" className="aspect-video w-full rounded-xl border border-[#191919] bg-[#121212] object-cover sm:aspect-[16/8.1] sm:rounded-2xl" />

          <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5 sm:gap-2.5">
            <button type="button" aria-label={translate("studio.workbench.previous")} onClick={() => moveSelection(-1)} className="h-11 w-11 rounded-full border border-[#eaecf0] bg-white text-[#475467]">{"\u2039"}</button>
            <div className="grid min-w-0 grid-cols-3 gap-1.5 p-0.5 sm:flex sm:gap-2.5 sm:overflow-x-auto">
              {recentTasks.slice(0, 3).map((task, index) => <button key={task.id} type="button" onClick={() => setSelectedIndex(index)} className={`relative aspect-video min-w-0 w-full overflow-hidden rounded-[8px] border bg-[#f6f7fb] transition hover:-translate-y-px sm:min-w-[128px] sm:flex-1 sm:rounded-[10px] ${selectedIndex === index ? "border-white shadow-[0_0_0_2px_#7a6cff]" : "border-[#eaecf0]"}`}><video src={task.mediaUrl || undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" /><span className="absolute start-1 top-1 rounded-md bg-white/90 px-1 py-0.5 text-[8px] font-extrabold text-[#344054] sm:start-1.5 sm:top-1.5 sm:px-1.5 sm:py-1 sm:text-[9px]">{translate("studio.nav.avatar")}</span></button>)}
            </div>
            <button type="button" aria-label={translate("studio.workbench.next")} onClick={() => moveSelection(1)} className="h-11 w-11 rounded-full border border-[#eaecf0] bg-white text-[#475467]">{"\u203A"}</button>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 items-center gap-2.5"><strong className="shrink-0 text-[15px] text-[#101828]">{translate("studio.workbench.recent")}</strong><span className="truncate text-xs text-[#667085]">{translate("studio.workbench.latest")}</span></div><Link href="/studio?view=projects" className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{translate("studio.workbench.allProjects")} {"\u2304"}</Link></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {recentTasks.map((task) => <Link key={task.id} href={`/studio?view=projects&taskId=${encodeURIComponent(task.id)}`} className="min-w-0"><div className="relative aspect-video overflow-hidden rounded-xl border border-[#eaecf0] bg-[#f6f7fb]"><video src={task.mediaUrl || undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" /><span className="absolute bottom-3 start-3 grid h-[30px] w-[30px] place-items-center rounded-full bg-black/55 text-[11px] text-white">{"\u25B6"}</span></div><div className="mt-2 text-[13px] font-bold text-[#101828]"><span className="block truncate">{task.title || task.prompt || translate("studio.nav.avatar")}</span></div><div className="mt-1 text-[11px] text-[#98a2b3]">{formatTaskDate(task.createdAt)}</div></Link>)}
        </div>
      </section>
    </div>
  );
}
