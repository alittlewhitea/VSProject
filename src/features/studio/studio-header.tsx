"use client";

import Link from "next/link";
import type { Locale } from "../../i18n/routing";
import { StudioIcon, StudioMobileMenu, type StudioNavigationMode } from "./studio-navigation";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type AudioWorkflow = "text-to-audio" | "text-to-music";

type StudioHeaderProps = {
  t: Translate;
  modern: boolean;
  videoStudio?: boolean;
  mode: StudioNavigationMode;
  isAppsHome: boolean;
  isProjectsView: boolean;
  mobileMenuOpen: boolean;
  signedIn: boolean;
  signInUrl: string;
  locale: Locale;
  locales: readonly Locale[];
  localeLabels: Record<Locale, string>;
  creditBalance: number | null;
  audioWorkflow: AudioWorkflow;
  onMobileMenuOpenChange: (open: boolean) => void;
  onLocaleChange: (locale: Locale) => void;
  onBillingOpen: (source: "balance" | "vip_badge") => void;
  onAudioWorkflowSelect: (workflow: AudioWorkflow) => void;
};

function headerCopy(t: Translate, mode: StudioNavigationMode, isAppsHome: boolean, isProjectsView: boolean) {
  if (isProjectsView) return { title: t("studio.header.projects"), description: t("studio.header.projectsDescription") };
  if (isAppsHome) return { title: t("studio.header.toolkit"), description: t("studio.header.toolkitDescription") };
  if (mode === "image") return { title: t("studio.header.image"), description: t("studio.header.imageDescription") };
  if (mode === "audio") return { title: t("studio.header.audio"), description: t("studio.header.audioDescription") };
  if (mode === "avatar") return { title: t("studio.header.avatar"), description: t("studio.header.avatarDescription") };
  return { title: t("studio.header.video"), description: t("studio.header.videoDescription") };
}

export function StudioHeader({
  t,
  modern,
  videoStudio = false,
  mode,
  isAppsHome,
  isProjectsView,
  mobileMenuOpen,
  signedIn,
  signInUrl,
  locale,
  locales,
  localeLabels,
  creditBalance,
  audioWorkflow,
  onMobileMenuOpenChange,
  onLocaleChange,
  onBillingOpen,
  onAudioWorkflowSelect
}: StudioHeaderProps) {
  const copy = headerCopy(t, mode, isAppsHome, isProjectsView);

  if (videoStudio) {
    return (
      <header className="flex min-h-[84px] items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <StudioMobileMenu t={t} open={mobileMenuOpen} signedIn={signedIn} signInUrl={signInUrl} locale={locale} locales={locales} localeLabels={localeLabels} mode={mode} isAppsHome={isAppsHome} isProjectsView={isProjectsView} onOpenChange={onMobileMenuOpenChange} onLocaleChange={onLocaleChange} />
          <span className="hidden text-2xl text-[#6a5af9] sm:block">{"\u2723"}</span>
          <h1 className="truncate text-[23px] font-black leading-none tracking-[-0.035em] text-[#101828]">{copy.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button type="button" onClick={() => onBillingOpen("balance")} className="hidden h-11 items-center gap-2 rounded-[14px] border border-[#eaecf0] bg-white px-3.5 text-[13px] font-bold text-[#101828] shadow-sm sm:flex"><span className="text-[#f4a000]">{"\u25C9"}</span><span>{creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("studio.common.credits")}</span></button>
          <button type="button" aria-label={t("studio.workspace.upgrade")} title={t("studio.workspace.upgrade")} onClick={() => onBillingOpen("vip_badge")} className="group relative flex h-11 items-center gap-1.5 overflow-hidden rounded-[14px] border border-[#8b74ff]/35 bg-[linear-gradient(135deg,#765cff_0%,#654ff2_52%,#8e5cff_100%)] px-2.5 text-white shadow-[0_9px_24px_rgba(106,81,246,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_13px_30px_rgba(106,81,246,0.38)] sm:gap-2 sm:px-3.5">
            <span aria-hidden="true" className="absolute -end-2 -top-4 h-9 w-9 rounded-full bg-white/20 blur-sm" />
            <span aria-hidden="true" className="relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] bg-white/16 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" fill="none" className="h-[17px] w-[17px] text-[#ffe68a]" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m4 8 3.2 3L12 5l4.8 6L20 8l-1.4 9H5.4Z" /><path d="M6 20h12" /></svg>
            </span>
            <span className="relative text-[10px] font-black uppercase tracking-[0.08em] sm:hidden">PRO</span>
            <span className="relative hidden text-[13px] font-bold sm:inline">{t("studio.workspace.upgrade")}</span>
          </button>
          <label className="hidden h-10 items-center gap-2 rounded-[14px] border border-[#eaecf0] bg-white px-3.5 text-[13px] font-bold text-[#101828] md:flex"><StudioIcon name="globe" className="h-4 w-4 text-[#6a5af9]" /><select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)} className="max-w-[96px] bg-transparent outline-none">{locales.map((itemLocale) => <option key={itemLocale} value={itemLocale}>{localeLabels[itemLocale]}</option>)}</select></label>
          {signedIn ? <Link href="/studio?view=projects" aria-label={t("studio.nav.projects")} title={t("studio.nav.projects")} className="relative grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(145deg,#312e81,#6d5dfc_58%,#9b7aff)] text-white shadow-[0_7px_22px_rgba(79,70,229,0.28)] ring-2 ring-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(79,70,229,0.36)]"><span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10"><StudioIcon name="user" className="h-[18px] w-[18px]" /></span><span aria-hidden="true" className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white bg-[#22c55e]" /></Link> : <Link href={signInUrl} className="hidden h-10 items-center rounded-[14px] bg-[#101828] px-3.5 text-xs font-bold text-white sm:flex">{t("studio.auth.signIn")}</Link>}
        </div>
      </header>
    );
  }

  return (
    <div className={`gap-3 md:gap-4 ${modern ? "mb-4 flex items-start justify-between md:mb-9 md:items-center" : "flex items-start justify-between md:items-center"}`}>
      <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
        <StudioMobileMenu
          t={t}
          open={mobileMenuOpen}
          signedIn={signedIn}
          signInUrl={signInUrl}
          locale={locale}
          locales={locales}
          localeLabels={localeLabels}
          mode={mode}
          isAppsHome={isAppsHome}
          isProjectsView={isProjectsView}
          onOpenChange={onMobileMenuOpenChange}
          onLocaleChange={onLocaleChange}
        />
        <div className={`min-w-0 ${modern ? "hidden md:block" : ""}`}>
          <p className={modern ? "text-xs font-black uppercase tracking-[0.22em] text-[#92a0b5]" : "hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7] sm:block"}>{t("studio.header.apps")}</p>
          <h1 className={modern ? "mt-[7px] flex items-center gap-3 text-[clamp(26px,2.1vw,36px)] font-black leading-none tracking-[-0.045em] text-[#151827]" : "truncate text-lg font-semibold tracking-tight text-[#202633] sm:text-xl md:text-3xl"}>{copy.title}</h1>
          <p className={modern ? "mt-[9px] text-[15px] leading-[1.45] text-[#8794aa]" : "mt-1 hidden text-sm text-[#8b95a7] sm:block"}>{copy.description}</p>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
        <button type="button" onClick={() => onBillingOpen("balance")} className="rounded-full border border-black/[0.06] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#485164] shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-[#08bff1]/45 hover:text-[#0f172a] hover:shadow-[0_16px_36px_rgba(8,191,241,0.14)] sm:px-3 sm:text-xs md:rounded-2xl md:px-4 md:text-sm">
          {t("studio.billing.creditCount", { credits: creditBalance === null ? "--" : creditBalance.toLocaleString() })}
        </button>
        <label className="hidden items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-[#485164] shadow-[0_10px_28px_rgba(15,23,42,0.08)] md:inline-flex">
          <span className="sr-only">{t("studio.language")}</span>
          <select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)} className="bg-transparent text-xs font-black outline-none">
            {locales.map((itemLocale) => <option key={itemLocale} value={itemLocale}>{localeLabels[itemLocale]}</option>)}
          </select>
        </label>
        <button type="button" aria-label={t("studio.billing.title")} title={t("studio.billing.title")} onClick={() => onBillingOpen("vip_badge")} className="inline-flex h-10 items-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#06b6d4)] px-3 text-xs font-black text-white shadow-[0_12px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(79,70,229,0.3)] sm:gap-2 sm:px-3.5 md:px-4 md:text-sm">
          <span className="relative hidden h-4 w-5 shrink-0 sm:block"><span className="absolute left-1/2 top-0 h-2.5 w-3.5 -translate-x-1/2 rounded-t-sm bg-[#fde68a]" /><span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-[#fbbf24]" /></span>
          <span>{t("studio.workspace.upgrade")}</span>
        </button>
        {signedIn ? (
          <Link href="/studio?view=projects" className="hidden rounded-2xl bg-[#202633] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(32,38,51,0.18)] sm:inline-flex">{t("studio.nav.projects")}</Link>
        ) : mode === "audio" ? (
          <button type="button" onClick={() => onAudioWorkflowSelect(audioWorkflow)} className="rounded-full border border-[#bae6fd] bg-[#e8f7ff] px-4 py-2 text-sm font-semibold text-[#0284c7] shadow-sm">{t(`studio.workflow.${audioWorkflow}`)}</button>
        ) : (
          <Link href={signInUrl} className="hidden rounded-full bg-[#202633] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(32,38,51,0.18)] sm:inline-flex md:rounded-2xl md:px-4 md:text-sm">{t("studio.auth.signIn")}</Link>
        )}
      </div>
    </div>
  );
}
