"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { centralAvatarPreviews } from "./avatar-preview-selection";

export function useAvatarMobilePreviews(section: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<{ mobile: boolean; keys: string[] }>({ mobile: false, keys: [] });
  const request = useRef<((key: string) => void) | null>(null);
  const requestPreview = useCallback((key: string) => request.current?.(key), []);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const mobile = window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observed = new Set<HTMLElement>(), visible = new Set<HTMLElement>();
    let frame = 0, preferred: string | null = null;
    function sync() {
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const keys = !mobile.matches || reduced.matches || document.hidden || root!.querySelector('[aria-modal="true"]') ? [] : centralAvatarPreviews(
        [...visible].filter(card => card.isConnected && card.dataset.avatarPreviewAvailable === "true").map(card => {
          const rect = (card.querySelector("[data-avatar-preview-media]") || card).getBoundingClientRect();
          return { key: card.dataset.avatarPreviewKey!, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
        }), { top, bottom: top + (viewport?.height || window.innerHeight), width: window.innerWidth }, preferred);
      setSelection(current => current.mobile === mobile.matches && current.keys.length === keys.length && current.keys.every((key, index) => key === keys[index]) ? current : { mobile: mobile.matches, keys });
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); }); };
    const scroll = () => { preferred = null; schedule(); };
    const intersection = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) visible.add(entry.target as HTMLElement); else visible.delete(entry.target as HTMLElement);
      schedule();
    }, { threshold: [0, .25, .5, 1] });
    function refresh() {
      const next = new Set(root!.querySelectorAll<HTMLElement>('[data-avatar-preview-available="true"]'));
      for (const card of observed) if (!next.has(card)) { intersection.unobserve(card); observed.delete(card); visible.delete(card); }
      for (const card of next) if (!observed.has(card)) { observed.add(card); intersection.observe(card); }
      schedule();
    }
    const changes = new MutationObserver(refresh);
    changes.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-avatar-preview-available"] });
    request.current = key => { preferred = key; sync(); };
    mobile.addEventListener("change", sync); reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("scroll", scroll, { passive: true, capture: true });
    window.addEventListener("resize", scroll);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", scroll);
    refresh(); sync();
    return () => {
      request.current = null; if (frame) cancelAnimationFrame(frame);
      intersection.disconnect(); changes.disconnect();
      mobile.removeEventListener("change", sync); reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", scroll);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", scroll);
    };
  }, [section]);
  return { ...selection, requestPreview };
}
