"use client";

import type { LoginSuccessEvent } from "./login-success-receipt";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type PurchaseItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

type PurchaseProperties = {
  transaction_id: string;
  value: number;
  currency: string;
  items: PurchaseItem[];
} & Record<string, string | number | boolean | null | undefined | PurchaseItem[]>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const ANON_ID_KEY = "dreamface_analytics_anonymous_id";
const SESSION_ID_KEY = "dreamface_analytics_session_id";
const PURCHASE_KEY_PREFIX = "dreamface_analytics_purchase:";
const reportedPurchases = new Set<string>();
const LOGIN_KEY_PREFIX = "dreamface_analytics_login:";
const reportedLogins = new Set<string>();
const loginReports = new Map<string, Promise<void>>();

function claimPurchase(transactionId: string) {
  if (reportedPurchases.has(transactionId)) return false;
  const key = `${PURCHASE_KEY_PREFIX}${transactionId}`;
  // Shared by every checkout entry point and retained across page reloads.
  // Storage can be unavailable; the in-memory guard still covers callbacks.
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      if (window[storageName].getItem(key) === "1") {
        reportedPurchases.add(transactionId);
        return false;
      }
    } catch { /* Optional browser storage. */ }
  }
  reportedPurchases.add(transactionId);
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try { window[storageName].setItem(key, "1"); } catch { /* Optional browser storage. */ }
  }
  return true;
}

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

function analyticsPayload(eventName: string, properties: AnalyticsProperties = {}) {
  const eventProperties = cleanProperties(properties);
  const anonymousId = readOrCreateLocalId(ANON_ID_KEY, "anon");
  const sessionId = readOrCreateSessionId();
  return {
    eventProperties,
    anonymousId,
    sessionId,
    pagePath: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null
  };
}

function mirrorEvent(eventName: string, payload: ReturnType<typeof analyticsPayload>, accessToken?: string | null) {
  fetch("/api/analytics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({
      eventName,
      anonymousId: payload.anonymousId,
      sessionId: payload.sessionId,
      pagePath: payload.pagePath,
      referrer: payload.referrer,
      properties: payload.eventProperties
    }),
    keepalive: true
  }).catch(() => null);
}

function pushEvent(eventName: string, payload: ReturnType<typeof analyticsPayload>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    // GTM's data model persists across pushes. Clear prior purchase fields so
    // generic event tags cannot reuse a previous transaction's monetary value.
    value: null,
    currency: null,
    transaction_id: null,
    ecommerce: null,
    anonymous_id: payload.anonymousId,
    session_id: payload.sessionId,
    page_path: payload.pagePath,
    ...payload.eventProperties
  });
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}, accessToken?: string | null) {
  if (typeof window === "undefined" || !eventName || eventName === "login_success") return;
  const payload = analyticsPayload(eventName, properties);
  pushEvent(eventName, payload);
  mirrorEvent(eventName, payload, accessToken);
}

/** A confirmed authentication receipt is the only source of login_success. */
export function trackLoginSuccess(receipt: LoginSuccessEvent): Promise<void> {
  if (typeof window === "undefined" || !receipt?.id || !["google", "email"].includes(receipt.method)) return Promise.resolve();
  if (reportedLogins.has(receipt.id)) return Promise.resolve();
  try {
    if (window.localStorage.getItem(`${LOGIN_KEY_PREFIX}${receipt.id}`) === "1") { reportedLogins.add(receipt.id); return Promise.resolve(); }
  } catch { /* The server's unique event ID also covers restricted browser storage. */ }
  const existing = loginReports.get(receipt.id);
  if (existing) return existing;
  const report = (async () => {
    const payload = analyticsPayload("login_success", { method: receipt.method, login_event_id: receipt.id });
    const response = await fetch("/api/analytics/login-success", {
      method: "POST", credentials: "include", keepalive: true, signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginEventId: receipt.id, anonymousId: payload.anonymousId, sessionId: payload.sessionId, pagePath: payload.pagePath, referrer: payload.referrer })
    });
    if (!response.ok) return;
    const result = await response.json() as { claimed: boolean; event: (LoginSuccessEvent & { surface: string }) | null };
    if (!result.event || result.event.id !== receipt.id || result.event.method !== receipt.method) return;
    reportedLogins.add(receipt.id);
    try { window.localStorage.setItem(`${LOGIN_KEY_PREFIX}${receipt.id}`, "1"); } catch { /* Optional cache. */ }
    // The claiming endpoint already wrote the internal event atomically.
    if (result.claimed) pushEvent("login_success", { ...payload, eventProperties: { ...payload.eventProperties, surface: result.event.surface } });
  })().catch(() => undefined).finally(() => { loginReports.delete(receipt.id); });
  loginReports.set(receipt.id, report);
  return report;
}

export async function flushLoginSuccessTracking() { await Promise.all([...loginReports.values()]); }

export function trackPurchaseEvent(
  properties: PurchaseProperties,
  accessToken?: string | null
) {
  if (typeof window === "undefined" || !properties.transaction_id) return;
  if (!claimPurchase(properties.transaction_id)) return;

  const { items, ...scalarProperties } = properties;
  const payload = analyticsPayload("purchase", scalarProperties as AnalyticsProperties);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: "purchase",
    anonymous_id: payload.anonymousId,
    session_id: payload.sessionId,
    page_path: payload.pagePath,
    transaction_id: properties.transaction_id,
    value: properties.value,
    currency: properties.currency,
    ecommerce: {
      transaction_id: properties.transaction_id,
      value: properties.value,
      currency: properties.currency,
      items
    },
    ...payload.eventProperties
  });

  mirrorEvent("purchase", payload, accessToken);
}
