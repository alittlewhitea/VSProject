"use client";

import { useEffect } from "react";
import { trackEvent } from "../lib/analytics";

export function PageAnalytics({ eventName, properties = {} }: { eventName: string; properties?: Record<string, string | number | boolean | null> }) {
  useEffect(() => {
    trackEvent(eventName, properties);
  }, [eventName, properties]);

  return null;
}
