"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
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

  return (
    <div className="w-full max-w-full text-start">
      <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(450px,0.84fr)_minmax(520px,1.16fr)]">
        <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] [&>div+div]:border-t [&>div+div]:border-[#f1f3f7]">
          {modelSelector ? <div className="p-4">{modelSelector}</div> : null}
          {editor}
          {settings}
        </section>

        <section className="min-h-[420px] min-w-0 self-start overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] sm:min-h-[500px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs font-bold text-[#667085]">{avatarSamplePreviewUrl ? "Kling Avatar" : translate("studio.nav.avatar")} <span className="mx-1 text-[#c0c4ce]">{"\u2022"}</span> {avatarSamplePreviewUrl ? translate("studio.workbench.example") : translate("studio.workbench.preview")}</span>
            {avatarSamplePreviewUrl ? <span className="rounded-[9px] bg-[#f1efff] px-2.5 py-1.5 text-[10px] font-bold text-[#6a5af9]">{translate("studio.workbench.preview")}</span> : null}
          </div>

          {avatarSamplePreviewUrl ? (
            <>
              <video src={avatarSamplePreviewUrl} controls muted playsInline preload="metadata" className="aspect-video w-full rounded-xl border border-[#191919] bg-[#121212] object-cover sm:rounded-2xl" />
              <p className="mt-3 text-xs leading-5 text-[#667085]">{translate("studio.workbench.avatarExampleNote")}</p>
            </>
          ) : (
            <div aria-label={translate("studio.workbench.preview")} className="grid min-h-[340px] place-items-center rounded-xl border border-dashed border-[#e4e0f4] bg-[radial-gradient(circle_at_50%_35%,rgba(123,97,255,0.055),transparent_42%),#fbfbfd] sm:min-h-[430px] sm:rounded-2xl">
              <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl border border-[#ebe8f7] bg-white text-xl text-[#b7aecf] shadow-[0_8px_28px_rgba(78,63,140,0.06)]">{"\u2726"}</span>
            </div>
          )}
        </section>
      </div>

      {recentTasks.length ? <section className="mt-4 rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 items-center gap-2.5"><strong className="shrink-0 text-[15px] text-[#101828]">{translate("studio.workbench.recent")}</strong><span className="truncate text-xs text-[#667085]">{translate("studio.workbench.latest")}</span></div><Link href="/studio?view=projects" className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{translate("studio.workbench.allProjects")} {"\u2304"}</Link></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {recentTasks.map((task) => <Link key={task.id} href={`/studio?view=projects&taskId=${encodeURIComponent(task.id)}`} className="min-w-0"><div className="relative aspect-video overflow-hidden rounded-xl border border-[#eaecf0] bg-[#f6f7fb]"><video src={task.mediaUrl || undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" /><span className="absolute bottom-3 start-3 grid h-[30px] w-[30px] place-items-center rounded-full bg-black/55 text-[11px] text-white">{"\u25B6"}</span></div><div className="mt-2 text-[13px] font-bold text-[#101828]"><span className="block truncate">{task.title || task.prompt || translate("studio.nav.avatar")}</span></div><div className="mt-1 text-[11px] text-[#98a2b3]">{formatTaskDate(task.createdAt)}</div></Link>)}
        </div>
      </section> : null}
    </div>
  );
}
