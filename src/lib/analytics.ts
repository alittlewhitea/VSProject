"use client";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const ANON_ID_KEY = "dreamface_analytics_anonymous_id";
const SESSION_ID_KEY = "dreamface_analytics_session_id";

function randomId(prefix: string) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readOrCreateLocalId(key: string, prefix: string) {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = randomId(prefix);
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return null;
  }
}

function readOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const next = randomId("ses");
    window.sessionStorage.setItem(SESSION_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

function cleanProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean | null>;
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}, accessToken?: string | null) {
  if (typeof window === "undefined" || !eventName) return;

  const eventProperties = cleanProperties(properties);
  const anonymousId = readOrCreateLocalId(ANON_ID_KEY, "anon");
  const sessionId = readOrCreateSessionId();
  const payload = {
    eventName,
    anonymousId,
    sessionId,
    pagePath: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
    properties: eventProperties
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    anonymous_id: anonymousId,
    session_id: sessionId,
    page_path: payload.pagePath,
    ...eventProperties
  });

  fetch("/api/analytics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => null);
}
