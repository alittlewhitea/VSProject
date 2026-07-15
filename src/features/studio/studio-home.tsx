"use client";

import Link from "next/link";
import { StudioIcon, type StudioIconName } from "./studio-navigation";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type HomeTask = {
  id: string;
  type: "Image" | "Video" | "Audio";
  status: "Queued" | "Running" | "Completed" | "Failed";
  title?: string | null;
  prompt?: string;
  mediaUrl?: string | null;
};

const VIDEO_BASE_URL = "https://media.dreamface.io/ai_video";
const SHOWCASES: Array<{
  key: "baseball" | "cgi" | "tokyo" | "spectator";
  file: string;
  prompt: string;
  labelKey: string;
  titleKey: string;
  metaKey: string;
  desktopRatio?: "16x9" | "1x1";
}> = [
  { key: "baseball", file: "baseball-game-broadcast-shot", prompt: "A baseball game broadcast shot - person sits in stadium stands in a team jersey, watching the field and posing softly like a viral stargirl moment caught on live TV.", labelKey: "studio.workspace.showcase.baseball.label", titleKey: "studio.workspace.showcase.baseball.title", metaKey: "studio.workspace.showcase.baseball.meta" },
  { key: "cgi", file: "cgi-breakdown-reveal", prompt: "CGI breakdown reveal - mesh to beauty pass, each render layer cuts in sequence, turntable camera, ending on the final polished visual.", labelKey: "studio.workspace.showcase.cgi.label", titleKey: "studio.workspace.showcase.cgi.title", metaKey: "studio.workspace.showcase.cgi.meta" },
  { key: "tokyo", file: "tokyo-night-street-racing", prompt: "Tokyo night street racing - cars drift and donut around the character, low angles and 35mm film grain, blockbuster reveal.", labelKey: "studio.workspace.showcase.tokyo.label", titleKey: "studio.workspace.showcase.tokyo.title", metaKey: "studio.workspace.showcase.tokyo.meta" },
  { key: "spectator", file: "spectator-sprints-from-the-stands", prompt: "Spectator sprints from the stands, jumps fences, evades security, charges onto the pitch and strikes - all in one continuous telephoto take.", labelKey: "studio.workspace.showcase.spectator.label", titleKey: "studio.workspace.showcase.spectator.title", metaKey: "studio.workspace.showcase.spectator.meta", desktopRatio: "1x1" }
];

const INTENTS: Array<{ title: string; body: string; href: string; icon: StudioIconName; color: string; tools: string[] }> = [
  { title: "studio.workspace.intent.video", body: "studio.workspace.intent.videoBody", href: "/studio?mode=video&workflow=text-to-video&duration=5s", icon: "film", color: "bg-[#eef2ff] text-[#4f46e5]", tools: ["studio.workflow.text-to-video", "studio.workflow.image-to-video"] },
  { title: "studio.workspace.intent.image", body: "studio.workspace.intent.imageBody", href: "/studio?mode=image&workflow=text-to-image", icon: "sparkles", color: "bg-[#ecfeff] text-[#0891b2]", tools: ["studio.workflow.text-to-image", "studio.workflow.image-to-image"] },
  { title: "studio.workspace.intent.avatar", body: "studio.workspace.intent.avatarBody", href: "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video", icon: "video", color: "bg-[#fdf2f8] text-[#db2777]", tools: ["studio.nav.avatar"] },
  { title: "studio.workspace.intent.enhance", body: "studio.workspace.intent.enhanceBody", href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image", icon: "cleanup", color: "bg-[#f0fdf4] text-[#16a34a]", tools: ["studio.workflow.enhance-cleanup"] },
  { title: "studio.workflow.background-remove", body: "studio.home.quick.remove", href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove", icon: "cleanup", color: "bg-[#fff7ed] text-[#ea580c]", tools: ["studio.workflow.background-remove"] },
  { title: "studio.workflow.text-to-audio", body: "studio.home.quick.audio", href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio", color: "bg-[#f5f3ff] text-[#7c3aed]", tools: ["studio.workflow.text-to-audio"] },
  { title: "studio.workflow.text-to-music", body: "studio.music.promptDescription", href: "/studio?mode=audio&workflow=text-to-music&provider=minimax-music-2.6", icon: "audio", color: "bg-[#fefce8] text-[#ca8a04]", tools: ["studio.workflow.text-to-music"] }
];

function showcaseHref(prompt: string) {
  return `/studio?mode=video&workflow=text-to-video&duration=5s&prompt=${encodeURIComponent(prompt)}`;
}

function ShowcaseVideo({ file, desktopRatio = "16x9", mobileRatio = "1x1", className = "" }: { file: string; desktopRatio?: "16x9" | "1x1"; mobileRatio?: "16x9" | "1x1"; className?: string }) {
  return (
    <video autoPlay muted loop playsInline preload="metadata" className={className}>
      <source media="(max-width: 639px)" src={`${VIDEO_BASE_URL}/${mobileRatio}/${file}-${mobileRatio}.mp4`} type="video/mp4" />
      <source src={`${VIDEO_BASE_URL}/${desktopRatio}/${file}-${desktopRatio}.mp4`} type="video/mp4" />
    </video>
  );
}

function ShowcaseGrid({ t, mobile = false }: { t: Translate; mobile?: boolean }) {
  return (
    <div className={mobile ? "grid gap-4 lg:hidden" : "hidden grid-cols-2 gap-3 md:gap-4 lg:grid"}>
      {SHOWCASES.map((item) => (
        <Link key={`${mobile ? "mobile-" : ""}${item.key}`} href={showcaseHref(item.prompt)} className={mobile ? "group relative block aspect-video overflow-hidden rounded-[1.5rem] bg-[#0f172a] shadow-[0_18px_46px_rgba(15,23,42,0.14)]" : "group relative min-h-[205px] overflow-hidden rounded-[1.5rem] bg-[#0f172a] shadow-[0_16px_42px_rgba(15,23,42,0.12)] transition hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(15,23,42,0.18)] md:min-h-[240px]"}>
          <ShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} mobileRatio={mobile ? item.desktopRatio : undefined} className={`absolute inset-0 h-full w-full object-cover ${mobile ? "" : "transition duration-700 group-hover:scale-[1.04]"}`} />
          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.02),rgba(15,23,42,0.84))]" />
          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">{t(item.labelKey)}</span>
          <span className="absolute inset-x-4 bottom-4 text-white"><strong className={`block font-black leading-tight ${mobile ? "text-lg" : "text-base md:text-lg"}`}>{t(item.titleKey)}</strong><span className="mt-1 block text-xs font-semibold text-white/72">{t(item.metaKey)}</span></span>
        </Link>
      ))}
    </div>
  );
}

export function StudioHome({ t, tasks, onUpgrade }: { t: Translate; tasks: HomeTask[]; onUpgrade: () => void }) {
  const taskTypeLabel = (type: HomeTask["type"]) => t(`studio.task.${type.toLowerCase()}`);
  const taskStatusLabel = (status: HomeTask["status"]) => t(`studio.task.${status.toLowerCase()}`);

  return (
    <div className="mx-auto mt-5 w-full min-w-0 max-w-7xl pb-8 md:mt-8">
      <section className="grid gap-5 lg:grid-cols-[1.06fr_0.94fr]">
        <div className="relative flex min-h-[430px] flex-col justify-between overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(242,244,255,0.94)_48%,rgba(232,252,255,0.92))] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.09)] md:p-11">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.2),transparent_66%)]" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-[#2563eb]">{t("studio.workspace.badge")}</span>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#94a3b8]">{t("studio.workspace.eyebrow")}</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#0f172a] md:text-6xl">{t("studio.workspace.heroTitle")} <span className="bg-[linear-gradient(100deg,#4f46e5,#06b6d4)] bg-clip-text text-transparent">{t("studio.workspace.heroAccent")}</span></h2>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#526174] md:text-lg">{t("studio.workspace.heroBody")}</p>
          </div>
          <div className="relative mt-9">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/studio?mode=video&workflow=text-to-video&duration=5s" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f172a] px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5">{t("studio.workspace.start")}<StudioIcon name="chevron-right" className="h-4 w-4" /></Link>
              <a href="#workspace-examples" className="inline-flex items-center justify-center rounded-2xl border border-black/[0.08] bg-white/80 px-6 py-4 text-sm font-black text-[#334155] transition hover:bg-white">{t("studio.workspace.examples")}</a>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{["studio.workflow.image-to-video", "studio.workspace.productAds", "studio.nav.avatar", "studio.workflow.enhance-cleanup"].map((key) => <span key={key} className="rounded-full border border-black/[0.06] bg-white/74 px-3 py-2 text-xs font-black text-[#526174] shadow-sm">{t(key)}</span>)}</div>
          </div>
        </div>
        <ShowcaseGrid t={t} mobile />
        <ShowcaseGrid t={t} />
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-black tracking-tight text-[#0f172a] md:text-3xl">{t("studio.workspace.intentTitle")}</h2>
        <p className="mt-2 text-sm font-semibold text-[#8490a3]">{t("studio.workspace.intentHint")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {INTENTS.map((item) => <Link key={item.title} href={item.href} className="group rounded-[1.5rem] border border-black/[0.06] bg-white/76 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-[#c7d2fe] hover:bg-white hover:shadow-[0_22px_52px_rgba(15,23,42,0.09)]"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${item.color}`}><StudioIcon name={item.icon} className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-black tracking-tight text-[#0f172a]">{t(item.title)}</h3><p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-[#667085]">{t(item.body)}</p><div className="mt-5 flex flex-wrap gap-2">{item.tools.map((tool) => <span key={tool} className="rounded-full bg-[#f1f5f9] px-2.5 py-1.5 text-[11px] font-black text-[#64748b]">{t(tool)}</span>)}</div></Link>)}
        </div>
      </section>

      <section id="workspace-examples" className="mt-12 hidden scroll-mt-24 lg:block">
        <h2 className="text-2xl font-black tracking-tight text-[#0f172a] md:text-3xl">{t("studio.workspace.featuredTitle")}</h2>
        <p className="mt-2 text-sm font-semibold text-[#8490a3]">{t("studio.workspace.featuredHint")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {SHOWCASES.map((item) => <Link key={`featured-${item.key}`} href={showcaseHref(item.prompt)} className="group relative aspect-[16/10] overflow-hidden rounded-[1.65rem] bg-[#0f172a] shadow-[0_14px_38px_rgba(15,23,42,0.1)] transition hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(15,23,42,0.16)] sm:aspect-video"><ShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" /><span className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_28%,rgba(15,23,42,0.9))]" /><span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/16 text-white backdrop-blur-md"><StudioIcon name="chevron-right" className="h-4 w-4" /></span><span className="absolute inset-x-5 bottom-5 text-white"><span className="inline-flex rounded-full border border-white/20 bg-white/14 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur-md">{t(item.labelKey)}</span><strong className="mt-3 block text-xl font-black md:text-2xl">{t(item.titleKey)}</strong><span className="mt-1 block text-sm font-semibold text-white/72">{t(item.metaKey)}</span></span></Link>)}
        </div>
      </section>

      <div className="mt-12 grid gap-5">
        <section className="flex min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#0f172a,#1e1b4b)] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:p-7 md:flex-row md:items-center md:rounded-[1.8rem] md:p-9">
          <div className="min-w-0"><h2 className="text-2xl font-black leading-tight tracking-tight md:text-3xl">{t("studio.workspace.premiumTitle")}</h2><p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#cbd5e1]">{t("studio.workspace.premiumBody")}</p><div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{["studio.workspace.premiumCredits", "studio.workspace.premiumQueue", "studio.workspace.premiumModels", "studio.workspace.premiumWatermark"].map((key) => <span key={key} className="min-w-0 truncate rounded-full border border-white/10 bg-white/10 px-3 py-2 text-center text-[11px] font-black text-[#e0f2fe] sm:text-xs">{t(key)}</span>)}</div></div>
          <button type="button" onClick={onUpgrade} className="w-full shrink-0 rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#0f172a] shadow-lg transition hover:-translate-y-0.5 md:w-auto">{t("studio.workspace.premiumCta")}</button>
        </section>
        <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/80 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] sm:p-6 md:rounded-[1.8rem]">
          <div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[#0f172a]">{t("studio.workspace.recentTitle")}</h2><Link href="/studio?view=projects" className="shrink-0 text-[11px] font-black text-[#4f46e5] sm:text-xs">{t("studio.workspace.viewProjects")}</Link></div>
          <div className="mt-4">{tasks.length ? tasks.slice(0, 3).map((task) => <Link key={`recent-${task.id}`} href={`/studio?view=projects&taskId=${encodeURIComponent(task.id)}`} className="flex min-w-0 items-center gap-3 border-t border-black/[0.05] py-3 first:border-t-0"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#c7d2fe,#67e8f9)] text-[#334155]">{task.mediaUrl && task.type === "Image" ? <img src={task.mediaUrl} alt="" className="h-full w-full object-cover" /> : <StudioIcon name={task.type === "Audio" ? "audio" : task.type === "Video" ? "video" : "image"} className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black text-[#253044]">{task.title || task.prompt || taskTypeLabel(task.type)}</strong><span className="mt-1 block text-xs font-semibold text-[#94a3b8]">{taskStatusLabel(task.status)}</span></span></Link>) : <p className="break-words rounded-2xl bg-[#f8fafc] px-4 py-6 text-sm font-semibold leading-6 text-[#8490a3]">{t("studio.workspace.recentEmpty")}</p>}</div>
        </section>
      </div>
    </div>
  );
}
