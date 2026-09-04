"use client";

import Link from "next/link";
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
  mode: StudioNavigationMode;
  isAppsHome: boolean;
  isProjectsView: boolean;
};

type NavigationItem = {
  id: "home" | StudioNavigationMode | "projects" | "billing";
  label: string;
  href: string;
  icon: StudioIconName;
  visualIcon: string;
  active: boolean;
};

function navigationItems(t: Translate, state: NavigationState, homeLabelKey = "studio.nav.home"): NavigationItem[] {
  const inWorkbench = !state.isAppsHome && !state.isProjectsView;
  return [
    { id: "home", label: t(homeLabelKey), href: "/studio?view=home", icon: "home", visualIcon: "✦", active: state.isAppsHome },
    { id: "avatar", label: t("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=minimax-h3-max-turbo-video", icon: "video", visualIcon: "💬", active: inWorkbench && state.mode === "avatar" },
    { id: "image", label: t("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image", visualIcon: "🖼️", active: inWorkbench && state.mode === "image" },
    { id: "video", label: t("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video", visualIcon: "🎞️", active: inWorkbench && state.mode === "video" },
    { id: "audio", label: t("studio.nav.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio", visualIcon: "🎵", active: inWorkbench && state.mode === "audio" },
    { id: "projects", label: t("studio.nav.projects"), href: "/studio?view=projects", icon: "projects", visualIcon: "📁", active: state.isProjectsView },
    { id: "billing", label: t("studio.billing.open"), href: "/billing", icon: "billing", visualIcon: "💳", active: false }
  ];
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
  t: Translate;
  modern: boolean;
  videoStudio?: boolean;
  collapsed?: boolean;
  creditBalance?: number | null;
  signedIn?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onImageWorkflowSelected: (workflowLabel: string) => void;
};

export function StudioSidebar({ t, modern, videoStudio = false, collapsed = false, creditBalance = null, signedIn = false, onCollapsedChange, onImageWorkflowSelected, ...state }: StudioSidebarProps) {
  const items = navigationItems(t, state);
  const imageWorkflows = [
    { label: t("studio.workflow.text-to-image"), body: t("studio.home.quick.textImage"), href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image" },
    { label: t("studio.workflow.image-to-image"), body: t("studio.home.quick.imageImage"), href: "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image" },
    { label: t("studio.workflow.enhance-cleanup"), body: t("studio.home.quick.enhance"), href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image" },
    { label: t("studio.workflow.background-remove"), body: t("studio.home.quick.remove"), href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove" }
  ];

  if (videoStudio) {
    const videoItems: Array<{ label: string; href: string; icon: string; active?: boolean }> = [
      { label: t("studio.workbench.navStudio"), href: "/studio?view=home", icon: "✦", active: state.isAppsHome },
      { label: t("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=minimax-h3-max-turbo-video", icon: "💬", active: state.mode === "avatar" && !state.isProjectsView },
      { label: t("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "🖼️", active: state.mode === "image" && !state.isProjectsView },
      { label: t("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "🎞️", active: state.mode === "video" && !state.isAppsHome && !state.isProjectsView },
      { label: t("studio.nav.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "🎵", active: state.mode === "audio" && !state.isProjectsView },
      { label: t("studio.nav.projects"), href: "/studio?view=projects", icon: "📁", active: state.isProjectsView }
    ];
    videoItems.push({ label: t("studio.billing.open"), href: "/billing", icon: "💳", active: false });

    return (
      <aside className="relative hidden h-screen flex-col border-r border-[#eaecf0] bg-white/90 px-3.5 py-5 backdrop-blur-xl lg:sticky lg:top-0 lg:flex">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={t(collapsed ? "studio.menu.open" : "studio.menu.close")}
          title={t(collapsed ? "studio.menu.open" : "studio.menu.close")}
          className="group absolute -end-3 top-1/2 z-30 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[#ded8ff] bg-white text-[#6a5af9] shadow-[0_5px_16px_rgba(73,56,180,0.16)] transition duration-200 hover:scale-110 hover:border-[#bcb1ff] hover:bg-[#f7f5ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a78ff] focus-visible:ring-offset-2"
        >
          <StudioIcon name={collapsed ? "chevron-right" : "chevron-left"} className="h-3.5 w-3.5" />
          <span className="pointer-events-none absolute start-full ms-2.5 whitespace-nowrap rounded-lg bg-[#101828] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{t(collapsed ? "studio.menu.open" : "studio.menu.close")}</span>
        </button>
        <a href="https://dreamface.io" className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
          <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm"><img src="/icons/icon-512x512.png" alt="" className="h-full w-full object-cover" /></span>
          {!collapsed ? <span className="min-w-0"><strong className="block text-[17px] font-black leading-none tracking-tight text-[#101828]">DreamFace</strong><span className="mt-1 block text-[11px] text-[#98a2b3]">AI Studio</span></span> : null}
        </a>
        <nav className="mt-6 grid gap-1.5">
          {videoItems.map((item) => <Link key={`${item.label}-${item.href}`} href={item.href} title={collapsed ? item.label : undefined} className={`flex h-11 items-center rounded-[14px] text-sm transition ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${item.active ? "bg-[#f1efff] font-bold text-[#6a5af9]" : "text-[#344054] hover:bg-[#f8f8fb]"}`}><span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center text-[16px] leading-none ${item.icon === "✦" ? "text-[#7458ff]" : ""}`}>{item.icon}</span>{!collapsed ? <span className="truncate">{item.label}</span> : null}</Link>)}
        </nav>
        <div className="flex-1" />
        <div className={`mx-[-14px] mb-[-14px] mt-2.5 flex items-center border-t border-[#eaecf0] bg-white/95 px-3.5 py-3 ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#fde1c8,#b57f63)] text-sm">DF</span>
          {!collapsed ? <span className="min-w-0"><strong className="block truncate text-[13px] text-[#101828]">{t(signedIn ? "studio.workbench.user" : "studio.workbench.guest")}</strong><span className="mt-1 block text-[11px] text-[#98a2b3]">{creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("studio.common.credits")}</span></span> : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className={`hidden border-r lg:flex lg:flex-col lg:items-center ${modern ? "border-[#758bac]/15 bg-[#f5faff]/60 px-3 py-5" : "border-black/[0.06] bg-white/64 px-3 py-5"}`}>
      <a href="https://dreamface.io" aria-label={t("studio.menu.dreamfaceHome")} className="block h-12 w-12 overflow-hidden rounded-2xl shadow-[0_16px_36px_rgba(16,130,101,0.22)] transition hover:-translate-y-0.5">
        <img src="/icons/icon-512x512.png" alt="" width={48} height={48} className="h-full w-full object-cover" />
      </a>
      <nav className={modern ? "mt-[26px] grid w-full gap-2.5" : "mt-9 flex w-full flex-col items-center gap-4"}>
        {items.map((item) => {
          const link = (
            <Link href={item.href} className={`group flex w-full min-w-0 flex-col items-center gap-1 overflow-hidden rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${item.active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#6b7280] hover:bg-black/[0.035] hover:text-[#202633]"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-xl border text-sm ${item.active ? "border-[#bae6fd] bg-white text-[#0ea5e9]" : "border-black/[0.06] bg-white/70 text-[#667085]"}`}><StudioIcon name={item.icon} className="h-4 w-4" /></span>
              <span className="block max-w-full text-center leading-tight [overflow-wrap:anywhere]">{item.label}</span>
            </Link>
          );
          if (item.id !== "image") return <div key={item.id}>{link}</div>;
          return (
            <div key={item.id} className="group relative w-full">
              {link}
              <div className="pointer-events-none absolute left-full top-0 z-50 w-64 translate-x-2 pl-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
                <div className="rounded-3xl border border-black/[0.06] bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                  {imageWorkflows.map((workflow) => (
                    <Link key={workflow.label} href={workflow.href} onClick={() => onImageWorkflowSelected(workflow.label)} className="block rounded-2xl px-4 py-3 text-left transition hover:bg-[#f3f8ff]">
                      <span className="text-sm font-semibold text-[#202633]">{workflow.label}</span>
                      <span className="mt-1 block text-xs font-medium text-[#8b95a7]">{workflow.body}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      <Link href="/billing" className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#ecfeff] px-2 py-2 text-center text-[11px] font-semibold leading-tight text-[#06b6d4]">{t("studio.billing.open")}</Link>
    </aside>
  );
}

export function StudioBottomNavigation({ t, ...state }: NavigationState & { t: Translate }) {
  const itemsById = new Map(navigationItems(t, state).map((item) => [item.id, item]));
  const items = (["home", "avatar", "image", "video", "audio", "projects"] as const).map((id) => itemsById.get(id)!);

  return (
    <nav className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 isolate grid grid-cols-6 gap-0.5 rounded-[1.25rem] border border-[#e5e1eb] bg-white p-1 shadow-[0_18px_50px_rgba(15,23,42,0.2)] sm:inset-x-3 sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-1 sm:rounded-[1.4rem] sm:p-1.5 lg:hidden">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className={`min-h-12 min-w-0 flex flex-col items-center justify-center gap-1 rounded-[0.9rem] px-0.5 py-1.5 text-[9px] font-semibold transition sm:rounded-[1rem] sm:px-2 sm:text-[11px] ${item.active ? "bg-[#eeeaff] text-[#6955f6] shadow-[inset_0_0_0_1px_#ddd7ff]" : "text-[#667085]"}`}>
          <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-lg text-[15px] leading-none ${item.active ? "bg-white shadow-sm" : "bg-[#f6f7fa]"}`}>{item.visualIcon}</span>
          <span className="max-w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
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
  const close = () => onOpenChange(false);
  return (
    <div className="relative shrink-0">
      <button type="button" aria-label={open ? t("studio.menu.close") : t("studio.menu.open")} aria-expanded={open} onClick={() => onOpenChange(!open)} className="relative z-[65] grid h-11 w-11 place-items-center overflow-visible rounded-[14px] border border-[#e3dfff] bg-white text-[#5f4ee9] shadow-[0_7px_20px_rgba(86,68,210,0.12)] transition hover:-translate-y-px hover:border-[#bfb5ff] lg:hidden">
        {open ? <StudioIcon name="x" className="h-5 w-5" /> : <><img src="/icons/icon-512x512.png" alt="" className="h-8 w-8 rounded-[10px] object-cover" /><span className="absolute -bottom-1 -end-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-white bg-[linear-gradient(135deg,#7c63ff,#5b4bea)] text-white shadow-sm"><StudioIcon name="menu" className="h-2.5 w-2.5" /></span></>}
      </button>
      <Link href="/studio?view=home" aria-label={t("studio.menu.studioHome")} className="hidden h-10 w-10 place-items-center rounded-full border border-black/[0.08] bg-white text-[#202633] shadow-sm transition hover:bg-[#f8fbff] lg:grid"><StudioIcon name="home" className="h-5 w-5" /></Link>
      {open ? (
        <>
          <button type="button" aria-label={t("studio.menu.close")} onClick={close} className="fixed inset-0 z-[55] cursor-default bg-transparent lg:hidden" />
          <div className="fixed left-4 top-[4.45rem] z-[60] max-h-[calc(100dvh-6rem)] w-[min(17rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.15rem] border border-black/[0.08] bg-white p-1.5 shadow-[0_18px_52px_rgba(15,23,42,0.20)] lg:hidden">
            <a href="https://dreamface.io/" onClick={close} className="mb-1 flex items-center gap-3 border-b border-black/[0.06] px-2.5 pb-3 pt-1.5 text-base font-black tracking-tight text-[#202633]">
              <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[13px] shadow-[0_9px_22px_rgba(16,130,101,0.18)]"><img src="/icons/icon-512x512.png" alt="" width={40} height={40} className="h-full w-full object-cover" /></span>
              DreamFace
            </a>
            {navigationItems(t, state, "studio.menu.studioHome").map((item) => (
              <Link key={item.id} href={item.href} onClick={close} className={`flex items-center gap-3 rounded-[1rem] px-2.5 py-2.5 text-sm font-semibold transition ${item.active ? "bg-[#f1efff] text-[#6955f6]" : "text-[#485164] hover:bg-[#f6f5ff] hover:text-[#202633]"}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl border text-base ${item.active ? "border-[#d8d1ff] bg-white shadow-sm" : "border-[#eceaf2] bg-[#faf9fc]"}`}>{item.visualIcon}</span>
                {item.label}
              </Link>
            ))}
            {!signedIn ? <Link href={signInUrl} onClick={close} className="mt-1 flex items-center justify-center rounded-[1rem] bg-[#202633] px-3 py-3 text-sm font-semibold text-white shadow-sm">{t("studio.auth.signIn")}</Link> : null}
            <div className="mt-1 border-t border-black/[0.06] px-2 pb-1 pt-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-[#8b95a7]"><StudioIcon name="globe" className="h-4 w-4" /><span>{t("studio.language")}</span></div>
              <div className="grid grid-cols-2 gap-1">
                {locales.map((itemLocale) => (
                  <button key={itemLocale} type="button" onClick={() => { onLocaleChange(itemLocale); close(); }} className={`min-h-10 rounded-xl px-2 py-2 text-left text-xs font-bold transition ${locale === itemLocale ? "bg-[#e8f7ff] text-[#0284c7]" : "bg-[#f8fafc] text-[#485164] hover:bg-[#f1f5f9]"}`}>{localeLabels[itemLocale]}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
