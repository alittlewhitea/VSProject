"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatApproximateCreditValue } from "../../lib/billing";
import { modelLogoForProvider } from "../../lib/model-logos";

export type ModelPickerOption = {
  value: string;
  label: string;
  description: string;
  performanceNote?: string;
  speed: string;
  quality: string;
  duration?: string;
  credits: number;
  badge?: string;
  group: string;
};

type ModelPickerProps = {
  compact?: boolean;
  inline?: boolean;
  value: string;
  options: ModelPickerOption[];
  translate: (key: string, values?: Record<string, string | number | null | undefined>) => string;
  onChange: (value: string) => void;
};

function ModelMark({provider,compact=false}:{provider?:string;compact?:boolean}) {
  const logo=modelLogoForProvider(provider);
  const [failedLogo,setFailedLogo]=useState<string|null>(null);
  return (
    <span aria-hidden="true" className={`df-model-mark grid shrink-0 place-items-center rounded-xl bg-white text-lg font-semibold text-[var(--studio-accent)] shadow-none ${compact ? "mt-0.5 h-9 w-9" : "h-10 w-10"}`}>
      {logo && failedLogo !== logo ? <img src={logo} alt="" width={28} height={28} loading="lazy" decoding="async" onError={()=>setFailedLogo(logo)} className="h-7 w-7 object-contain" /> : "\u2723"}
    </span>
  );
}

export function ModelPicker({ value, options, translate, onChange, compact = false, inline = false }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  const hasChoices = options.length > 1;
  const isAvatarPicker = Boolean(triggerRef.current?.closest(".df-avatar-composer"));
  const isPremiumPicker = isAvatarPicker || Boolean(triggerRef.current?.closest(".df-premium-composer"));

  const closePicker = () => {
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(options.length > 6 ? "[data-model-search]" : '[aria-pressed="true"]');
      target?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, options.length]);

  const groupedOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? options.filter((option) => `${option.label} ${option.description} ${option.performanceNote || ""} ${option.speed} ${option.quality}`.toLowerCase().includes(normalizedQuery))
      : options;
    return Array.from(new Set(filtered.map((option) => option.group))).map((group) => ({
      group,
      options: filtered.filter((option) => option.group === group)
    }));
  }, [options, query]);

  const panel = open && mounted && hasChoices ? createPortal(
    <div data-premium-model-picker={isPremiumPicker ? "true" : undefined} data-avatar-model-picker={isAvatarPicker ? "true" : undefined} dir={triggerRef.current?.closest("[dir]")?.getAttribute("dir") || undefined} className="studio-overlay fixed inset-0 z-[300] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label={translate("studio.modelPicker.close")} onClick={closePicker} className="df-model-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="model-picker-title" aria-describedby="model-picker-description" className="df-model-modal relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none sm:max-w-[660px] sm:rounded-[24px] sm:shadow-none">
        <div className="df-model-modal-header flex items-start justify-between gap-4 border-b border-[var(--studio-border)] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            {isPremiumPicker ? <span aria-hidden="true" className="df-model-mark grid shrink-0 place-items-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5.25.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 0 0-3.09 3.09L9 18.75l-.813-2.847a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.847-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25Z"/><path d="m18 2.25.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25Z"/></svg></span> : <ModelMark />}
            <div className="min-w-0">
              <h2 id="model-picker-title" className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--studio-text)]">{translate("studio.modelPicker.title")}</h2>
              <p id="model-picker-description" className="mt-0.5 text-xs font-semibold text-[var(--studio-muted)]">{translate("studio.modelPicker.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={closePicker} aria-label={translate("studio.modelPicker.close")} className="df-model-close grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] text-lg text-[var(--studio-muted)] transition hover:bg-[var(--studio-surface)]">{"\u00d7"}</button>
        </div>

        {options.length > 6 || isPremiumPicker ? (
          <div className="df-model-search border-b border-[var(--studio-border)] px-5 py-3 sm:px-6">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 focus-within:border-[var(--studio-accent-border)] focus-within:bg-[var(--studio-panel)]">
              <span className="text-[var(--studio-muted)]">{"\u2315"}</span>
              <input data-model-search aria-label={translate("studio.modelPicker.search")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate("studio.modelPicker.search")} className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]" />
            </label>
          </div>
        ) : null}

        <div className="df-model-list overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {groupedOptions.map(({ group, options: groupItems }) => (
            <div key={group} className="mb-4 last:mb-0">
              <div className="df-model-group-label mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--studio-muted)]">{group}</div>
              <div className="grid gap-2">
                {groupItems.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        onChange(option.value);
                        closePicker();
                      }}
                      className={`df-model-option w-full rounded-2xl border p-3.5 text-start transition sm:p-4 ${active ? "border-[var(--studio-accent-border)] bg-[var(--studio-surface)] shadow-none" : "border-[var(--studio-border)] bg-[var(--studio-panel)] hover:border-[var(--studio-accent-border)] hover:bg-[var(--studio-accent-soft)]"}`}
                    >
                      {isPremiumPicker ? <span className="df-avatar-model-row">
                        <span className="df-avatar-model-identity">
                          <ModelMark provider={option.value} compact />
                          <span className="df-avatar-model-copy">
                            <span className="df-avatar-model-title"><strong>{option.label}</strong>{active ? <span className="df-avatar-model-selected"><svg aria-hidden="true" width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m4 10 4 4 8-8"/></svg>{translate("studio.modelPicker.selected")}</span> : null}</span>
                            <span className="df-avatar-model-notes">
                              {option.performanceNote ? <span>{option.performanceNote}</span> : null}
                              <span>{option.speed}</span>
                              {option.badge && option.badge.trim().toLowerCase() !== option.group.trim().toLowerCase() ? <span>{option.badge}</span> : null}
                            </span>
                          </span>
                        </span>
                        <span className="df-avatar-model-price"><span>{option.duration ? `${option.duration} = ` : ""}<strong>{option.credits} {translate("studio.common.credits")}</strong></span><span>= {formatApproximateCreditValue(option.credits)}</span></span>
                      </span> : <>
                      <span className="flex items-start gap-3">
                        <ModelMark provider={option.value} compact />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm font-semibold text-[var(--studio-text)] sm:text-[15px]">{option.label}</strong>
                            {option.badge ? option.badge.trim().toLowerCase() === option.group.trim().toLowerCase() ? (
                              <span role="img" aria-label={option.badge} title={option.badge} data-model-recommendation className="grid h-5 w-5 place-items-center">
                                <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m4 10 4 4 8-8" /></svg>
                              </span>
                            ) : <span className="rounded-full bg-[var(--studio-accent-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--studio-accent)]">{option.badge}</span> : null}
                            {active ? <span className="rounded-full bg-[var(--studio-accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--studio-accent)]">{translate("studio.modelPicker.selected")}</span> : null}
                          </span>
                          {option.description.trim().toLowerCase() !== option.group.trim().toLowerCase() ? <span className="mt-1.5 block text-xs leading-5 text-[var(--studio-muted)]">{option.description}</span> : null}
                          {option.performanceNote ? (
                            <span className="mt-2 inline-flex rounded-lg bg-[var(--studio-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--studio-muted)]">
                              {option.performanceNote}
                            </span>
                          ) : null}
                          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-lg bg-[var(--studio-surface)] px-2 py-1 text-[10px] font-bold text-[var(--studio-muted)]">{option.speed}</span>
                            <span className="ms-auto whitespace-nowrap text-[11px] font-semibold text-[var(--studio-text)]">
                              {option.duration ? `${option.duration} = ` : ""}{option.credits} {translate("studio.common.credits")} <span className="font-bold text-[var(--studio-accent)]">= {formatApproximateCreditValue(option.credits)}</span>
                            </span>
                          </span>
                        </span>
                      </span>
                      </>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!groupedOptions.length ? <div className="px-4 py-10 text-center text-sm font-semibold text-[var(--studio-muted)]">{translate("studio.modelPicker.noMatches")}</div> : null}
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  if (!selected) return null;

  if (inline) return <>
    <button ref={triggerRef} type="button" className="df-inline-model-picker" onClick={()=>hasChoices&&setOpen(true)} aria-label={`${translate("studio.modelPicker.label")}: ${selected.label}`} aria-haspopup={hasChoices?"dialog":undefined} aria-expanded={hasChoices?open:undefined}>
      <svg className="df-model-trigger-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9.75 17-.75 3-1 1h8l-1-1-.75-3M3 13h18"/><rect x="3" y="3" width="18" height="14" rx="2"/></svg><span className="df-model-trigger-name" title={selected.label}>{selected.label}</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 8 5 5 5-5"/></svg>
    </button>{panel}
  </>;

  const selectedBadgeIsRecommendation = Boolean(
    selected.badge && selected.badge.trim().toLowerCase() === selected.group.trim().toLowerCase()
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => hasChoices && setOpen(true)}
        aria-haspopup={hasChoices ? "dialog" : undefined}
        aria-expanded={hasChoices ? open : undefined}
        className={`${compact ? "df-model-card" : ""} group w-full rounded-2xl border p-3.5 text-start transition sm:p-4 ${hasChoices ? "border-[var(--studio-accent-border)] bg-[var(--studio-surface)] shadow-none hover:border-[var(--studio-accent-border)] hover:shadow-none" : "cursor-default border-[var(--studio-border)] bg-[var(--studio-surface)]"}`}
      >
        <span className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--studio-accent)]">{translate("studio.modelPicker.label")}</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${hasChoices ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "bg-[var(--studio-surface)] text-[var(--studio-muted)]"}`}>
            {hasChoices ? translate("studio.modelPicker.available", { count: options.length }) : translate("studio.modelPicker.onlyAvailable")}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <ModelMark provider={selected.value} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="truncate text-[14px] font-semibold text-[var(--studio-text)]">{selected.label}</strong>
              {selected.badge ? selectedBadgeIsRecommendation ? (
                <span role="img" aria-label={selected.badge} title={selected.badge} data-model-recommendation className="grid h-5 w-5 place-items-center">
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m4 10 4 4 8-8" /></svg>
                </span>
              ) : <span className="rounded-full bg-[var(--studio-panel)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--studio-accent)] shadow-none">{selected.badge}</span> : null}
            </span>
            <span className="mt-1.5 block text-[11px] font-semibold sm:hidden">
              <span className="block truncate text-[var(--studio-muted)]">{selected.performanceNote || selected.speed}</span>
              <span className="mt-0.5 block whitespace-nowrap text-[var(--studio-text)]">
                {selected.duration ? `${selected.duration} = ` : ""}{selected.credits} {translate("studio.common.credits")} = <strong className="text-[var(--studio-accent)]">{formatApproximateCreditValue(selected.credits)}</strong>
              </span>
            </span>
            <span className="mt-1.5 hidden text-[11px] font-semibold sm:block">
              <span className="block truncate text-[var(--studio-muted)]">
                {selected.performanceNote ? <strong className="text-[var(--studio-muted)]">{selected.performanceNote}</strong> : null}
                {selected.performanceNote ? " · " : ""}{selected.speed}{selectedBadgeIsRecommendation ? "" : ` · ${selected.group}`}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[var(--studio-text)]">
                {selected.duration ? `${selected.duration} = ` : ""}{selected.credits} {translate("studio.common.credits")} = <strong className="text-[var(--studio-accent)]">{formatApproximateCreditValue(selected.credits)}</strong>
              </span>
            </span>
          </span>
          {hasChoices ? (
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--studio-accent)]">
              <span className="hidden sm:inline">{translate("studio.modelPicker.change")}</span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--studio-panel)] shadow-none transition group-hover:translate-x-0.5">{"\u203a"}</span>
            </span>
          ) : null}
        </span>
      </button>
      {panel}
    </>
  );
}
