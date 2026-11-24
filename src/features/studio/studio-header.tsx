"use client";

import { memo, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AuthLink } from "../../components/auth-link";
import type { Locale } from "../../i18n/routing";
import { referralTranslator } from "../../lib/referral-i18n";
import { StudioIcon, StudioMobileMenu, type StudioNavigationMode } from "./studio-navigation";
import { StudioActionLink, StudioButton } from "./studio-primitives";
import { StudioThemeToggle } from "./studio-theme-toggle";

type Translate = (key: string, values?: Record<string, string | number>) => string;

type StudioHeaderProps = {
  isBillingView?: boolean;
  billingHref?: string;
  referralsVisible?: boolean;
  isReferralsView?: boolean;
  t: Translate;
  mode: StudioNavigationMode;
  isAppsHome: boolean;
  isProjectsView: boolean;
  mobileMenuOpen: boolean;
  signedIn: boolean;
  signInUrl: string;
  signInLink?: ReactNode;
  locale: Locale;
  locales: readonly Locale[];
  localeLabels: Record<Locale, string>;
  creditBalance: number | null;
  activeTaskCount?: number;
  onMobileMenuOpenChange: (open: boolean) => void;
  onLocaleChange: (locale: Locale) => void;
  onBillingOpen: (source: "balance" | "vip_badge") => void;
};

function headerCopy(t: Translate, mode: StudioNavigationMode, isAppsHome: boolean, isProjectsView: boolean) {
  if (isProjectsView) return { title: t("studio.header.projects"), description: t("studio.header.projectsDescription") };
  if (isAppsHome) return { title: t("studio.header.toolkit"), description: t("studio.header.toolkitDescription") };
  if (mode === "image") return { title: t("studio.header.image"), description: t("studio.header.imageDescription") };
  if (mode === "audio") return { title: t("studio.header.audio"), description: t("studio.header.audioDescription") };
  if (mode === "avatar") return { title: t("studio.header.avatar"), description: t("studio.header.avatarDescription") };
  return { title: t("studio.header.video"), description: t("studio.header.videoDescription") };
}

function StudioLanguageMenu({ label, locale, locales, localeLabels, onLocaleChange }: Pick<StudioHeaderProps, "locale" | "locales" | "localeLabels" | "onLocaleChange"> & { label: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const currentOption = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    currentOption.current?.focus();
    const mobile = window.matchMedia("(max-width: 767px)");
    function dismissOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function dismissOnMobile() {
      if (mobile.matches) setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    mobile.addEventListener("change", dismissOnMobile);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      mobile.removeEventListener("change", dismissOnMobile);
    };
  }, [open]);

  function closeAndFocusTrigger() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <div
      ref={root}
      className="df-studio-language"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        closeAndFocusTrigger();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="df-studio-language-trigger"
        data-studio-language-trigger
        aria-label={`${label} · ${localeLabels[locale]}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="df-studio-language-emblem"><StudioIcon name="globe" className="h-3.5 w-3.5" /></span>
        <span lang={locale} dir="auto">{localeLabels[locale]}</span>
        <StudioIcon name="chevron-down" className="df-studio-language-chevron" />
      </button>
      {open ? (
        <div id={menuId} role="group" aria-label={label} className="df-studio-language-menu">
          <div className="df-studio-language-heading">{label}</div>
          <div className="df-studio-language-options">
            {locales.map((item) => (
              <button
                key={item}
                ref={item === locale ? currentOption : undefined}
                type="button"
                data-studio-language-option={item}
                aria-pressed={item === locale}
                onClick={() => {
                  closeAndFocusTrigger();
                  if (item !== locale) onLocaleChange(item);
                }}
              >
                <span lang={item} dir="auto">{localeLabels[item]}</span>
                {item === locale ? <StudioIcon name="check" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const StudioHeader = memo(function StudioHeader({
  isBillingView = false,
  billingHref,
  referralsVisible = false,
  isReferralsView = false,
  t,
  mode,
  isAppsHome,
  isProjectsView,
  mobileMenuOpen,
  signedIn,
  signInUrl,
  signInLink,
  locale,
  locales,
  localeLabels,
  creditBalance,
  activeTaskCount = 0,
  onMobileMenuOpenChange,
  onLocaleChange,
  onBillingOpen
}: StudioHeaderProps) {
  const rt = referralTranslator(locale);
  const copy = isBillingView
    ? { title: t("studio.billing.open"), description: "" }
    : isReferralsView
      ? { title: rt("title"), description: rt("history") }
      : headerCopy(t, mode, isAppsHome, isProjectsView);

  const workspaceTitle = !isAppsHome && !isProjectsView && !isBillingView && !isReferralsView
    ? t("studio.workspace.title", { name: t(mode === "avatar" ? "studio.workspace.avatar" : `studio.nav.${mode}`) })
    : copy.title;
  const languageMenu = <StudioLanguageMenu label={t("studio.language")} locale={locale} locales={locales} localeLabels={localeLabels} onLocaleChange={onLocaleChange} />;

  return (
    <header className="studio-topbar df-app-header">
      <div className="df-header-title">
        <StudioMobileMenu
          isBillingView={isBillingView}
          billingHref={billingHref}
          referralsVisible={referralsVisible}
          t={t}
          open={mobileMenuOpen}
          signedIn={signedIn}
          creditBalance={creditBalance}
          activeTaskCount={activeTaskCount}
          signInUrl={signInUrl}
          locale={locale}
          locales={locales}
          localeLabels={localeLabels}
          mode={mode}
          isAppsHome={isAppsHome}
          isProjectsView={isProjectsView}
          isReferralsView={isReferralsView}
          onOpenChange={onMobileMenuOpenChange}
          onOpenCredits={() => onBillingOpen("balance")}
          onLocaleChange={onLocaleChange}
        />
      </div>
      <h1 className="df-workspace-heading" title={workspaceTitle}>
        <span className="df-desktop-workspace-title">{copy.title}</span>
        <span className="df-mobile-workspace-title">{workspaceTitle}</span>
      </h1>
      <div className="df-header-actions" data-signed-in={signedIn}>
        <StudioThemeToggle locale={locale} />
        <StudioButton variant="ghost" className="df-credit-balance" onClick={() => onBillingOpen("balance")}>
          <span className="df-credit-dot" aria-hidden="true" />
          <span>{creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("studio.common.credits")}</span>
        </StudioButton>
        <StudioButton className="df-buy-credits" onClick={() => onBillingOpen("vip_badge")} aria-label={t("creditShop.buy")}>
          <StudioIcon name="billing" className="h-4 w-4" />
          <span>{t("creditShop.buy")}</span>
        </StudioButton>
        {languageMenu}
        {signedIn ? (
          <StudioActionLink
            variant="ghost"
            className="df-account relative"
            href="/studio?view=projects"
            aria-label={activeTaskCount > 0 ? `${t("studio.nav.projects")} (${t("studio.summary.runningTasks", { count: activeTaskCount })})` : t("studio.nav.projects")}
          >
            <StudioIcon name="user" className="h-[18px] w-[18px]" />
            {activeTaskCount > 0 ? <span className="df-account-task-dot" aria-hidden="true" /> : null}
          </StudioActionLink>
        ) : (
          signInLink || (
            <AuthLink className="df-button df-button--secondary df-sign-in" href={signInUrl}>
              <span>{t("studio.auth.signIn")}</span>
            </AuthLink>
          )
        )}
      </div>
    </header>
  );
});
