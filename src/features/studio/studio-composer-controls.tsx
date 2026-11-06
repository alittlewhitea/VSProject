"use client";

import { useId, type ReactNode } from "react";
import { formatApproximateCreditValue } from "../../lib/billing";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

export type StudioParameterKind = "duration" | "resolution" | "ratio" | "voice" | "language" | "format";

export function StudioParameterIcon({kind}: {kind: StudioParameterKind}) {
  return <svg data-select-icon aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === "duration" ? <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></> : kind === "resolution" ? <path d="M4 8V4h4m-4 0 5 5m11-1V4h-4m4 0-5 5M4 16v4h4m-4 0 5-5m11 1v4h-4m4 0-5-5"/> : kind === "ratio" ? <rect x="3" y="5" width="18" height="14" rx="2"/> : kind === "voice" ? <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/></> : kind === "language" ? <><circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9a18 18 0 0 1 0 18 18 18 0 0 1 0-18"/></> : <><path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6m-6 4h4"/></>}
  </svg>;
}

/** Decorative wrapper only: the original native select keeps its own binding. */
export function StudioComposerParameter({label, kind, children}: {label: string; kind: StudioParameterKind; children: ReactNode}) {
  return <label className="df-composer-parameter" title={label}><span className="sr-only">{label}</span><StudioParameterIcon kind={kind}/>{children}<svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg></label>;
}

/** A shared input surface; all values and actions remain owned by the workspace. */
export function StudioComposerPrompt({label, prompt, placeholder, translate, onChange, maxLength, children}: {
  label: string; prompt: string; placeholder: string; translate: Translate;
  onChange: (value: string) => void; maxLength?: number; children?: ReactNode;
}) {
  const id = useId();
  return <div className="df-composer-prompt">
    <div className="df-composer-prompt-label"><label htmlFor={id}>{label}</label><span>{translate("studio.workbench.characters", {count: prompt.length.toLocaleString()})}{maxLength ? ` / ${maxLength.toLocaleString()}` : ""}</span></div>
    <textarea id={id} data-composer-prompt dir="auto" value={prompt} maxLength={maxLength} onChange={event=>onChange(event.target.value)} placeholder={placeholder}/>
    {children}
  </div>;
}

export function StudioComposerGenerate({disabled, submitting, authenticated, credits, translate, onGenerate}: {
  disabled: boolean; submitting: boolean; authenticated: boolean; credits: number; translate: Translate; onGenerate: () => void;
}) {
  return <button type="button" onClick={onGenerate} disabled={disabled} className="df-generate-button df-composer-generate">
    <span>{translate(submitting ? "studio.generate.creating" : authenticated ? "studio.generate.button" : "studio.auth.signInToGenerate")}</span>
    <span className="df-composer-quote">{credits} {translate("studio.common.credits")} · ≈{formatApproximateCreditValue(credits)}</span>
  </button>;
}
