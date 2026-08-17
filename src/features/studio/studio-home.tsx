"use client";

import Link from "next/link";
import { StudioIcon } from "./studio-navigation";

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

const INTENTS: Array<{ title: string; body: string; href: string; icon: string; color: string; tools: string[] }> = [
  { title: "studio.workspace.intent.video", body: "studio.workspace.intent.videoBody", href: "/studio?mode=video&workflow=text-to-video&duration=5s", icon: "🎞️", color: "bg-[#f1efff]", tools: ["studio.workflow.text-to-video", "studio.workflow.image-to-video"] },
  { title: "studio.workspace.intent.image", body: "studio.workspace.intent.imageBody", href: "/studio?mode=image&workflow=text-to-image", icon: "🖼️", color: "bg-[#eef8ff]", tools: ["studio.workflow.text-to-image", "studio.workflow.image-to-image"] },
  { title: "studio.workspace.intent.avatar", body: "studio.workspace.intent.avatarBody", href: "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video", icon: "💬", color: "bg-[#fff1f6]", tools: ["studio.nav.avatar"] },
  { title: "studio.workspace.intent.enhance", body: "studio.workspace.intent.enhanceBody", href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image", icon: "✨", color: "bg-[#effbf4]", tools: ["studio.workflow.enhance-cleanup"] },
  { title: "studio.workflow.background-remove", body: "studio.home.quick.remove", href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove", icon: "✂️", color: "bg-[#fff6ed]", tools: ["studio.workflow.background-remove"] },
  { title: "studio.workflow.text-to-audio", body: "studio.home.quick.audio", href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "🎙️", color: "bg-[#f5f3ff]", tools: ["studio.workflow.text-to-audio"] },
  { title: "studio.workflow.text-to-music", body: "studio.music.promptDescription", href: "/studio?mode=audio&workflow=text-to-music&provider=minimax-music-2.6", icon: "🎵", color: "bg-[#fffbea]", tools: ["studio.workflow.text-to-music"] }
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

export function StudioHome({ t, tasks, onUpgrade }: { t: Translate; tasks: HomeTask[]; onUpgrade: () => void }) {
  const taskTypeLabel = (type: HomeTask["type"]) => t(`studio.task.${type.toLowerCase()}`);
  const taskStatusLabel = (status: HomeTask["status"]) => t(`studio.task.${status.toLowerCase()}`);

  return (
    <div className="w-full min-w-0 max-w-full pb-4 text-start">
      <section className="grid min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] xl:grid-cols-[minmax(390px,0.82fr)_minmax(500px,1.18fr)]">
        <div className="relative flex min-h-[330px] min-w-0 flex-col justify-center overflow-hidden p-5 sm:p-7 xl:min-h-[390px] xl:p-9">
          <span className="pointer-events-none absolute -start-28 -top-32 h-72 w-72 rounded-full bg-[#efeaff] blur-3xl" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-[#ddd7ff] bg-[#f4f1ff] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#6a5af9]">{t("studio.workspace.badge")}</span>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#98a2b3]">{t("studio.workspace.eyebrow")}</p>
            <h2 className="mt-2 max-w-2xl text-[clamp(30px,3.1vw,46px)] font-black leading-[1.05] tracking-[-0.045em] text-[#101828]">{t("studio.workspace.heroTitle")} <span className="bg-[linear-gradient(90deg,#744bfb,#9d55ed)] bg-clip-text text-transparent">{t("studio.workspace.heroAccent")}</span></h2>
            <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-[#667085] sm:text-[15px]">{t("studio.workspace.heroBody")}</p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/studio?mode=video&workflow=text-to-video&duration=5s" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#744bfb,#6757f6_55%,#7d53ff)] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(106,90,249,0.2)] transition hover:-translate-y-px">{t("studio.workspace.start")}<StudioIcon name="chevron-right" className="h-4 w-4" /></Link>
              <a href="#workspace-examples" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#eaecf0] bg-white px-5 text-sm font-black text-[#344054] transition hover:bg-[#fafafb]">{t("studio.workspace.examples")}</a>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{["studio.workflow.image-to-video", "studio.workspace.productAds", "studio.nav.avatar", "studio.workflow.enhance-cleanup"].map((key) => <span key={key} className="rounded-full border border-[#eaecf0] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#667085]">{t(key)}</span>)}</div>
          </div>
        </div>
        <Link href={showcaseHref(SHOWCASES[0].prompt)} className="group relative m-3 mt-0 min-h-[250px] overflow-hidden rounded-2xl bg-[#101010] sm:m-4 sm:mt-0 xl:ms-0 xl:mt-4">
          <ShowcaseVideo file={SHOWCASES[0].file} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.04),rgba(0,0,0,0.72))]" />
          <span className="absolute start-4 top-4 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">{t(SHOWCASES[0].labelKey)}</span>
          <span className="absolute end-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-md"><StudioIcon name="chevron-right" className="h-4 w-4" /></span>
          <span className="absolute inset-x-5 bottom-5 text-white"><strong className="block text-xl font-black sm:text-2xl">{t(SHOWCASES[0].titleKey)}</strong><span className="mt-1 block text-xs font-semibold text-white/70 sm:text-sm">{t(SHOWCASES[0].metaKey)}</span></span>
        </Link>
      </section>

      <section className="mt-4 rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4"><div><h2 className="text-lg font-black tracking-[-0.025em] text-[#101828] sm:text-xl">{t("studio.workspace.intentTitle")}</h2><p className="mt-1 text-xs leading-5 text-[#667085] sm:text-sm">{t("studio.workspace.intentHint")}</p></div><span className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#8f80ff] sm:mt-0">DreamFace AI Studio</span></div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {INTENTS.map((item) => <Link key={item.title} href={item.href} className="group flex min-h-[142px] min-w-0 flex-col rounded-2xl border border-[#eaecf0] bg-white p-4 transition hover:-translate-y-px hover:border-[#cfc9ff] hover:bg-[#fdfcff] hover:shadow-[0_10px_24px_rgba(106,90,249,0.08)]"><span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${item.color}`}>{item.icon}</span><span className="mt-3 flex items-start justify-between gap-2"><strong className="min-w-0 text-sm font-black text-[#101828]">{t(item.title)}</strong><StudioIcon name="chevron-right" className="mt-0.5 h-4 w-4 shrink-0 text-[#b0a7ff] transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span><span className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#7b879b]">{t(item.body)}</span><span className="mt-auto flex flex-wrap gap-1.5 pt-3">{item.tools.map((tool) => <span key={tool} className="rounded-full bg-[#f5f4fa] px-2 py-1 text-[9px] font-bold text-[#7b879b]">{t(tool)}</span>)}</span></Link>)}
        </div>
      </section>

      <section id="workspace-examples" className="mt-4 scroll-mt-24 rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] sm:p-5">
        <div className="flex min-w-0 items-end justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-black tracking-[-0.025em] text-[#101828] sm:text-xl">{t("studio.workspace.featuredTitle")}</h2><p className="mt-1 truncate text-xs text-[#667085] sm:text-sm">{t("studio.workspace.featuredHint")}</p></div><Link href="/gallery" className="inline-flex min-h-10 shrink-0 items-center rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{t("studio.workspace.viewAll")}</Link></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SHOWCASES.map((item) => <Link key={`featured-${item.key}`} href={showcaseHref(item.prompt)} className="group min-w-0"><span className="relative block aspect-video overflow-hidden rounded-xl border border-[#eaecf0] bg-[#101010]"><ShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" /><span className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,0.68))]" /><span className="absolute start-2.5 top-2.5 rounded-md bg-white/90 px-2 py-1 text-[9px] font-black text-[#344054]">{t(item.labelKey)}</span><span className="absolute bottom-3 start-3 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-[11px] text-white">▶</span></span><strong className="mt-2 block truncate text-[13px] font-black text-[#101828]">{t(item.titleKey)}</strong><span className="mt-1 block truncate text-[11px] text-[#98a2b3]">{t(item.metaKey)}</span></Link>)}
        </div>
      </section>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#6955f6,#8a5df7)] p-5 text-white shadow-[0_12px_30px_rgba(106,90,249,0.2)] sm:p-6">
          <span className="pointer-events-none absolute -end-16 -top-24 h-60 w-60 rounded-full bg-white/15 blur-2xl" />
          <div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/65">DreamFace Premium</p><h2 className="mt-2 text-xl font-black tracking-[-0.025em] sm:text-2xl">{t("studio.workspace.premiumTitle")}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">{t("studio.workspace.premiumBody")}</p><div className="mt-4 grid grid-cols-2 gap-2">{["studio.workspace.premiumCredits", "studio.workspace.premiumQueue", "studio.workspace.premiumModels", "studio.workspace.premiumWatermark"].map((key) => <span key={key} className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 text-center text-[10px] font-bold text-white/90">✓ {t(key)}</span>)}</div></div>
          <button type="button" onClick={onUpgrade} className="relative mt-5 min-h-11 w-full rounded-xl bg-white px-4 text-sm font-black text-[#6757f6] shadow-sm transition hover:-translate-y-px sm:w-auto sm:self-start">{t("studio.workspace.premiumCta")}</button>
        </section>
        <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)] sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-black tracking-[-0.025em] text-[#101828] sm:text-xl">{t("studio.workspace.recentTitle")}</h2><p className="mt-1 text-xs text-[#98a2b3]">{t("studio.workbench.latest")}</p></div><Link href="/studio?view=projects" className="inline-flex min-h-10 shrink-0 items-center rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{t("studio.workspace.viewProjects")}</Link></div>
          <div className="mt-3 space-y-1.5">{tasks.length ? tasks.slice(0, 3).map((task) => <Link key={`recent-${task.id}`} href={`/studio?view=projects&taskId=${encodeURIComponent(task.id)}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-transparent p-2 transition hover:border-[#e3dfff] hover:bg-[#faf9ff]"><span className="grid h-14 w-[72px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#f1efff,#f7f8fb)] text-lg">{task.mediaUrl && task.type === "Image" ? <img src={task.mediaUrl} alt="" className="h-full w-full object-cover" /> : task.mediaUrl && task.type === "Video" ? <video src={task.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : task.type === "Audio" ? "🎵" : task.type === "Video" ? "🎞️" : "🖼️"}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-black text-[#253044]">{task.title || task.prompt || taskTypeLabel(task.type)}</strong><span className="mt-1 flex items-center gap-2 text-[10px] font-bold text-[#98a2b3]"><span>{taskTypeLabel(task.type)}</span><span>•</span><span>{taskStatusLabel(task.status)}</span></span></span><StudioIcon name="chevron-right" className="h-4 w-4 shrink-0 text-[#b0a7ff]" /></Link>) : <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-[#d7d1ff] bg-[#faf9ff] px-5 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#eeeaff] text-lg text-[#6a5af9]">✦</span><p className="mt-3 text-sm font-black text-[#344054]">{t("studio.workspace.recentEmpty")}</p><Link href="/studio?mode=video&workflow=text-to-video" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#6a5af9] px-4 text-xs font-black text-white">{t("studio.workspace.start")}</Link></div></div>}</div>
        </section>
      </div>
    </div>
  );
}
