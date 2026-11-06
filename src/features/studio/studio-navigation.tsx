"use client";

import Link from "./studio-link";
import { useEffect, useId, useRef } from "react";
import { useStudioDialog } from "./use-studio-dialog";
import {BrandMark} from "../../components/brand-mark";
import { StudioThemeToggle } from "./studio-theme-toggle";
import { referralTranslator } from "../../lib/referral-i18n";
import type { Locale } from "../../i18n/routing";

export type StudioNavigationMode = "image" | "video" | "audio" | "avatar";

export type StudioIconName =
  | "home"
  | "image"
  | "video"
  | "gallery"
  | "projects"
  | "sparkles"
  | "wand"
  | "film"
  | "motion"
  | "cleanup"
  | "audio"
  | "billing"
  | "globe"
  | "user"
  | "menu"
  | "x"
  | "chevron-left"
  | "chevron-right";

type Translate = (key: string, values?: Record<string, string | number>) => string;

type NavigationState = {
  isBillingView?: boolean;
  billingHref?: string;
  referralsVisible?: boolean;
  isReferralsView?: boolean;
  mode: StudioNavigationMode;
  isAppsHome: boolean;
  isProjectsView: boolean;
};

type NavigationItem = {
  id: "home" | StudioNavigationMode | "projects" | "billing" | "referrals";
  label: string;
  href: string;
  icon: StudioIconName;
  visualIcon: string;
  active: boolean;
};

function navigationItems(t: Translate, state: NavigationState, homeLabelKey = "studio.nav.home", referralLabel="Invite friends"): NavigationItem[] {
  const inWorkbench = !state.isAppsHome && !state.isProjectsView && !state.isBillingView;
  return ([
    { id: "home", label: t(homeLabelKey), href: "/studio?view=home", icon: "home", visualIcon: "✦", active: state.isAppsHome },
    { id: "avatar", label: t("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=heygen-video", icon: "video", visualIcon: "💬", active: inWorkbench && state.mode === "avatar" },
    { id: "video", label: t("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video", visualIcon: "🎞️", active: inWorkbench && state.mode === "video" },
    { id: "image", label: t("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image", visualIcon: "🖼️", active: inWorkbench && state.mode === "image" },
    { id: "audio", label: t("studio.nav.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio", visualIcon: "🎵", active: inWorkbench && state.mode === "audio" },
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
  if (name === "video" || name === "film") return <svg {...common}><rect x="4" y="6" width="12" height="12" rx="3" /><path d="m16 10 4-2.2v8.4L16 14" /></svg>;
  if (name === "gallery") return <svg {...common}><rect x="5" y="5" width="8" height="8" rx="2" /><rect x="11" y="11" width="8" height="8" rx="2" /></svg>;
  if (name === "projects") return <svg {...common}><path d="M4 7.5h6l2 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M4 7.5V6a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v1.5" /></svg>;
  if (name === "sparkles") return <svg {...common}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" /><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" /><path d="m5.5 13 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" /></svg>;
  if (name === "wand") return <svg {...common}><path d="m4 20 12-12" /><path d="m14 6 4 4" /><path d="M5 4v3" /><path d="M3.5 5.5h3" /><path d="M19 15v3" /><path d="M17.5 16.5h3" /></svg>;
  if (name === "motion") return <svg {...common}><path d="M5 6h9a5 5 0 0 1 0 10H8" /><path d="m8 12 4 4-4 4" /><path d="M4 10h5" /></svg>;
  if (name === "cleanup") return <svg {...common}><path d="m5 19 10.5-10.5a2.1 2.1 0 0 1 3 3L8 22H5Z" /><path d="m13 11 3 3" /><path d="M6 5h.01" /><path d="M10 3h.01" /><path d="M4 9h.01" /></svg>;
  if (name === "audio") return <svg {...common}><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>;
  if (name === "billing") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>;
  if (name === "globe") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
  if (name === "menu") return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
  if (name === "x") return <svg {...common}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
  return <svg {...common}><path d={name === "chevron-left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>;
}

type StudioSidebarProps = NavigationState & {
  referralLocale?: string;
  t: Translate;
  modern: boolean;
  videoStudio?: boolean;
  collapsed?: boolean;
  creditBalance?: number | null;
  signedIn?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onImageWorkflowSelected: (workflowLabel: string) => void;
};

export function StudioSidebar({ t, modern, referralLocale = "en", videoStudio = false, collapsed = false, creditBalance = null, signedIn = false, onCollapsedChange, onImageWorkflowSelected, ...state }: StudioSidebarProps) {
  const rt = referralTranslator(referralLocale);
  const items = navigationItems(t, state,"studio.nav.home",rt("title"));
  const imageWorkflows = [
    { label: t("studio.workflow.text-to-image"), body: t("studio.home.quick.textImage"), href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image" },
    { label: t("studio.workflow.image-to-image"), body: t("studio.home.quick.imageImage"), href: "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image" },
    { label: t("studio.workflow.enhance-cleanup"), body: t("studio.home.quick.enhance"), href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image" },
    { label: t("studio.workflow.background-remove"), body: t("studio.home.quick.remove"), href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove" }
  ];

  if (videoStudio) {
    return (
      <aside data-studio-sidebar data-collapsed={collapsed} className="studio-sidebar relative hidden h-screen flex-col border-e border-[var(--studio-border)] bg-[var(--studio-panel)] px-3.5 py-5 md:sticky md:top-0 md:flex">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={t(collapsed ? "studio.menu.open" : "studio.menu.close")}
          title={t(collapsed ? "studio.menu.open" : "studio.menu.close")}
          className="group absolute -end-3 top-1/2 z-30 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--studio-accent-border)] bg-[var(--studio-panel)] text-[var(--studio-accent)] shadow-none transition duration-200 hover:scale-110 hover:border-[var(--studio-accent-border)] hover:bg-[var(--studio-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent-border)] focus-visible:ring-offset-2"
        >
          <StudioIcon name={collapsed ? "chevron-right" : "chevron-left"} className="h-3.5 w-3.5" />
          <span className="pointer-events-none absolute start-full ms-2.5 whitespace-nowrap rounded-lg bg-[var(--studio-primary)] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{t(collapsed ? "studio.menu.open" : "studio.menu.close")}</span>
        </button>
        <a href="https://dreamface.io" className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
          <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm"><BrandMark alt="" className="h-full w-full object-cover" /></span>
          {!collapsed ? <span className="min-w-0"><strong className="block text-[17px] font-semibold leading-none tracking-tight text-[var(--studio-text)]">DreamFace</strong><span className="mt-1 block text-[11px] text-[var(--studio-muted)]">AI Studio</span></span> : null}
        </a>
        <nav aria-label={t("studio.header.apps")} className="mt-8 grid gap-1.5">
          {items.map((item) => <Link key={`${item.label}-${item.href}`} href={item.href} title={item.label} aria-current={item.active ? "page" : undefined} className={`df-sidebar-item flex h-11 items-center rounded-[10px] text-sm transition ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${item.active ? "bg-[var(--studio-accent-soft)] font-bold text-[var(--studio-accent)]" : "text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"}`}><StudioIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />{!collapsed ? <span className="truncate">{item.label}</span> : null}</Link>)}
        </nav>
        <div className="flex-1" />
        <div className={`mx-[-14px] mb-[-14px] mt-2.5 flex items-center border-t border-[var(--studio-border)] bg-[var(--studio-panel)] px-3.5 py-3 ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--studio-surface)] text-sm">DF</span>
          {!collapsed ? <span className="min-w-0"><strong className="block truncate text-[13px] text-[var(--studio-text)]">{t(signedIn ? "studio.workbench.user" : "studio.workbench.guest")}</strong><span className="mt-1 block text-[11px] text-[var(--studio-muted)]">{creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("studio.common.credits")}</span></span> : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className={`hidden border-r lg:flex lg:flex-col lg:items-center ${modern ? "border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 py-5" : "border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-5"}`}>
      <a href="https://dreamface.io" aria-label={t("studio.menu.dreamfaceHome")} className="block h-12 w-12 overflow-hidden rounded-2xl shadow-none transition hover:-translate-y-0.5">
        <BrandMark alt="" width={48} height={48} className="h-full w-full object-cover" />
      </a>
      <nav className={modern ? "mt-[26px] grid w-full gap-2.5" : "mt-9 flex w-full flex-col items-center gap-4"}>
        {items.map((item) => {
          const link = (
            <Link href={item.href} className={`group flex w-full min-w-0 flex-col items-center gap-1 overflow-hidden rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${item.active ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "text-[var(--studio-muted)] hover:bg-black/[0.035] hover:text-[var(--studio-text)]"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-xl border text-sm ${item.active ? "border-[var(--studio-accent-border)] bg-[var(--studio-panel)] text-[var(--studio-accent)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-muted)]"}`}><StudioIcon name={item.icon} className="h-4 w-4" /></span>
              <span className="block max-w-full text-center leading-tight [overflow-wrap:anywhere]">{item.label}</span>
            </Link>
          );
          if (item.id !== "image") return <div key={item.id}>{link}</div>;
          return (
            <div key={item.id} className="group relative w-full">
              {link}
              <div className="pointer-events-none absolute left-full top-0 z-50 w-64 translate-x-2 pl-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
                <div className="rounded-3xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2 shadow-none backdrop-blur-xl">
                  {imageWorkflows.map((workflow) => (
                    <Link key={workflow.label} href={workflow.href} onClick={() => onImageWorkflowSelected(workflow.label)} className="block rounded-2xl px-4 py-3 text-left transition hover:bg-[var(--studio-accent-soft)]">
                      <span className="text-sm font-semibold text-[var(--studio-text)]">{workflow.label}</span>
                      <span className="mt-1 block text-xs font-medium text-[var(--studio-muted)]">{workflow.body}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      <Link href={state.billingHref || "/studio?view=billing"} className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[var(--studio-accent-soft)] px-2 py-2 text-center text-[11px] font-semibold leading-tight text-[var(--studio-accent)]">{t("studio.billing.open")}</Link>
    </aside>
  );
}

export function StudioBottomNavigation({ t, ...state }: NavigationState & { t: Translate }) {
  const items = navigationItems(t, state).filter(item => ["home", "video", "image", "audio", "avatar", "projects"].includes(item.id));

  return (
    <nav className="df-mobile-dock fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 isolate grid grid-cols-6 gap-0.5 rounded-[1.25rem] border border-[var(--studio-border)] bg-[var(--studio-panel)] p-1 shadow-none sm:inset-x-3 sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-1 sm:rounded-[1.4rem] sm:p-1.5 md:hidden">
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={item.active ? "page" : undefined} className={`min-h-12 min-w-0 flex flex-col items-center justify-center gap-1 rounded-[0.9rem] px-0.5 py-1.5 text-[9px] font-semibold transition sm:rounded-[1rem] sm:px-2 sm:text-[11px] ${item.active ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)] shadow-none" : "text-[var(--studio-muted)]"}`}>
          <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-lg text-[15px] leading-none ${item.active ? "bg-[var(--studio-panel)] shadow-sm" : "bg-[var(--studio-surface)]"}`}><StudioIcon name={item.icon} className="h-[18px] w-[18px]" /></span>
          <span className="max-w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** A compact workspace menu is integrated into the current mobile page title. */
export function StudioWorkspaceSwitcher({ t, title, open, onOpenChange, ...state }: NavigationState & {
  t: Translate; title: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const items = navigationItems(t, state).filter(item => ["video", "image", "audio", "avatar"].includes(item.id));
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const close = () => onOpenChange(false);
  useStudioDialog(open, dialogRef, { onClose: close, lockScroll: false });
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const resized = () => { if (desktop.matches) onOpenChange(false); };
    resized(); desktop.addEventListener("change", resized);
    return () => desktop.removeEventListener("change", resized);
  }, [open, onOpenChange]);
  return <div className="df-workspace-switcher">
    <h1><button type="button" data-workspace-switcher-trigger aria-label={`${title} · ${t("studio.workspace.switch")}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} onClick={() => onOpenChange(!open)}>
      <span>{title}</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button></h1>
    {open ? <>
      <button type="button" className="df-workspace-backdrop" aria-label={t("studio.menu.close")} onClick={close} />
      <div id={dialogId} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("studio.workspace.switch")} className="df-workspace-menu">
        <div className="df-workspace-menu-heading"><span>{t("studio.workspace.switch")}</span><button type="button" aria-label={t("studio.menu.close")} onClick={close}><StudioIcon name="x" className="h-4 w-4" /></button></div>
        <nav aria-label={t("studio.workspace.switch")}>
          {items.map(item => <Link key={item.id} href={item.href} onClick={close} aria-current={item.active ? "page" : undefined}>
            <StudioIcon name={item.id === "avatar" ? "user" : item.icon} className="h-[18px] w-[18px] shrink-0" /><span>{item.id === "avatar" ? t("studio.workspace.avatar") : item.label}</span>
            {item.active ? <span aria-hidden="true" className="df-workspace-check">✓</span> : null}
          </Link>)}
        </nav>
      </div>
    </> : null}
  </div>;
}

type StudioMobileMenuProps = NavigationState & {
  t: Translate;
  open: boolean;
  signedIn: boolean;
  signInUrl: string;
  locale: Locale;
  locales: readonly Locale[];
  localeLabels: Record<Locale, string>;
  onOpenChange: (open: boolean) => void;
  onLocaleChange: (locale: Locale) => void;
};

export function StudioMobileMenu({ t, open, signedIn, signInUrl, locale, locales, localeLabels, onOpenChange, onLocaleChange, ...state }: StudioMobileMenuProps) {
  const rt=referralTranslator(locale);
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
      <button type="button" data-mobile-menu-trigger aria-label={open ? t("studio.menu.close") : t("studio.menu.open")} aria-expanded={open} aria-controls={open ? menuId : undefined} aria-haspopup="dialog" onClick={() => onOpenChange(!open)} className="df-mobile-menu-trigger grid h-11 w-11 place-items-center rounded-[10px] text-[var(--studio-text)] transition hover:bg-[var(--studio-surface)] md:hidden">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16"/></svg>
      </button>
      <Link href="/studio?view=home" aria-label={t("studio.menu.studioHome")} className="hidden h-10 w-10 place-items-center rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)] shadow-sm transition hover:bg-[var(--studio-accent-soft)] md:grid"><StudioIcon name="home" className="h-5 w-5" /></Link>
      {open ? (
        <>
          <button type="button" aria-label={t("studio.menu.close")} onClick={close} className="df-mobile-menu-backdrop fixed inset-0 z-[55] cursor-default bg-black/40 md:hidden" />
          <div ref={menuRef} id={menuId} data-mobile-menu role="dialog" aria-modal="true" aria-label={t("studio.menu.open")} tabIndex={-1} className="df-mobile-menu fixed start-0 top-0 z-[60] h-dvh w-[min(20rem,calc(100vw-3rem))] overflow-y-auto overscroll-contain border-e border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 shadow-none outline-none md:hidden">
            <div className="mb-1 flex items-center gap-2 border-b border-[var(--studio-border)] px-2.5 pb-3 pt-1.5">
            <a href="https://dreamface.io/" onClick={close} className="flex min-w-0 flex-1 items-center gap-3 text-base font-semibold tracking-tight text-[var(--studio-text)]">
              <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[13px] shadow-none"><BrandMark alt="" width={40} height={40} className="h-full w-full object-cover" /></span>
              DreamFace
            </a>
            <button type="button" onClick={close} aria-label={t("studio.menu.close")} className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[var(--studio-muted)] hover:bg-[var(--studio-surface)]"><StudioIcon name="x" className="h-5 w-5" /></button>
            </div>
            {navigationItems(t, state, "studio.menu.studioHome",rt("title")).map((item) => (
              <Link key={item.id} href={item.href} aria-current={item.active ? "page" : undefined} onClick={close} className={`df-mobile-nav-link flex items-center gap-3 rounded-[1rem] px-2.5 py-2.5 text-sm font-semibold transition ${item.active ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "text-[var(--studio-text)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-text)]"}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl border text-base ${item.active ? "border-[var(--studio-accent-border)] bg-[var(--studio-panel)] shadow-sm" : "border-[var(--studio-border)] bg-[var(--studio-surface)]"}`}><StudioIcon name={item.icon} className="h-[18px] w-[18px]" /></span>
                {item.label}
              </Link>
            ))}
            <div className="df-mobile-menu-appearance"><StudioThemeToggle locale={locale} showLabel /></div>
            {!signedIn ? <Link href={signInUrl} onClick={close} className="mt-1 flex items-center justify-center rounded-[1rem] bg-[var(--studio-primary)] px-3 py-3 text-sm font-semibold text-white shadow-sm">{t("studio.auth.signIn")}</Link> : null}
            <div className="mt-1 border-t border-[var(--studio-border)] px-2 pb-1 pt-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-[var(--studio-muted)]"><StudioIcon name="globe" className="h-4 w-4" /><span>{t("studio.language")}</span></div>
              <div className="grid grid-cols-2 gap-1">
                {locales.map((itemLocale) => (
                  <button key={itemLocale} type="button" aria-pressed={locale === itemLocale} onClick={() => { onLocaleChange(itemLocale); close(); }} className={`min-h-10 rounded-xl px-2 py-2 text-start text-xs font-bold transition ${locale === itemLocale ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "bg-[var(--studio-accent-soft)] text-[var(--studio-text)] hover:bg-[var(--studio-accent-soft)]"}`}>{localeLabels[itemLocale]}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
