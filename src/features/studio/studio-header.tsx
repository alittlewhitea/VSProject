"use client";

import { AuthLink } from "../../components/auth-link";

import Link from "./studio-link";
import { StudioButton, StudioActionLink } from "./studio-primitives";
import { StudioThemeToggle } from "./studio-theme-toggle";
import { referralTranslator } from "../../lib/referral-i18n";
import type { Locale } from "../../i18n/routing";
import { StudioIcon, StudioMobileMenu, type StudioNavigationMode } from "./studio-navigation";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type AudioWorkflow = "text-to-audio" | "text-to-music";

type StudioHeaderProps = {
  isBillingView?: boolean;
  billingHref?: string;
  referralsVisible?: boolean;
  isReferralsView?: boolean;
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
  isBillingView = false, billingHref,
  referralsVisible = false,
  isReferralsView = false,
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
  const rt=referralTranslator(locale);
  const copy = isBillingView ? { title: t("studio.billing.open"), description: "" } : isReferralsView ? {title:rt("title"),description:rt("history")} : headerCopy(t, mode, isAppsHome, isProjectsView);

  const workspaceTitle = !isAppsHome && !isProjectsView && !isBillingView && !isReferralsView ? t("studio.workspace.title", { name: t(mode === "avatar" ? "studio.workspace.avatar" : `studio.nav.${mode}`) }) : copy.title;

  if (videoStudio) {
    return (
      <header className="studio-topbar df-app-header">
        <div className="df-header-title">
          <StudioMobileMenu isBillingView={isBillingView} billingHref={billingHref} referralsVisible={referralsVisible} t={t} open={mobileMenuOpen} signedIn={signedIn} signInUrl={signInUrl} locale={locale} locales={locales} localeLabels={localeLabels} mode={mode} isAppsHome={isAppsHome} isProjectsView={isProjectsView} isReferralsView={isReferralsView} onOpenChange={onMobileMenuOpenChange} onLocaleChange={onLocaleChange} />
          <h1 className="df-desktop-workspace-title">{copy.title}</h1>
        </div>
        <h1 className="df-mobile-workspace-title" title={workspaceTitle}>{workspaceTitle}</h1>
        <div className="df-header-actions" data-signed-in={signedIn}>
          <StudioThemeToggle locale={locale} />
          <StudioButton variant="ghost" className="df-credit-balance" onClick={() => onBillingOpen("balance")}><span className="df-credit-dot" aria-hidden="true" /><span>{creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("studio.common.credits")}</span></StudioButton>
          <StudioButton className="df-buy-credits" onClick={() => onBillingOpen("vip_badge")} aria-label={t("creditShop.buy")}><StudioIcon name="billing" className="h-4 w-4" /><span>{t("creditShop.buy")}</span></StudioButton>
          <label className="df-language-select"><StudioIcon name="globe" className="h-4 w-4" /><span className="sr-only">{t("studio.language")}</span><select value={locale} onChange={event => onLocaleChange(event.target.value as Locale)}>{locales.map(item => <option key={item} value={item}>{localeLabels[item]}</option>)}</select></label>
          {signedIn ? <StudioActionLink variant="ghost" className="df-account" href="/studio?view=projects" aria-label={t("studio.nav.projects")}><StudioIcon name="user" className="h-[18px] w-[18px]" /></StudioActionLink> : <AuthLink className="df-button df-button--secondary df-sign-in" href={signInUrl}><span>{t("studio.auth.signIn")}</span></AuthLink>}
        </div>
      </header>
    );
  }

  return (
    <div className={`gap-3 md:gap-4 ${modern ? "mb-4 flex items-start justify-between md:mb-9 md:items-center" : "flex items-start justify-between md:items-center"}`}>
      <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
        <StudioMobileMenu
          referralsVisible={referralsVisible}
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
          <p className={modern ? "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--studio-muted)]" : "hidden text-xs font-semibold uppercase tracking-[0.16em] text-[var(--studio-muted)] sm:block"}>{t("studio.header.apps")}</p>
          <h1 className={modern ? "mt-[7px] flex items-center gap-3 text-[clamp(26px,2.1vw,36px)] font-semibold leading-none tracking-[-0.045em] text-[var(--studio-text)]" : "truncate text-lg font-semibold tracking-tight text-[var(--studio-text)] sm:text-xl md:text-3xl"}>{copy.title}</h1>
          <p className={modern ? "mt-[9px] text-[15px] leading-[1.45] text-[var(--studio-muted)]" : "mt-1 hidden text-sm text-[var(--studio-muted)] sm:block"}>{copy.description}</p>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
        <StudioThemeToggle locale={locale} />
        <button type="button" onClick={() => onBillingOpen("balance")} className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-2.5 py-2 text-[11px] font-semibold text-[var(--studio-text)] shadow-none transition hover:-translate-y-0.5 hover:border-[var(--studio-accent-border)] hover:text-[var(--studio-text)] hover:shadow-none sm:px-3 sm:text-xs md:rounded-2xl md:px-4 md:text-sm">
          {t("studio.billing.creditCount", { credits: creditBalance === null ? "--" : creditBalance.toLocaleString() })}
        </button>
        <label className="hidden items-center gap-2 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-xs font-semibold text-[var(--studio-text)] shadow-none md:inline-flex">
          <span className="sr-only">{t("studio.language")}</span>
          <select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)} className="bg-transparent text-xs font-semibold outline-none">
            {locales.map((itemLocale) => <option key={itemLocale} value={itemLocale}>{localeLabels[itemLocale]}</option>)}
          </select>
        </label>
        <button type="button" aria-label={t("studio.billing.title")} title={t("studio.billing.title")} onClick={() => onBillingOpen("vip_badge")} className="inline-flex h-10 items-center rounded-full bg-[var(--studio-primary)] px-3 text-xs font-semibold text-white shadow-none transition hover:-translate-y-0.5 hover:shadow-none sm:gap-2 sm:px-3.5 md:px-4 md:text-sm">
          <span className="relative hidden h-4 w-5 shrink-0 sm:block"><span className="absolute left-1/2 top-0 h-2.5 w-3.5 -translate-x-1/2 rounded-t-sm bg-[var(--studio-warning-soft)]" /><span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-[var(--studio-warning-soft)]" /></span>
          <span>{t("creditShop.buy")}</span>
        </button>
        {signedIn ? (
          <Link href="/studio?view=projects" className="hidden rounded-2xl bg-[var(--studio-primary)] px-4 py-2 text-sm font-semibold text-white shadow-none sm:inline-flex">{t("studio.nav.projects")}</Link>
        ) : mode === "audio" ? (
          <button type="button" onClick={() => onAudioWorkflowSelect(audioWorkflow)} className="rounded-full border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--studio-accent)] shadow-sm">{t(`studio.workflow.${audioWorkflow}`)}</button>
        ) : (
          <AuthLink href={signInUrl} className="hidden rounded-full bg-[var(--studio-primary)] px-3 py-2 text-xs font-semibold text-white shadow-none sm:inline-flex md:rounded-2xl md:px-4 md:text-sm">{t("studio.auth.signIn")}</AuthLink>
        )}
      </div>
    </div>
  );
}
