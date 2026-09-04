"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatApproximateCreditValue } from "../../lib/billing";

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
  value: string;
  options: ModelPickerOption[];
  translate: (key: string, values?: Record<string, string | number | null | undefined>) => string;
  onChange: (value: string) => void;
};

function ModelMark() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#eeeaff,#f8f7ff)] text-lg font-black text-[#6a5af9] shadow-[inset_0_0_0_1px_#ddd7ff]">
      {"\u2723"}
    </span>
  );
}

export function ModelPicker({ value, options, translate, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  const hasChoices = options.length > 1;

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
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label={translate("studio.modelPicker.close")} onClick={closePicker} className="absolute inset-0 bg-[#101828]/35 backdrop-blur-[2px]" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="model-picker-title" aria-describedby="model-picker-description" className="relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-white/70 bg-white shadow-[0_-12px_50px_rgba(16,24,40,0.18)] sm:max-w-[660px] sm:rounded-[24px] sm:shadow-[0_24px_80px_rgba(16,24,40,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eaecf0] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <ModelMark />
            <div className="min-w-0">
              <h2 id="model-picker-title" className="text-[17px] font-black tracking-[-0.02em] text-[#101828]">{translate("studio.modelPicker.title")}</h2>
              <p id="model-picker-description" className="mt-0.5 text-xs font-semibold text-[#7b879b]">{translate("studio.modelPicker.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={closePicker} aria-label={translate("studio.modelPicker.close")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#eaecf0] bg-white text-lg text-[#667085] transition hover:bg-[#f8f8fb]">{"\u00d7"}</button>
        </div>

        {options.length > 6 ? (
          <div className="border-b border-[#f1f3f7] px-5 py-3 sm:px-6">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e4e7ec] bg-[#fafbfc] px-3 focus-within:border-[#a99fff] focus-within:bg-white">
              <span className="text-[#98a2b3]">{"\u2315"}</span>
              <input data-model-search value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate("studio.modelPicker.search")} className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#344054] outline-none placeholder:text-[#98a2b3]" />
            </label>
          </div>
        ) : null}

        <div className="overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {groupedOptions.map(({ group, options: groupItems }) => (
            <div key={group} className="mb-4 last:mb-0">
              <div className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#98a2b3]">{group}</div>
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
                      className={`w-full rounded-2xl border p-3.5 text-start transition sm:p-4 ${active ? "border-[#8f80ff] bg-[linear-gradient(135deg,#f5f2ff,#fff)] shadow-[0_0_0_2px_#eeeaff]" : "border-[#eaecf0] bg-white hover:border-[#cec7ff] hover:bg-[#fbfaff]"}`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-sm font-black ${active ? "bg-[#6f59f7] text-white" : "bg-[#f3f1ff] text-[#6a5af9]"}`}>{active ? "\u2713" : "\u2723"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm font-black text-[#101828] sm:text-[15px]">{option.label}</strong>
                            {option.badge ? option.badge.trim().toLowerCase() === option.group.trim().toLowerCase() ? (
                              <span role="img" aria-label={option.badge} title={option.badge} className="grid h-6 w-6 place-items-center text-[15px]">
                                {"\u2b50"}
                              </span>
                            ) : <span className="rounded-full bg-[#eeeaff] px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-[#6a5af9]">{option.badge}</span> : null}
                            {active ? <span className="rounded-full bg-[#ecfdf3] px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#039855]">{translate("studio.modelPicker.selected")}</span> : null}
                          </span>
                          {option.description.trim().toLowerCase() !== option.group.trim().toLowerCase() ? <span className="mt-1.5 block text-xs leading-5 text-[#667085]">{option.description}</span> : null}
                          {option.performanceNote ? (
                            <span className="mt-2 inline-flex rounded-lg bg-[#eefcf6] px-2.5 py-1 text-[11px] font-black text-[#087f5b]">
                              {option.performanceNote}
                            </span>
                          ) : null}
                          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-lg bg-[#f7f8fa] px-2 py-1 text-[10px] font-bold text-[#667085]">{option.speed}</span>
                            <span className="ms-auto whitespace-nowrap text-[11px] font-black text-[#475467]">
                              {option.duration ? `${option.duration} = ` : ""}{option.credits} {translate("studio.common.credits")} <span className="font-bold text-[#8a7cf5]">= {formatApproximateCreditValue(option.credits)}</span>
                            </span>
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!groupedOptions.length ? <div className="px-4 py-10 text-center text-sm font-semibold text-[#98a2b3]">{translate("studio.modelPicker.noMatches")}</div> : null}
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  if (!selected) return null;

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
        className={`group w-full rounded-2xl border p-3.5 text-start transition sm:p-4 ${hasChoices ? "border-[#d7d1ff] bg-[linear-gradient(135deg,#faf9ff,#fff)] shadow-[0_8px_22px_rgba(106,90,249,0.08)] hover:border-[#a99fff] hover:shadow-[0_10px_28px_rgba(106,90,249,0.13)]" : "cursor-default border-[#eaecf0] bg-[#fafbfc]"}`}
      >
        <span className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6a5af9]">{translate("studio.modelPicker.label")}</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${hasChoices ? "bg-[#eeeaff] text-[#6a5af9]" : "bg-[#f2f4f7] text-[#667085]"}`}>
            {hasChoices ? translate("studio.modelPicker.available", { count: options.length }) : translate("studio.modelPicker.onlyAvailable")}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <ModelMark />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="truncate text-[14px] font-black text-[#101828]">{selected.label}</strong>
              {selected.badge ? selectedBadgeIsRecommendation ? (
                <span role="img" aria-label={selected.badge} title={selected.badge} className="grid h-6 w-6 place-items-center text-[15px]">
                  {"\u2b50"}
                </span>
              ) : <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#6a5af9] shadow-[inset_0_0_0_1px_#ded9ff]">{selected.badge}</span> : null}
            </span>
            <span className="mt-1.5 block text-[11px] font-semibold sm:hidden">
              <span className="block truncate text-[#087f5b]">{selected.performanceNote || selected.speed}</span>
              <span className="mt-0.5 block whitespace-nowrap text-[#475467]">
                {selected.duration ? `${selected.duration} = ` : ""}{selected.credits} {translate("studio.common.credits")} = <strong className="text-[#8a7cf5]">{formatApproximateCreditValue(selected.credits)}</strong>
              </span>
            </span>
            <span className="mt-1.5 hidden text-[11px] font-semibold sm:block">
              <span className="block truncate text-[#7b879b]">
                {selected.performanceNote ? <strong className="text-[#087f5b]">{selected.performanceNote}</strong> : null}
                {selected.performanceNote ? " · " : ""}{selected.speed}{selectedBadgeIsRecommendation ? "" : ` · ${selected.group}`}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[#475467]">
                {selected.duration ? `${selected.duration} = ` : ""}{selected.credits} {translate("studio.common.credits")} = <strong className="text-[#8a7cf5]">{formatApproximateCreditValue(selected.credits)}</strong>
              </span>
            </span>
          </span>
          {hasChoices ? (
            <span className="flex shrink-0 items-center gap-2 text-xs font-black text-[#6a5af9]">
              <span className="hidden sm:inline">{translate("studio.modelPicker.change")}</span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_#ddd7ff] transition group-hover:translate-x-0.5">{"\u203a"}</span>
            </span>
          ) : null}
        </span>
      </button>
      {panel}
    </>
  );
}
