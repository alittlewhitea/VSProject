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

/** Defer GTM until first interaction or post-load idle so third-party tags do not block mobile hydration. */
export function GtmLoader() {
  useEffect(() => {
    if (window.__dreamfaceGtmLoaded) return;

    let timer: number | null = null;
    let idleId: number | null = null;
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

    const cleanup = () => {
      for (const eventName of events) window.removeEventListener(eventName, trigger);
      window.removeEventListener("load", scheduleIdle);
      if (timer !== null) window.clearTimeout(timer);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };

    const trigger = () => {
      cleanup();
      injectGtm();
    };

    const scheduleIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(trigger, { timeout: 2500 });
      } else {
        timer = window.setTimeout(trigger, 2000);
      }
    };

    for (const eventName of events) window.addEventListener(eventName, trigger, { once: true, passive: true });
    if (document.readyState === "complete") scheduleIdle();
    else window.addEventListener("load", scheduleIdle, { once: true });
    timer = window.setTimeout(trigger, 4000);

    return cleanup;
  }, []);

  return null;
}
