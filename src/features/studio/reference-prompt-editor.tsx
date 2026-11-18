"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { filterReferenceAssets, insertReferenceToken, referenceMentionQuery, referencePromptAssets, referencePromptParts, type ReferenceAsset } from "../../lib/reference-prompt";
import styles from "./reference-prompt-editor.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

function referenceFilename(asset: ReferenceAsset) {
  if (asset.kind === "image") return "";
  try {
    const url = new URL(asset.url);
    return url.pathname.split("/").filter(Boolean).pop() || url.hostname;
  } catch { return ""; }
}

function AssetThumbnail({ asset, large = false }: { asset: ReferenceAsset; large?: boolean }) {
  return <span className={`${styles.thumbnail} ${large ? styles.largeThumbnail : ""}`} data-kind={asset.kind}>
    {asset.kind === "image" ? <img src={asset.url} alt="" draggable={false} /> : asset.kind === "video" ?
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg> :
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 17V5l10-2v12M10 9l10-2" /><ellipse cx="6.5" cy="17" rx="3.5" ry="3" /><ellipse cx="16.5" cy="15" rx="3.5" ry="3" /></svg>}
  </span>;
}

export function ReferencePromptEditor({ value, images, videos, audio, placeholder, notice, onChange, onGenerate, translate: t }: {
  value: string; images: string[]; videos: string[]; audio: string[]; placeholder: string; notice?: string;
  onChange: (value: string) => void; onGenerate: () => void; translate: Translate;
}) {
  const id = "studio-reference-mention";
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const [selection, setSelection] = useState({ start: value.length, end: value.length });
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 48, left: 12 });
  const [scrollTop, setScrollTop] = useState(0);
  const assets = useMemo(() => referencePromptAssets(images, videos, audio), [images, videos, audio]);
  const parts = useMemo(() => referencePromptParts(value, assets), [value, assets]);
  const query = referenceMentionQuery(value, selection.start, selection.end);
  const queryKey = query ? `${query.start}:${selection.start}:${query.query}` : null;
  const open = focused && query !== null && dismissed !== queryKey && !composingRef.current;
  const options = filterReferenceAssets(assets, query?.query || "");
  const selectedIndex = Math.min(activeIndex, Math.max(0, options.length - 1));
  const usedAssets = assets.filter(asset => parts.some(part => part.asset?.token === asset.token));
  const missing = parts.some(part => part.missing);

  function syncSelection() {
    const input = inputRef.current;
    if (input) setSelection({ start: input.selectionStart, end: input.selectionEnd });
  }

  function syncScroll() {
    if (inputRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = inputRef.current.scrollTop;
      setScrollTop(inputRef.current.scrollTop);
    }
  }

  function insert(asset: ReferenceAsset) {
    const input = inputRef.current;
    if (!input || input.matches(":disabled")) return;
    const start = query?.start ?? selection.start;
    const end = query?.end ?? selection.end;
    const next = insertReferenceToken(value, start, end, asset.token);
    input.focus({ preventScroll: true });
    input.setSelectionRange(start, end);
    // Native insertion preserves the textarea's undo history in supporting browsers.
    if (!document.execCommand("insertText", false, next.insertion)) input.setRangeText(next.insertion, start, end, "end");
    onChange(input.value);
    setDismissed(queryKey);
    setSelection({ start: next.caret, end: next.caret });
    requestAnimationFrame(() => { input.setSelectionRange(next.caret, next.caret); syncScroll(); });
  }

  useEffect(() => { setActiveIndex(0); }, [queryKey]);
  useEffect(() => {
    const option = open ? document.getElementById(`${id}-option-${selectedIndex}`) : null;
    const list = option?.parentElement;
    if (option && list) {
      const row = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
      if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
      else if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top;
    }
  }, [open, id, selectedIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const updatePosition = () => {
      const root = rootRef.current, caret = caretRef.current, popup = popupRef.current;
      if (!root || !caret || !popup) return;
      const rootRect = root.getBoundingClientRect(), caretRect = caret.getBoundingClientRect();
      const inputRect = inputRef.current!.getBoundingClientRect();
      const anchorTop = Math.max(inputRect.top + 12, Math.min(caretRect.top, inputRect.bottom - 28));
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const dock = document.querySelector(".df-mobile-dock");
      const bottom = dock?.getClientRects().length ? Math.min(viewportBottom, dock.getBoundingClientRect().top) : viewportBottom;
      popup.style.maxHeight = `${Math.max(0, bottom - viewportTop - 16)}px`;
      const popupHeight = popup.offsetHeight;
      const belowSpace = bottom - anchorTop - 36;
      const above = belowSpace < popupHeight && anchorTop - viewportTop - 16 > belowSpace;
      const anchoredTop = above ? anchorTop - popupHeight - 8 : anchorTop + 28;
      setPosition({
        left: Math.max(8, Math.min(caretRect.left - rootRect.left, rootRect.width - popup.offsetWidth - 8)),
        top: Math.max(viewportTop + 8, Math.min(anchoredTop, bottom - popupHeight - 8)) - rootRect.top,
      });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    if (rootRef.current) observer.observe(rootRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open, selection.start, value, options.length, scrollTop]);

  // The mirror uses the exact textarea typography, without inline boxes that move the caret.
  let offset = 0;
  let caretPlaced = false;
  const highlighted = parts.map((part, index) => {
    const start = offset;
    offset += part.text.length;
    let content;
    if (!caretPlaced && selection.start >= start && selection.start <= offset) {
      const within = selection.start - start;
      caretPlaced = true;
      content = <>{part.text.slice(0, within)}<span ref={caretRef} data-mention-caret />{part.text.slice(within)}</>;
    } else content = part.text;
    return part.asset || part.missing ? <mark key={index} className={part.missing ? styles.missing : styles.mention} data-reference-token={part.text}>{content}</mark> : <Fragment key={index}>{content}</Fragment>;
  });

  return <div ref={rootRef} className={styles.root} data-reference-prompt>
    <div className={styles.surface}>
      <div ref={mirrorRef} className={styles.mirror} dir="auto" aria-hidden="true">{highlighted}{!caretPlaced ? <span ref={caretRef} data-mention-caret /> : null}{"\n"}</div>
      <textarea ref={inputRef} id="video-studio-prompt" data-mention-input dir="auto" value={value} placeholder={placeholder} spellCheck={false}
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && options.length ? `${id}-option-${selectedIndex}` : undefined} aria-describedby={`${id}-hint`}
        onChange={event => { onChange(event.currentTarget.value); syncSelection(); syncScroll(); setDismissed(null); }}
        onSelect={syncSelection} onFocus={() => { setFocused(true); syncSelection(); }} onBlur={() => setFocused(false)} onScroll={syncScroll}
        onCompositionStart={() => { composingRef.current = true; setDismissed(queryKey); }}
        onCompositionEnd={() => { composingRef.current = false; syncSelection(); setDismissed(null); }}
        onKeyDown={event => {
          if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (open && !event.ctrlKey && !event.metaKey) {
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
              event.preventDefault(); event.stopPropagation();
              setActiveIndex((selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length); return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && options.length) {
              event.preventDefault(); event.stopPropagation(); insert(options[selectedIndex]); return;
            }
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(queryKey); return; }
            if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); return; }
          }
          if (event.key === "Enter" && !event.shiftKey) {
            if (window.matchMedia("(min-width: 1024px)").matches && (event.ctrlKey || event.metaKey)) return;
            event.preventDefault(); onGenerate();
          }
        }} />
    </div>
    <div className={styles.footer} id={`${id}-hint`}>
      <span className={styles.hint}><kbd>@</kbd>{t(assets.length ? "studio.mention.hint" : "studio.mention.uploadHint")}</span>
      {usedAssets.length ? <span className={styles.count}>{t("studio.mention.linked", { count: usedAssets.length })}</span> : null}
    </div>
    {usedAssets.length ? <div className={styles.linkedAssets} aria-label={t("studio.mention.linkedLabel")}>
      {usedAssets.map(asset => <button type="button" key={asset.token} className={styles.chip} onMouseDown={event => event.preventDefault()} onClick={() => insert(asset)} aria-label={t("studio.mention.insert", { token: asset.token })}>
        <AssetThumbnail asset={asset} /><strong>{asset.token}</strong>
        {asset.kind === "image" ? <span className={styles.preview} aria-hidden="true"><img src={asset.url} alt="" /><span>{asset.token}</span></span> : null}
      </button>)}
    </div> : null}
    {missing ? <p className={styles.warning} role="status">{t("studio.mention.missing")}</p> : null}
    {notice ? <p className={styles.warning} role="status">{notice}</p> : null}
    {open ? <div ref={popupRef} className={styles.popup} style={position} data-mention-popup onMouseDown={event => event.preventDefault()}>
      <div className={styles.popupHeader}><span>{t("studio.mention.title")}</span><span>{options.length}</span></div>
      <div id={`${id}-list`} className={styles.options} role="listbox" aria-label={t("studio.mention.title")}>
        {options.length ? options.map((asset, index) => <button key={asset.token} id={`${id}-option-${index}`} type="button" role="option" aria-selected={index === selectedIndex} tabIndex={-1}
          className={styles.option} onMouseMove={() => setActiveIndex(index)} onClick={() => insert(asset)} data-mention-option={asset.token}>
          <AssetThumbnail asset={asset} large /><span className={styles.optionText}><strong>{asset.token}</strong><span>{referenceFilename(asset) || t(`studio.mention.${asset.kind}`, { index: asset.index })}</span></span>
          {index === selectedIndex ? <kbd aria-hidden="true">↵</kbd> : null}
        </button>) : <div className={styles.empty}>{t(assets.length ? "studio.mention.noMatch" : "studio.mention.uploadHint")}</div>}
      </div>
      <div className={styles.popupFooter}><span><kbd>↑</kbd><kbd>↓</kbd> {t("studio.mention.navigate")}</span><span><kbd>↵</kbd> {t("studio.mention.select")}</span><span><kbd>esc</kbd> {t("studio.mention.close")}</span></div>
    </div> : null}
  </div>;
}
