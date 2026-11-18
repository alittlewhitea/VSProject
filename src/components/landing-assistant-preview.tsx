"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Locale } from "../i18n/routing";

const Assistant = dynamic(() => import("./landing-assistant").then(module => module.LandingAssistant), { ssr: false });

/** The design preview is opt-in; the regular landing page stays unchanged. */
export function LandingAssistantPreview({ locale }: { locale: Locale }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { setEnabled(new URLSearchParams(window.location.search).get("assistant") === "preview"); }, []);
  return enabled ? <Assistant locale={locale} /> : null;
}
