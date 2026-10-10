"use client";

import { useRef, useState } from "react";
import { enhancementContextKey, type EnhancementResult, type VideoPromptContext } from "../../lib/video-prompt-enhancement";

export type AcceptedPrompt = { contextKey: string; original: string; final: string; result: EnhancementResult };
export function reusableEnhancement(accepted: AcceptedPrompt | null, context: VideoPromptContext) {
  return accepted?.contextKey === enhancementContextKey(context) && accepted.final === context.prompt ? accepted : null;
}
export function useVideoPromptEnhancement(context: VideoPromptContext, setPrompt: (prompt: string) => void, authenticated: boolean) {
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"enhanced" | "fallback" | "disabled" | "login" | "restored" | null>(null);
  const [accepted, setAccepted] = useState<AcceptedPrompt | null>(null);
  const acceptedRef = useRef<AcceptedPrompt | null>(null);
  const lock = useRef(false);
  const latest = useRef(context);
  latest.current = context;
  const current = reusableEnhancement(accepted, context);
  function restoreDraft(record: AcceptedPrompt | null) {
    const valid = record && typeof record.contextKey === "string" && typeof record.original === "string" && typeof record.final === "string" &&
      record.original.length <= 5000 && record.final.length <= 5000 && typeof record.result?.model === "string";
    acceptedRef.current = valid ? record : null;
    setAccepted(valid ? record : null);
  }
  function reset(value: string) {
    acceptedRef.current = null;
    setAccepted(null);
    setNotice(null);
    setPrompt(value);
  }
  function edit(value: string) {
    const record = reusableEnhancement(acceptedRef.current, latest.current);
    if (record && value.trim()) {
      const updated = { ...record, final: value };
      acceptedRef.current = updated;
      setAccepted(updated);
    } else { acceptedRef.current = null; setAccepted(null); setNotice(null); }
    setPrompt(value);
  }
  function restore() {
    if (!current || lock.current) return;
    setPrompt(current.original);
    acceptedRef.current = null;
    setAccepted(null);
    setNotice("restored");
  }
  async function optimize(token: string | null, automatic = false, expectedContext?: VideoPromptContext) {
    const snapshot = expectedContext || latest.current;
    if (enhancementContextKey(latest.current) !== enhancementContextKey(snapshot) || latest.current.prompt !== snapshot.prompt) {
      throw new Error("The creative context changed. Try again with the current settings.");
    }
    const existing = reusableEnhancement(acceptedRef.current, snapshot);
    if (existing) return { prompt: snapshot.prompt, metadata: { originalPrompt: existing.original, finalPrompt: snapshot.prompt, status: "enhanced", model: existing.result.model } };
    if (automatic && !enabled) return { prompt: snapshot.prompt, metadata: { originalPrompt: snapshot.prompt, finalPrompt: snapshot.prompt, status: "off" } };
    if (!token || !authenticated) { setNotice("login"); return { prompt: snapshot.prompt, metadata: { originalPrompt: snapshot.prompt, finalPrompt: snapshot.prompt, status: "fallback" } }; }
    if (lock.current) throw new Error("Prompt optimization is already running");
    lock.current = true;
    setBusy(true);
    setNotice(null);
    let result: EnhancementResult = { originalPrompt: snapshot.prompt, enhancedPrompt: snapshot.prompt, model: "", status: "fallback" };
    try {
      const response = await fetch("/api/ai/enhance-video-prompt", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(snapshot), signal: AbortSignal.timeout(30_000)
      });
      if (response.ok) {
        const payload = await response.json() as EnhancementResult;
        if (["enhanced", "fallback", "disabled"].includes(payload.status) && typeof payload.enhancedPrompt === "string" && payload.enhancedPrompt.trim() && payload.enhancedPrompt.length <= 5000) result = payload;
      }
    } catch { /* Generation can proceed with the captured original prompt. */ }
    finally { lock.current = false; setBusy(false); }
    if (enhancementContextKey(latest.current) !== enhancementContextKey(snapshot) || latest.current.prompt !== snapshot.prompt) throw new Error("The creative context changed. Try again with the current settings.");
    setNotice(result.status);
    if (result.status === "enhanced") {
      const record = { contextKey: enhancementContextKey(snapshot), original: snapshot.prompt, final: result.enhancedPrompt, result };
      acceptedRef.current = record;
      setAccepted(record);
      setPrompt(result.enhancedPrompt);
    }
    return { prompt: result.enhancedPrompt, metadata: { originalPrompt: snapshot.prompt, finalPrompt: result.enhancedPrompt, status: result.status, model: result.model } };
  }
  return { context, enabled, setEnabled, busy, notice, current, edit, reset, restore, restoreDraft, optimize };
}
