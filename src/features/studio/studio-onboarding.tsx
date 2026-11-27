"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../i18n/routing";
import { isRtlLocale } from "../../i18n/routing";
import { trackEvent } from "../../lib/analytics";
import { requestSignIn } from "../../lib/auth-navigation";
import { PET_APP_COVER_BASE_URL } from "./studio-apps-catalog";
import Link from "./studio-link";
import { StudioIcon } from "./studio-navigation";
import { shouldShowWelcomeModal, studioOnboardingCopy, welcomeSeenStorageKey } from "./studio-onboarding-i18n";

const GUEST_BANNER_DISMISSED_KEY = "dreamface_guest_banner_dismissed";

export function StudioGuestBanner({
  locale,
  authReady,
  signedIn,
  hidden
}: {
  locale: Locale;
  authReady: boolean;
  signedIn: boolean;
  hidden: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(GUEST_BANNER_DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!authReady || signedIn || hidden || dismissed) return null;
  const copy = studioOnboardingCopy(locale);

  return (
    <div className="df-guest-nudge" role="region" aria-label={copy.guestBadge} data-studio-guest-banner>
      <div className="df-guest-nudge-main">
        <span className="df-guest-nudge-badge">
          <StudioIcon name="sparkles" className="h-3 w-3" />
          <span>{copy.guestBadge}</span>
        </span>
        <span className="df-guest-nudge-text">{copy.guestText}</span>
      </div>
      <div className="df-guest-nudge-actions">
        <button
          type="button"
          className="df-guest-nudge-cta"
          onClick={() => {
            trackEvent("guest_banner_signin_clicked", { locale });
            requestSignIn({
              highlightBadge: copy.authBadge
            });
          }}
        >
          <span>{copy.guestCta}</span>
        </button>
        <button
          type="button"
          className="df-guest-nudge-close"
          aria-label={copy.guestDismiss}
          onClick={() => {
            setDismissed(true);
            try {
              window.sessionStorage.setItem(GUEST_BANNER_DISMISSED_KEY, "1");
            } catch {
              /* Optional storage. */
            }
          }}
        >
          <StudioIcon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function StudioWelcomeModal({
  locale,
  authReady,
  signedIn,
  userId,
  creditBalance,
  tasksLoaded,
  taskCount,
  suppressed
}: {
  locale: Locale;
  authReady: boolean;
  signedIn: boolean;
  userId: string | null;
  creditBalance: number | null;
  tasksLoaded: boolean;
  taskCount: number;
  suppressed: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      setOpen(false);
      return;
    }
    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(welcomeSeenStorageKey(userId)) === "1";
    } catch {
      alreadySeen = false;
    }

    const eligible = shouldShowWelcomeModal({
      authReady,
      signedIn,
      userId,
      creditBalance,
      tasksLoaded,
      taskCount,
      suppressed,
      alreadySeen
    });

    if (!eligible) {
      setOpen(false);
      return;
    }

    // Wait briefly so auto-resumed generations or history hydration settle first.
    const timer = window.setTimeout(() => {
      setOpen(true);
      trackEvent("studio_welcome_shown", { locale, credits: creditBalance });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [authReady, creditBalance, locale, signedIn, suppressed, taskCount, tasksLoaded, userId]);

  const dismiss = (action?: string) => {
    setOpen(false);
    if (userId) {
      try {
        window.localStorage.setItem(welcomeSeenStorageKey(userId), "1");
      } catch {
        /* Optional storage. */
      }
    }
    if (action) trackEvent("studio_welcome_action", { action, locale });
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss("escape");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!open || typeof document === "undefined") return null;
  const copy = studioOnboardingCopy(locale);
  const badgeText =
    typeof creditBalance === "number" && creditBalance > 0
      ? copy.welcomeBadgeWithCredits.replace("{credits}", creditBalance.toLocaleString(locale))
      : copy.welcomeBadgeDefault;

  return createPortal(
    <div
      className="studio-overlay df-welcome-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-welcome-title"
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      onClick={() => dismiss("backdrop")}
    >
      <div className="df-welcome-modal" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="df-welcome-close"
          aria-label={copy.welcomeClose}
          onClick={() => dismiss("close")}
        >
          <StudioIcon name="x" className="h-4 w-4" />
        </button>

        <span className="df-welcome-pill">
          <StudioIcon name="sparkles" className="h-3.5 w-3.5" />
          <span>{badgeText}</span>
        </span>
        <h2 id="studio-welcome-title">{copy.welcomeTitle}</h2>
        <p className="df-welcome-sub">{copy.welcomeSubtitle}</p>

        <div className="df-welcome-cards">
          <Link
            href="/studio?view=apps&app=pet-sing-dance"
            className="df-welcome-card df-welcome-card--featured"
            onClick={() => dismiss("pet-sing-dance")}
          >
            <img
              src={`${PET_APP_COVER_BASE_URL}/tiktok-shuffle.webp`}
              alt={copy.welcomeCardPetTitle}
              className="df-welcome-thumb"
            />
            <div className="df-welcome-card-body">
              <div className="df-welcome-card-head">
                <strong>{copy.welcomeCardPetTitle}</strong>
                <span className="df-sidebar-hot-badge">{copy.welcomeCardPetBadge}</span>
              </div>
              <p>{copy.welcomeCardPetDesc}</p>
            </div>
            <StudioIcon name="chevron-right" className="h-4 w-4 shrink-0 text-[var(--df-muted)] rtl:rotate-180" />
          </Link>

          <Link
            href="/studio?mode=video&workflow=image-to-video"
            className="df-welcome-card"
            onClick={() => dismiss("image-to-video")}
          >
            <span className="df-welcome-icon" aria-hidden="true">
              <StudioIcon name="video" className="h-5 w-5" />
            </span>
            <div className="df-welcome-card-body">
              <div className="df-welcome-card-head">
                <strong>{copy.welcomeCardI2VTitle}</strong>
              </div>
              <p>{copy.welcomeCardI2VDesc}</p>
            </div>
            <StudioIcon name="chevron-right" className="h-4 w-4 shrink-0 text-[var(--df-muted)] rtl:rotate-180" />
          </Link>

          <Link
            href="/studio?mode=avatar&workflow=avatar-video&provider=heygen-video"
            className="df-welcome-card"
            onClick={() => dismiss("avatar")}
          >
            <span className="df-welcome-icon" aria-hidden="true">
              <StudioIcon name="user" className="h-5 w-5" />
            </span>
            <div className="df-welcome-card-body">
              <div className="df-welcome-card-head">
                <strong>{copy.welcomeCardAvatarTitle}</strong>
              </div>
              <p>{copy.welcomeCardAvatarDesc}</p>
            </div>
            <StudioIcon name="chevron-right" className="h-4 w-4 shrink-0 text-[var(--df-muted)] rtl:rotate-180" />
          </Link>
        </div>

        <div className="df-welcome-footer">
          <button type="button" className="df-welcome-skip" onClick={() => dismiss("skip")}>
            {copy.welcomeSkip}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
