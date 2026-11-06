"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { layoutStudioMasonry, studioMasonryWindow, type MasonryItem } from "./studio-masonry-layout";
import styles from "./studio-template-gallery.module.css";

function toolbarInset(element: HTMLElement) {
  const bar = element.parentElement?.querySelector<HTMLElement>("[data-template-toolbar]");
  return (Number.parseFloat(getComputedStyle(element).getPropertyValue("--df-template-sticky-top")) || 0) + (bar?.offsetHeight || 70) + 16;
}

export function StudioVirtualMasonry<T extends MasonryItem>({ items, pinnedId, label, renderItem }: {
  items: T[]; pinnedId?: string; label: string; renderItem: (item: T) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, columns: 4, gap: 16 });
  const [visible, setVisible] = useState<number[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const lastLayout = useRef<ReturnType<typeof layoutStudioMasonry> | null>(null);
  const layout = useMemo(() => layoutStudioMasonry(items, metrics.width, metrics.columns, metrics.gap), [items, metrics]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      const next = { width: element.clientWidth, columns: Number.parseInt(style.getPropertyValue("--template-columns")) || 4, gap: Number.parseFloat(style.getPropertyValue("--template-gap")) || 16 };
      setMetrics(previous => Math.abs(previous.width - next.width) < .5 && previous.columns === next.columns && previous.gap === next.gap ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element); window.addEventListener("resize", measure); measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    // Keep the same visible item when the sidebar, viewport or column count changes.
    if (lastLayout.current && lastLayout.current !== layout && anchor.current && element.getBoundingClientRect().top < 0) {
      const tile = layout.tiles.find(item => item.id === anchor.current?.id);
      if (tile) window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top + tile.top + anchor.current.offset, behavior: "instant" });
    }
    lastLayout.current = layout;
    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const top = -rect.top;
      const next = studioMasonryWindow(layout.tiles, top, window.innerHeight - rect.top, Math.max(400, Math.min(900, window.innerHeight * .75)));
      setVisible(previous => previous.length === next.length && previous.every((index, i) => index === next[i]) ? previous : next);
      const inset = toolbarInset(element);
      const position = top + inset;
      const near = layout.tiles.filter(tile => tile.bottom > position).sort((a, b) => Math.abs(a.top - position) - Math.abs(b.top - position))[0];
      anchor.current = near ? { id: near.id, offset: top - near.top } : null;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [layout]);

  const indexes = useMemo(() => {
    const result = new Set(visible);
    for (const id of [pinnedId, activeId, focusTarget]) { const index = items.findIndex(item => item.id === id); if (index >= 0) result.add(index); }
    return [...result].filter(index => index < layout.tiles.length).sort((a, b) => a - b);
  }, [visible, items, layout, pinnedId, activeId, focusTarget]);

  useLayoutEffect(() => {
    if (!focusTarget || !ref.current) return;
    const tile = layout.tiles.find(item => item.id === focusTarget);
    const button = ref.current.querySelector<HTMLButtonElement>(`[data-template-index="${tile?.index}"] button`);
    if (!tile || !button) return;
    const inset = toolbarInset(ref.current);
    const top = ref.current.getBoundingClientRect().top + tile.top;
    if (top < inset || top + tile.height > window.innerHeight - 16) window.scrollTo({ top: window.scrollY + top - inset, behavior: "instant" });
    button.focus({ preventScroll: true }); setFocusTarget(null);
  }, [focusTarget, layout, indexes]);

  return <div ref={ref} className={styles.masonry} role="list" aria-label={label} data-virtual-masonry data-template-total={items.length} style={{ height: layout.height }}
    onFocusCapture={event => { const card = (event.target as Element).closest<HTMLElement>("[data-template-id]"); if (card) setActiveId(card.dataset.templateId || null); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveId(null); }}
    onKeyDownCapture={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof HTMLButtonElement)) return;
      const wrapper = event.target.closest<HTMLElement>("[data-template-index]");
      if (!wrapper) return;
      const index = Number(wrapper.dataset.templateIndex);
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
      let next: number;
      if (event.key === "Tab") next = index + (event.shiftKey ? -1 : 1);
      else if (event.key === "ArrowRight") next = index + (rtl ? -1 : 1);
      else if (event.key === "ArrowLeft") next = index + (rtl ? 1 : -1);
      else if (event.key === "ArrowDown") next = Math.min(items.length - 1, index + metrics.columns);
      else if (event.key === "ArrowUp") next = Math.max(0, index - metrics.columns);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else return;
      if (next < 0 || next >= items.length) return;
      event.preventDefault(); setFocusTarget(items[next].id);
    }}>
    {indexes.map(index => { const tile = layout.tiles[index]; return <div key={tile.id} role="listitem" aria-posinset={index + 1} aria-setsize={items.length} data-template-index={index} className={styles.virtualTile} style={{ top: tile.top, insetInlineStart: tile.start, width: tile.width, height: tile.height }}>{renderItem(items[index])}</div>; })}
  </div>;
}
