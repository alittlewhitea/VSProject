"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "./studio-link";
import { StudioParameterIcon, type StudioParameterKind } from "./studio-composer-controls";

type ButtonVariant = "primary" | "secondary" | "ghost";

function parseAspectRatioValue(value: string): { width: number; height: number } | null {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function AspectRatioGlyph({ value, className = "" }: { value: string; className?: string }) {
  const parsed = parseAspectRatioValue(value);
  if (!parsed) return <StudioParameterIcon kind="ratio" />;
  const scale = Math.min(11 / parsed.width, 11 / parsed.height);
  const rw = Math.max(3.5, Number((parsed.width * scale).toFixed(1)));
  const rh = Math.max(3.5, Number((parsed.height * scale).toFixed(1)));
  const x = Number(((14 - rw) / 2).toFixed(1));
  const y = Number(((14 - rh) / 2).toFixed(1));
  return (
    <svg
      data-select-icon
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className={className || undefined}
    >
      <rect x={x} y={y} width={rw} height={rh} rx="1.6" />
    </svg>
  );
}

export function StudioSelectField({ label, value, options, onValueChange, disabled = false, icon }: {
  label: string; value: string; options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void; disabled?: boolean;
  icon?: StudioParameterKind;
}) {
  const labelId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number; placement: "bottom" | "top" } | null>(null);

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] || options[0];
  const isDisabled = disabled || options.length === 0;
  const canOpen = !isDisabled && options.length > 1;
  const showPopover = open && canOpen;

  useEffect(() => {
    if (!showPopover) return;
    setHighlightedIndex(selectedIndex);
  }, [selectedIndex, showPopover]);

  useLayoutEffect(() => {
    if (!showPopover) {
      setCoords(null);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popover = popoverRef.current;
      const margin = 8;
      const gap = 6;
      const minWidth = Math.max(152, Math.round(rect.width));
      const popoverWidth = popover ? Math.max(minWidth, popover.offsetWidth) : minWidth;
      const estimatedHeight = popover ? popover.offsetHeight : Math.min(280, options.length * 36 + 40);
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const placement: "bottom" | "top" = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? "top" : "bottom";
      const rawTop = placement === "top" ? rect.top - estimatedHeight - gap : rect.bottom + gap;
      const top = Math.max(margin, Math.min(rawTop, viewportHeight - estimatedHeight - margin));
      const dir = trigger.closest("[dir]")?.getAttribute("dir");
      const preferredLeft = dir === "rtl" ? rect.right - popoverWidth : rect.left;
      const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - popoverWidth - margin));
      setCoords({ top, left, minWidth, placement });
    };
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    const onOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || popoverRef.current?.contains(target))) return;
      setOpen(false);
    };
    const onScrollOrResize = (event: Event) => {
      const target = event.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      if (event.type === "resize") {
        updatePosition();
      } else {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onOutsidePointer, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [options.length, showPopover]);

  useEffect(() => {
    if (!showPopover) return;
    const optionEl = popoverRef.current?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
    optionEl?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, showPopover]);

  const selectOption = (nextValue: string) => {
    if (nextValue !== value) onValueChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!canOpen) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!showPopover) {
        setOpen(true);
        setHighlightedIndex(selectedIndex);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex((current) => (current + delta + options.length) % options.length);
    } else if (event.key === "Home" && showPopover) {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End" && showPopover) {
      event.preventDefault();
      setHighlightedIndex(options.length - 1);
    } else if (event.key === "Escape" && showPopover) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if ((event.key === "Enter" || event.key === " ") && showPopover) {
      event.preventDefault();
      const target = options[highlightedIndex];
      if (target) selectOption(target.value);
    } else if (event.key === "Tab" && showPopover) {
      setOpen(false);
    }
  };

  const popover = showPopover && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popoverRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          dir={triggerRef.current?.closest("[dir]")?.getAttribute("dir") || undefined}
          data-placement={coords?.placement || "bottom"}
          className="studio-overlay df-select-popover"
          style={coords ? { top: `${coords.top}px`, left: `${coords.left}px`, minWidth: `${coords.minWidth}px` } : { visibility: "hidden", top: 0, left: 0 }}
        >
          <div className="df-select-popover-title">{label}</div>
          <div className="df-select-popover-list">
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-option-index={index}
                  data-highlighted={isHighlighted ? "true" : undefined}
                  className="df-select-option"
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option.value)}
                >
                  <span className="df-select-option-main">
                    {icon === "ratio" ? <AspectRatioGlyph value={option.value} className="df-select-ratio-glyph" /> : null}
                    <span className="df-select-option-label">{option.label}</span>
                  </span>
                  {isSelected ? (
                    <svg className="df-select-check" aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="df-select-field" title={label}>
      <span id={labelId}>{label}</span>
      <span className="df-select-control" data-has-icon={icon ? "true" : undefined} data-open={showPopover ? "true" : undefined}>
        {icon === "ratio" && selected ? <AspectRatioGlyph value={selected.value} /> : icon ? <StudioParameterIcon kind={icon} /> : null}
        <button
          ref={triggerRef}
          type="button"
          className="df-select-trigger"
          disabled={isDisabled}
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={showPopover}
          aria-controls={showPopover ? listboxId : undefined}
          onClick={() => { if (canOpen) setOpen((current) => !current); }}
          onKeyDown={handleKeyDown}
        >
          <span className="df-select-trigger-label">{selected?.label ?? value}</span>
        </button>
        <svg className="df-select-chevron" aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {popover}
    </div>
  );
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
