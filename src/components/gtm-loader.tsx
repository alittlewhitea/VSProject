"use client";

import { useEffect } from "react";

const GTM_ID = "GTM-WG68M9NW";

declare global {
  interface Window {
    __dreamfaceGtmLoaded?: boolean;
  }
}

function injectGtm() {
  if (typeof window === "undefined" || window.__dreamfaceGtmLoaded) return;
  window.__dreamfaceGtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

/**
 * Load GTM on first user interaction or after initial page settle so third-party
 * tags never block mobile hydration/TTI while preserving all queued dataLayer events.
 */
export function GtmLoader() {
  useEffect(() => {
    if (window.__dreamfaceGtmLoaded) return;

    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"] as const;
    let timer: number | null = null;

    const cleanup = () => {
      for (const eventName of events) window.removeEventListener(eventName, trigger);
      if (timer !== null) window.clearTimeout(timer);
    };

    const trigger = () => {
      cleanup();
      injectGtm();
    };

    for (const eventName of events) window.addEventListener(eventName, trigger, { once: true, passive: true });
    timer = window.setTimeout(trigger, 9000);

    return cleanup;
  }, []);

  return null;
}
