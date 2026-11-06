"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import Link from "./studio-link";
import { StudioParameterIcon, type StudioParameterKind } from "./studio-composer-controls";

type ButtonVariant = "primary" | "secondary" | "ghost";
export function StudioSelectField({ label, value, options, onValueChange, disabled = false, icon }: {
  label: string; value: string; options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void; disabled?: boolean;
  icon?: StudioParameterKind;
}) {
  return <label className="df-select-field" title={label}><span>{label}</span><span className="df-select-control" data-has-icon={icon ? "true" : undefined}>
    {icon ? <StudioParameterIcon kind={icon}/> : null}
    <select value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span></label>;
}
export type StudioStatusTone = "idle" | "ok" | "error";
export function StudioStatusNotice({ message = "", tone = "idle" }: { message?: string; tone?: StudioStatusTone }) {
  const regionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (message && tone === "error") regionRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [message, tone]);
  return <div ref={regionRef} className="df-status-region" role={tone === "error" ? "alert" : "status"} aria-atomic="true">
    {message ? <p className="df-status-notice" data-tone={tone}>{message}</p> : null}
  </div>;
}
export function StudioButton({ variant = "secondary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} type={type} className={`df-button df-button--${variant} ${className}`} />;
}

export function StudioActionLink({ variant = "secondary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={`df-button df-button--${variant} ${className}`} />;
}

export function StudioPanel({ className = "", children, header }: { className?: string; children: ReactNode; header?: ReactNode }) {
  return <section className={`df-panel ${className}`}>{header ? <div className="df-panel-heading">{header}</div> : null}{children}</section>;
}

export function StudioSectionHeading({ id, title, description, action }: { id?: string; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className="df-section-heading"><div><h2 id={id}>{title}</h2>{description ? <p>{description}</p> : null}</div>{action}</div>;
}

export function StudioSegmentedControl<T extends string>({ label, options, value, onChange, className = "" }: {
  label: string;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (value: T) => void;
  className?: string;
}) {
  return <div role="group" aria-label={label} className={`df-segmented ${className}`}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.icon}{option.label}</button>)}
  </div>;
}
