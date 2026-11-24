"use client";
import { Suspense, useEffect, useState } from "react";
import type { Locale } from "../../i18n/routing";
import { useStudioController } from "../../features/studio/use-studio-controller";
import { StudioShell } from "../../features/studio/studio-shell";
import "../../features/studio/studio-tokens.css";
import { loadStudioMessages } from "../../lib/studio-message-loader";

type Props = { initialLocale: Locale; initialMessages?: Record<string, string>; initialView?: "billing"; initialPricingTime?: number };

function StudioContent(props: Props) {
  return <StudioShell model={useStudioController(props)} />;
}

export function StudioPageClient(props: Props) {
  const [messages, setMessages] = useState(props.initialMessages);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (props.initialMessages) return;
    let active = true;
    setFailed(false);
    void loadStudioMessages(props.initialLocale).then(value => {
      if (active) setMessages(value);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [props.initialLocale, props.initialMessages, attempt]);

  return (
    <Suspense fallback={null}>
      {messages ? <StudioContent {...props} initialMessages={messages} /> : failed ? (
        <div className="flex min-h-screen items-center justify-center bg-[var(--df-bg,#f5f5f7)] text-[var(--df-ink,#1d1d1f)]">
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-xl border border-[var(--df-border,#e8e8ed)] bg-[var(--df-surface,#ffffff)] px-5 py-3 text-sm font-semibold text-[var(--df-ink,#1d1d1f)]">
            Reload workspace
          </button>
        </div>
      ) : <div className="min-h-screen animate-pulse bg-[var(--df-bg,#f5f5f7)]" aria-busy="true" />}
    </Suspense>
  );
}
