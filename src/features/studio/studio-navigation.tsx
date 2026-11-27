"use client";

import { AuthLink } from "../../components/auth-link";

import Link from "./studio-link";
import { memo, useEffect, useId, useRef, useState } from "react";
import { useStudioDialog } from "./use-studio-dialog";
import {BrandMark} from "../../components/brand-mark";
import { StudioThemeToggle } from "./studio-theme-toggle";
import { studioAppsCopy } from "./studio-apps-i18n";
import { referralTranslator } from "../../lib/referral-i18n";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import type { Locale } from "../../i18n/routing";

export type StudioNavigationMode = "image" | "video" | "audio" | "avatar";

export type StudioIconName =
  | "home"
  | "image"
  | "upload"
  | "video"
  | "gallery"
  | "projects"
  | "sparkles"
  | "wand"
  | "film"
  | "motion"
  | "cleanup"
  | "sliders"
  | "audio"
  | "billing"
  | "globe"
  | "user"
  | "sign-out"
  | "menu"
  | "x"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right";

type Translate = (key: string, values?: Record<string, string | number>) => string;

type NavigationState = {
  isAppsView?: boolean;
  isBillingView?: boolean;
  billingHref?: string;
  referralsVisible?: boolean;
  isReferralsView?: boolean;
  mode: StudioNavigationMode;
  isAppsHome: boolean;
  isProjectsView: boolean;
};

type NavigationItem = {
  id: "home" | "apps" | StudioNavigationMode | "projects" | "billing" | "referrals";
  label: string;
  href: string;
  icon: StudioIconName;
  visualIcon: string;
  active: boolean;
};

const filledNavigationPaths: Record<NavigationItem["id"], string> = {
  home: "M10.7 3.3a2 2 0 0 1 2.6 0l7 6a2 2 0 0 1 .7 1.5V19a2 2 0 0 1-2 2h-4v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H5a2 2 0 0 1-2-2v-8.2a2 2 0 0 1 .7-1.5z",
  apps: "M4 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm10 0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM4 15a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm10 0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z",
  avatar: "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-5 11h10a5.2 5.2 0 0 0-10 0z",
  video: "M5.5 5.5h9a3 3 0 0 1 3 3v1.2l3-2a1 1 0 0 1 1.5.9v6.8a1 1 0 0 1-1.5.9l-3-2v1.2a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z",
  image: "M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm2.6 3.1a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM5 16.2v.8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.7l-3-3a1.1 1.1 0 0 0-1.5 0l-3.3 3.1-2-1.8a1 1 0 0 0-1.4 0z",
  audio: "M9 5a1 1 0 0 1 .8-1l10-2a1 1 0 0 1 1.2 1v12.4a3.5 3.5 0 1 1-2-3.2V7.6l-8 1.6v8.2a3.5 3.5 0 1 1-2-3.2z",
  projects: "M5 4h4.4a2 2 0 0 1 1.4.6L12.2 6H19a3 3 0 0 1 3 3v1H2V7a3 3 0 0 1 3-3zM2 12h20v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z",
  billing: "M5 4h14a3 3 0 0 1 3 3v1H2V7a3 3 0 0 1 3-3zm-3 7h20v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zm4 4v2h5v-2z",
  referrals: "M8 3.5a3 3 0 1 1-1.9 5.3L5.3 8H4a1 1 0 0 0-1 1v2h8V8.8A3 3 0 0 1 8 3.5zm0 2a1 1 0 0 0-.7 1.7l2.3 1.9-.7-2.8a1 1 0 0 0-.9-.8zm8-2a3 3 0 0 1 1.9 5.3l.8-.8H20a1 1 0 0 1 1 1v2h-8V8.8a3 3 0 0 1 3-5.3zm0 2a1 1 0 0 0-.9.8l-.7 2.8 2.3-1.9a1 1 0 0 0-.7-1.7zM4 13h7v8H6a2 2 0 0 1-2-2zm9 0h7v6a2 2 0 0 1-2 2h-5z"
};

function FilledNavigationIcon({ item }: { item: NavigationItem }) {
  return <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d={filledNavigationPaths[item.id]} /></svg>;
}

function navigationItems(t: Translate, state: NavigationState, homeLabelKey = "studio.nav.home", referralLabel="Invite friends", appsLabel = "Apps"): NavigationItem[] {
  const inWorkbench = !state.isAppsHome && !state.isAppsView && !state.isProjectsView && !state.isBillingView;
  return ([
    { id: "home", label: t(homeLabelKey), href: "/studio?view=home", icon: "home", visualIcon: "✦", active: state.isAppsHome },
    { id: "avatar", label: t("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=heygen-video", icon: "video", visualIcon: "💬", active: inWorkbench && state.mode === "avatar" },
    { id: "video", label: t("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video", visualIcon: "🎞️", active: inWorkbench && state.mode === "video" },
    { id: "image", label: t("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image", visualIcon: "🖼️", active: inWorkbench && state.mode === "image" },
    { id: "apps", label: appsLabel, href: "/studio?view=apps", icon: "sparkles", visualIcon: "✨", active: Boolean(state.isAppsView) || (inWorkbench && state.mode === "audio") },
    { id: "projects", label: t("studio.nav.projects"), href: "/studio?view=projects", icon: "projects", visualIcon: "📁", active: state.isProjectsView && !state.isReferralsView },
    { id: "referrals", label: referralLabel, href: "/studio?view=referrals", icon: "sparkles", visualIcon: "🎁", active: Boolean(state.isReferralsView) },
    { id: "billing", label: t("studio.billing.open"), href: state.billingHref || "/studio?view=billing", icon: "billing", visualIcon: "💳", active: Boolean(state.isBillingView) }
  ] as NavigationItem[]).filter(item => item.id !== "referrals" || state.referralsVisible);
}

export function StudioIcon({ name, className = "h-5 w-5" }: { name: StudioIconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (name === "home") return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-5h5v5" /></svg>;
  if (name === "image") return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="9" cy="10" r="1.5" /><path d="m7 17 4.2-4.2a1.6 1.6 0 0 1 2.2 0L18 17" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 15V4m-4 4 4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></svg>;
  if (name === "video" || name === "film") return <svg {...common}><rect x="4" y="6" width="12" height="12" rx="3" /><path d="m16 10 4-2.2v8.4L16 14" /></svg>;
  if (name === "gallery") return <svg {...common}><rect x="5" y="5" width="8" height="8" rx="2" /><rect x="11" y="11" width="8" height="8" rx="2" /></svg>;
  if (name === "projects") return <svg {...common}><path d="M4 7.5h6l2 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M4 7.5V6a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v1.5" /></svg>;
  if (name === "sparkles") return <svg {...common}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" /><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" /><path d="m5.5 13 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" /></svg>;
  if (name === "wand") return <svg {...common}><path d="m4 20 12-12" /><path d="m14 6 4 4" /><path d="M5 4v3" /><path d="M3.5 5.5h3" /><path d="M19 15v3" /><path d="M17.5 16.5h3" /></svg>;
  if (name === "motion") return <svg {...common}><path d="M5 6h9a5 5 0 0 1 0 10H8" /><path d="m8 12 4 4-4 4" /><path d="M4 10h5" /></svg>;
  if (name === "cleanup") return <svg {...common}><path d="m5 19 10.5-10.5a2.1 2.1 0 0 1 3 3L8 22H5Z" /><path d="m13 11 3 3" /><path d="M6 5h.01" /><path d="M10 3h.01" /><path d="M4 9h.01" /></svg>;
  if (name === "sliders") return <svg {...common}><path d="M4 6h6m4 0h6M4 12h10m4 0h2M4 18h2m4 0h10M12 4v4m4 2v4M8 16v4" /></svg>;
  if (name === "audio") return <svg {...common}><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>;
  if (name === "billing") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>;
  if (name === "globe") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
  if (name === "sign-out") return <svg {...common}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m-1-8h11m-4-4 4 4-4 4" /></svg>;
  if (name === "menu") return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
  if (name === "x") return <svg {...common}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "chevron-down") return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  return <svg {...common}><path d={name === "chevron-left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>;
}

function StudioSignOutButton({ t }: { t: Translate }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = t("studio.auth.signOut");

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signOut();
      setFailed(Boolean(error));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="df-studio-sign-out">
      <button type="button" data-studio-sign-out aria-label={label} title={label} aria-busy={pending} disabled={pending} onClick={() => void signOut()}>
        <StudioIcon name="sign-out" className="h-[18px] w-[18px] shrink-0 rtl:-scale-x-100" />
        <span>{label}</span>
      </button>
      {failed ? <p role="alert">{t("studio.error.providerUnavailable")}</p> : null}
    </div>
  );
}

function StudioAccountSummary({ t, locale, signedIn, creditBalance, onOpenCredits }: {
  t: Translate;
  locale: Locale;
  signedIn: boolean;
  creditBalance: number | null;
  onOpenCredits: () => void;
}) {
  const name = t(signedIn ? "studio.workbench.user" : "studio.workbench.guest");
  const balance = creditBalance?.toLocaleString(locale) ?? "—";
  const balanceLabel = t("studio.billing.currentBalance", { balance });
  return <div className="df-account-summary">
    <div className="df-sidebar-account">
      <span className="df-sidebar-avatar" aria-hidden="true"><StudioIcon name="user" /></span>
      <strong className="df-sidebar-account-name" title={name}>{name}</strong>
    </div>
    {signedIn ? <button type="button" className="df-sidebar-credits" aria-label={balanceLabel} title={balanceLabel} onClick={onOpenCredits}>
      <StudioIcon name="billing" />
      <span className="df-sidebar-credit-label">{t("studio.common.credits")}</span>
      <strong dir="auto">{balance}</strong>
    </button> : null}
  </div>;
}

type StudioSidebarProps = NavigationState & {
  referralLocale?: Locale;
  t: Translate;
  collapsed?: boolean;
  creditBalance?: number | null;
  activeTaskCount?: number;
  signedIn?: boolean;
  onOpenCredits: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export const StudioSidebar = memo(function StudioSidebar({ t, referralLocale = "en", collapsed = false, creditBalance = null, activeTaskCount = 0, signedIn = false, onOpenCredits, onCollapsedChange, ...state }: StudioSidebarProps) {
  const rt = referralTranslator(referralLocale);
  const appsCopy = studioAppsCopy(referralLocale);
  const items = navigationItems(t, state, "studio.nav.home", rt("title"), appsCopy.navLabel);

  return (
    <aside data-studio-sidebar data-collapsed={collapsed} className="studio-sidebar relative hidden h-screen flex-col border-e border-[var(--studio-border)] bg-[var(--studio-panel)] px-3.5 py-5 md:sticky md:top-0 md:flex">
      <button
        type="button"
        onClick={() => onCollapsedChange?.(!collapsed)}
        aria-label={t(collapsed ? "studio.menu.open" : "studio.menu.close")}
        title={t(collapsed ? "studio.menu.open" : "studio.menu.close")}
        className="group absolute -end-3 top-1/2 z-30 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-muted)] shadow-none transition duration-200 hover:scale-105 hover:bg-[var(--studio-surface)] hover:text-[var(--studio-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent-border)] focus-visible:ring-offset-2"
      >
        <StudioIcon name={collapsed ? "chevron-right" : "chevron-left"} className="h-3.5 w-3.5" />
        <span className="pointer-events-none absolute start-full ms-2.5 whitespace-nowrap rounded-lg bg-[var(--df-cta-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--df-cta-fg)] opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{t(collapsed ? "studio.menu.open" : "studio.menu.close")}</span>
      </button>
      <a href="https://dreamface.io" className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
        <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm"><BrandMark alt="" className="h-full w-full object-cover" /></span>
        {!collapsed ? <span className="min-w-0"><strong className="block text-[16px] font-semibold leading-none tracking-tight text-[var(--studio-text)]">DreamFace</strong><span className="mt-1 block text-[11px] text-[var(--studio-muted)]">AI Studio</span></span> : null}
      </a>
      <nav aria-label={t("studio.header.apps")} className="mt-7 grid gap-1">
        {items.map((item) => {
          const showActiveBadge = item.id === "projects" && activeTaskCount > 0;
          const showHotBadge = !collapsed && item.id === "apps";
          const title = showActiveBadge ? `${item.label} · ${t("studio.summary.runningTasks", { count: activeTaskCount })}` : item.label;
          return (
            <Link key={`${item.label}-${item.href}`} href={item.href} title={title} aria-current={item.active ? "page" : undefined} className={`df-sidebar-item relative flex h-10 items-center rounded-[10px] text-sm transition ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${item.active ? "bg-[var(--studio-surface)] font-semibold text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:bg-[var(--studio-surface)] hover:text-[var(--studio-text)]"}`}>
              <StudioIcon name={item.icon} className="h-[17px] w-[17px] shrink-0" />
              {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
              {showHotBadge ? <span className="df-sidebar-hot-badge">{appsCopy.navBadge}</span> : null}
              {showActiveBadge ? <b className="df-sidebar-task-badge" data-active-task-badge aria-label={t("studio.summary.runningTasks", { count: activeTaskCount })}>{activeTaskCount > 9 ? "9+" : activeTaskCount}</b> : null}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div data-signed-in={signedIn} className="df-sidebar-footer">
        <StudioAccountSummary t={t} locale={referralLocale} signedIn={signedIn} creditBalance={creditBalance} onOpenCredits={onOpenCredits} />
        {signedIn ? <StudioSignOutButton t={t} /> : null}
      </div>
    </aside>
  );
});

export const StudioBottomNavigation = memo(function StudioBottomNavigation({ t, currentHref, locale = "en", ...state }: NavigationState & { t: Translate; currentHref: string; locale?: Locale }) {
  const appsCopy = studioAppsCopy(locale);
  const order = ["home", "apps", "video", "image", "avatar"];
  const items = navigationItems(t, state, "studio.nav.home", "Invite friends", appsCopy.navLabel)
    .filter(item => order.includes(item.id))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  return (
    <nav className="df-mobile-dock" aria-label={t("studio.workspace.switch")}>
      {items.map(item => (
        <Link
          key={item.id}
          href={item.active ? currentHref : item.href}
          data-nav-item={item.id}
          aria-current={item.active ? "page" : undefined}
          aria-label={item.id === "home" ? t("studio.menu.studioHome") : item.label}
        >
          <span className="df-mobile-dock-icon" aria-hidden="true"><FilledNavigationIcon item={item} /></span>
          <span className="df-mobile-dock-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
});

type StudioMobileMenuProps = NavigationState & {
  t: Translate;
  open: boolean;
  signedIn: boolean;
  creditBalance: number | null;
  activeTaskCount?: number;
  signInUrl: string;
  locale: Locale;
  locales: readonly Locale[];
  localeLabels: Record<Locale, string>;
  onOpenChange: (open: boolean) => void;
  onOpenCredits: () => void;
  onLocaleChange: (locale: Locale) => void;
};

export function StudioMobileMenu({ t, open, signedIn, creditBalance, activeTaskCount = 0, signInUrl, locale, locales, localeLabels, onOpenChange, onOpenCredits, onLocaleChange, ...state }: StudioMobileMenuProps) {
  const rt=referralTranslator(locale);
  const appsCopy = studioAppsCopy(locale);
  const close = () => onOpenChange(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  useStudioDialog(open, menuRef, { onClose: close });
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const resized = () => { if (desktop.matches) onOpenChange(false); };
    resized();
    desktop.addEventListener("change", resized);
    return () => desktop.removeEventListener("change", resized);
  }, [open, onOpenChange]);
  return (
    <div className="relative shrink-0">
      <button type="button" data-mobile-menu-trigger aria-label={open ? t("studio.menu.close") : t("studio.menu.open")} aria-expanded={open} aria-controls={open ? menuId : undefined} aria-haspopup="dialog" onClick={() => onOpenChange(!open)} className="df-mobile-menu-trigger relative grid h-11 w-11 place-items-center rounded-[10px] text-[var(--studio-text)] transition hover:bg-[var(--studio-surface)] md:hidden">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16"/></svg>
        {activeTaskCount > 0 ? <span className="df-mobile-task-dot" aria-hidden="true" /> : null}
      </button>
      <Link href="/studio?view=home" aria-label={t("studio.menu.studioHome")} className="df-header-home-link hidden h-10 w-10 place-items-center rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)] shadow-sm transition hover:bg-[var(--studio-accent-soft)] md:grid"><StudioIcon name="home" className="h-5 w-5" /></Link>
      {open ? (
        <>
          <button type="button" tabIndex={-1} aria-label={t("studio.menu.close")} onClick={close} className="df-mobile-menu-backdrop md:hidden" />
          <div ref={menuRef} id={menuId} data-mobile-menu role="dialog" aria-modal="true" aria-label={t("studio.header.apps")} tabIndex={-1} className="df-mobile-menu md:hidden">
            <div className="df-mobile-menu-header">
              <a href="https://dreamface.io/" onClick={close} className="df-mobile-menu-brand">
                <BrandMark alt="" width={36} height={36} />
                <span>DreamFace</span>
              </a>
              <button type="button" onClick={close} aria-label={t("studio.menu.close")} className="df-mobile-menu-close"><StudioIcon name="x" className="h-5 w-5" /></button>
            </div>
            <div className="df-mobile-menu-body">
              <nav aria-label={t("studio.header.apps")} className="df-mobile-menu-nav">
                {navigationItems(t, state, "studio.menu.studioHome", rt("title"), appsCopy.navLabel).map(item => (
                  <Link key={item.id} href={item.href} data-nav-item={item.id} aria-current={item.active ? "page" : undefined} onClick={close} className="df-mobile-nav-link">
                    <StudioIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {item.id === "apps" ? <span className="df-sidebar-hot-badge">{appsCopy.navBadge}</span> : null}
                      {item.id === "projects" && activeTaskCount > 0 ? <b className="df-sidebar-task-badge" data-active-task-badge>{activeTaskCount > 9 ? "9+" : activeTaskCount}</b> : null}
                    </span>
                  </Link>
                ))}
              </nav>
              <div className="df-mobile-menu-preferences">
                <StudioThemeToggle locale={locale} showLabel />
                <details className="df-mobile-menu-language" data-mobile-menu-language>
                  <summary tabIndex={0}>
                    <StudioIcon name="globe" className="h-[18px] w-[18px]" />
                    <span>{t("studio.language")}</span>
                    <span className="df-mobile-menu-current-language" lang={locale} dir="auto">{localeLabels[locale]}</span>
                    <StudioIcon name="chevron-down" className="df-mobile-menu-chevron" />
                  </summary>
                  <div className="df-mobile-menu-languages">
                    {locales.map(itemLocale => (
                      <button
                        key={itemLocale}
                        type="button"
                        data-studio-language-option={itemLocale}
                        aria-pressed={locale === itemLocale}
                        onClick={() => {
                          onLocaleChange(itemLocale);
                          close();
                        }}
                      >
                        <span lang={itemLocale} dir="auto">{localeLabels[itemLocale]}</span>
                        {locale === itemLocale ? <StudioIcon name="check" className="h-4 w-4" /> : null}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </div>
            <div className="df-mobile-menu-footer">
              {signedIn ? <>
                <StudioAccountSummary t={t} locale={locale} signedIn creditBalance={creditBalance} onOpenCredits={() => { close(); onOpenCredits(); }} />
                <StudioSignOutButton t={t} />
              </> : <AuthLink href={signInUrl} onClick={close} className="df-mobile-menu-sign-in">{t("studio.auth.signIn")}</AuthLink>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
