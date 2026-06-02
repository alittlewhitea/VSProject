"use client";

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

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}, accessToken?: string | null) {
  if (typeof window === "undefined" || !eventName) return;

  const payload = analyticsPayload(eventName, properties);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    anonymous_id: payload.anonymousId,
    session_id: payload.sessionId,
    page_path: payload.pagePath,
    ...payload.eventProperties
  });

  mirrorEvent(eventName, payload, accessToken);
}

export function trackPurchaseEvent(
  properties: PurchaseProperties,
  accessToken?: string | null
) {
  if (typeof window === "undefined" || !properties.transaction_id) return;

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
