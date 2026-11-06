"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./studio-scroll-to-bottom.module.css";

type Translate = (key: string) => string;
export function StudioScrollToBottom({ translate, routeKey }: { translate: Translate; routeKey: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const jumping = useRef(false);
  const [visible, setVisible] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const preparation = useRef<AbortController | null>(null);
  useEffect(() => {
    jumping.current = false; setArrived(false); setPreparing(false);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const root = document.scrollingElement || document.documentElement;
      const remaining = root.scrollHeight - window.innerHeight - window.scrollY;
      if (jumping.current && remaining <= 2) { jumping.current = false; setArrived(true); }
      if (remaining > 120) setArrived(false);
      const button = buttonRef.current;
      if (!button) return;
      const style = getComputedStyle(button);
      const size = Number.parseFloat(style.width) || 44;
      const right = Number.parseFloat(style.right);
      const left = Number.isFinite(right) ? window.innerWidth - right - size : Number.parseFloat(style.left) || 16;
      const top = window.innerHeight - (Number.parseFloat(style.bottom) || 20) - size;
      const overlaps = (rect: { left: number; right: number; top: number; bottom: number }) => rect.left < left + size + 6 && rect.right > left - 6 && rect.top < top + size + 6 && rect.bottom > top - 6;
      const critical = document.querySelectorAll<HTMLElement>(
        '.df-generate-button, [data-video-action-bar] > button, .studio-start, [data-upload-reference], [data-add-reference], [data-remove-reference], input:not([type="hidden"]), select, textarea, [contenteditable="true"], label:has(input[type="file"]), [role="alert"]'
      );
      const blocked = Array.from(critical).some(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && overlaps(rect);
      }) || Array.from(document.querySelectorAll<HTMLMediaElement>('video[controls], audio[controls]')).some(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && overlaps({ left: rect.left, right: rect.right, top: Math.max(rect.top, rect.bottom - 56), bottom: rect.bottom });
      });
      const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
      // Keep the focused button mounted until its smooth scroll finishes. Hiding it
      // earlier can cancel Chromium's scroll animation just above the destination.
      setVisible(root.scrollHeight > window.innerHeight + 240 && (remaining > 120 || jumping.current) && !editing && (jumping.current || !blocked));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const interrupt = () => { if (jumping.current) { jumping.current = false; schedule(); } };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    schedule();
    return () => {
      preparation.current?.abort();
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", interrupt); window.removeEventListener("touchstart", interrupt);
      document.removeEventListener("focusin", schedule); document.removeEventListener("focusout", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [routeKey]);
  return <>
    <button ref={buttonRef} data-scroll-bottom hidden={!visible} type="button" disabled={preparing} aria-busy={preparing} className={styles.button} aria-label={translate("studio.scroll.bottom")} title={translate("studio.scroll.bottom")} onClick={async () => {
      // Resolve the deferred homepage catalog before calculating the final destination.
      const pending = document.querySelector<HTMLElement>('[data-studio-combined-templates][aria-busy="true"]');
      if (pending) {
        preparation.current?.abort();
        const controller = new AbortController(); preparation.current = controller;
        setPreparing(true);
        window.dispatchEvent(new Event("studio:load-template-gallery"));
        await new Promise<void>(resolve => {
          const finish = () => { observer.disconnect(); clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
          const observer = new MutationObserver(() => { if (!pending.isConnected || pending.getAttribute("aria-busy") === "false") finish(); });
          const timer = setTimeout(finish, 30000);
          observer.observe(document.body, { attributes: true, attributeFilter: ["aria-busy"], childList: true, subtree: true });
          controller.signal.addEventListener("abort", finish, { once: true });
          if (!pending.isConnected || pending.getAttribute("aria-busy") === "false") finish();
        });
        if (controller.signal.aborted) return;
        setPreparing(false);
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (controller.signal.aborted) return;
      }
      jumping.current = true; setArrived(false);
      window.scrollTo({ top: (document.scrollingElement || document.documentElement).scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m-4-4 4 4 4-4M5 20h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span aria-hidden="true">{translate("studio.scroll.bottom")}</span>
    </button>
    <span className={styles.announcement} role="status" aria-live="polite">{arrived ? translate("studio.scroll.arrived") : ""}</span>
  </>;
}
