"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "../lib/analytics";
import { publicLandingPath } from "../lib/growth-policy";

export function GrowthTracker() {
  const pathname = usePathname(), lastPath = useRef<string | null>(null);
  useEffect(() => {
    const page = publicLandingPath(pathname);
    if (!page) { lastPath.current = null; return; }
    if (lastPath.current !== page) { lastPath.current = page; trackEvent("landing_view", { landing_path: page }); }
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || event.button !== 0) return;
      let target = new URL(anchor.href, window.location.origin);
      if (target.origin !== window.location.origin) return;
      // Homepage Google/email buttons open authentication before entering Studio.
      if (/^(?:\/[a-zA-Z-]+)?\/auth$/.test(target.pathname)) target = new URL(target.searchParams.get("next") || "/studio?view=home", window.location.origin);
      if (target.origin !== window.location.origin || target.pathname !== "/studio") return;
      trackEvent("landing_cta_clicked", { landing_path: page, placement: anchor.dataset.growthCta || "navigation", target_mode: target.searchParams.get("mode"), target_workflow: target.searchParams.get("workflow") });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [pathname]);
  return null;
}
