"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "../../i18n/routing";
import { createPortal } from "react-dom";
import { StudioIcon } from "./studio-navigation";
import { StudioMediaLoadError, useStudioMediaFeedback } from "./studio-media-feedback";
import { useStudioDialog } from "./use-studio-dialog";
import { StudioVirtualMasonry } from "./studio-virtual-masonry";
import { studioTemplateCategoryLabel } from "./studio-template-labels";
import { useStudioTemplateTitles } from "./use-studio-template-titles";
import Link from "./studio-link";
import { focusStudioTemplateReference, studioImageTemplateHref } from "./studio-image-template-link";
import { focusStudioVideoReference, studioVideoTemplateHref } from "./studio-video-template-link";
import styles from "./studio-template-gallery.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
type Kind = "image" | "video" | "combined";
type Category = "all" | "motion" | "ugc" | "tiktok" | "product-shot" | "ads" | "posters" | "marketplace";
type BaseTemplate = {
  id: string; title: string; categories: Category[];
  width: number; height: number; sourceUrl: string;
};
type VideoTemplate = BaseTemplate & { videoUrl: string; posterUrl: string };
type ImageTemplate = BaseTemplate & { imageUrl: string };
type Template = VideoTemplate | ImageTemplate;
type Catalog = { version: 1; capturedAt: string; items: Template[]; categoryOrder?: Record<string, string[]> };
const templateCategories: Record<Kind, { id: Category; label: string }[]> = {
  video: [{ id: "all", label: "All" }, { id: "motion", label: "Motion" }, { id: "ugc", label: "UGC" }, { id: "tiktok", label: "TikTok" }],
  image: [{ id: "all", label: "All" }, { id: "product-shot", label: "Product shot" }, { id: "ads", label: "Ads" }, { id: "posters", label: "Posters" }, { id: "marketplace", label: "Marketplace" }],
  combined: [{ id: "all", label: "All" }, { id: "product-shot", label: "Product shot" }, { id: "motion", label: "Motion" }, { id: "ugc", label: "UGC" }, { id: "tiktok", label: "TikTok" }, { id: "ads", label: "Ads" }, { id: "posters", label: "Posters" }, { id: "marketplace", label: "Marketplace" }]
};
const cachedCatalogs: Partial<Record<Kind, Catalog>> = {};

function isVideo(item: Template): item is VideoTemplate { return "videoUrl" in item; }

function validTemplate(item: Template, kind: Kind) {
  return item && typeof item.id === "string" && typeof item.title === "string" &&
    Array.isArray(item.categories) && item.categories.some(value => value !== "all" && templateCategories[kind].some(category => category.id === value)) &&
    Number.isFinite(item.width) && item.width > 0 && Number.isFinite(item.height) && item.height > 0 &&
    typeof item.sourceUrl === "string" && item.sourceUrl.startsWith("https://") &&
    (isVideo(item) ? kind !== "image" && [item.videoUrl, item.posterUrl].every(value => typeof value === "string" && value.startsWith("https://")) : kind !== "video" && typeof item.imageUrl === "string" && item.imageUrl.startsWith("https://"));
}

function thumbnail(url: string) {
  return url.replace("/width=1080,", "/width=480,");
}

function validOrder(catalog: Catalog) {
  if (!catalog.categoryOrder) return true;
  if (typeof catalog.categoryOrder !== "object" || Array.isArray(catalog.categoryOrder)) return false;
  return Object.entries(catalog.categoryOrder).every(([category, order]) => {
    const expected = catalog.items.filter(item => category === "all" || item.categories.includes(category as Category));
    const ids = new Set(expected.map(item => item.id));
    return Array.isArray(order) && order.length === expected.length && new Set(order).size === order.length && order.every(id => ids.has(id));
  });
}

async function loadCatalog(kind: Kind, signal: AbortSignal): Promise<Catalog> {
  const cached = cachedCatalogs[kind];
  if (cached) return cached;
  let value: Catalog;
  if (kind === "combined") {
    const [images, videos, response] = await Promise.all([loadCatalog("image", signal), loadCatalog("video", signal), fetch("/data/studio-combined-template-order.json", { signal })]);
    if (!response.ok) throw new Error("Catalog order unavailable");
    const order = await response.json() as { version: number; ids: string[] };
    const byId = new Map([...images.items, ...videos.items].map(item => [item.id, item]));
    if (order.version !== 1 || !Array.isArray(order.ids) || order.ids.length !== byId.size || new Set(order.ids).size !== byId.size || !order.ids.every(id => byId.has(id))) throw new Error("Invalid combined order");
    const categoryOrder: Record<string, string[]> = { ...images.categoryOrder, all: order.ids };
    for (const category of ["motion", "ugc", "tiktok"] as const) categoryOrder[category] = videos.items.filter(item => item.categories.includes(category)).map(item => item.id);
    value = { version: 1, capturedAt: images.capturedAt, items: order.ids.map(id => byId.get(id)!), categoryOrder };
  } else {
    const response = await fetch(`/data/studio-${kind}-templates.json`, { signal });
    if (!response.ok) throw new Error("Catalog unavailable");
    value = await response.json() as Catalog;
  }
  if (value.version !== 1 || !Array.isArray(value.items) || !value.items.length || !value.items.every(item => validTemplate(item, kind)) || !validOrder(value)) throw new Error("Invalid catalog");
  if (!signal.aborted) cachedCatalogs[kind] = value;
  return value;
}

function TemplateCard({ item, title, translate, onPreview }: { item: Template; title: string; translate: Translate; onPreview: () => void }) {
  const [hovering, setHovering] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const start = () => {
    if (isVideo(item) && window.matchMedia("(hover: hover)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setHovering(true);
  };
  const stop = () => { setHovering(false); setVideoReady(false); };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const pause = () => { setHovering(false); setVideoReady(false); };
    const visibility = () => { if (document.hidden) pause(); };
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); });
    observer.observe(video); document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); video.pause(); video.removeAttribute("src"); video.load(); };
  }, [hovering]);
  return <button type="button" className={styles.card} data-template-id={item.id} aria-label={`${translate("studio.workbench.openPreview")}: ${title}`} onClick={onPreview} onPointerEnter={start} onPointerLeave={stop} onFocus={start} onBlur={stop} style={{ aspectRatio: `${item.width} / ${item.height}` } as CSSProperties}>
    {!imageFailed ? <img src={thumbnail(isVideo(item) ? item.posterUrl : item.imageUrl)} width={item.width} height={item.height} loading="lazy" decoding="async" alt="" onError={() => setImageFailed(true)} /> : <span className={styles.imageFallback}><StudioIcon name={isVideo(item) ? "video" : "image"} className="h-7 w-7" />{title}</span>}
    {hovering && isVideo(item) ? <video ref={videoRef} src={item.videoUrl} muted autoPlay loop playsInline preload="none" aria-hidden="true" className={videoReady ? styles.hoverReady : styles.hoverLoading} onPlaying={() => setVideoReady(true)} onError={stop} /> : null}
    <span className={styles.play} aria-hidden="true">{isVideo(item) ? <svg viewBox="0 0 16 16" fill="currentColor"><path d="m5 3 8 5-8 5V3Z" /></svg> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6V2h4m4 0h4v4M2 10v4h4m4 0h4v-4" /></svg>}</span>
    <span className={styles.caption}><strong dir="auto">{title}</strong><span>{translate("studio.workbench.openPreview")} ↗</span></span>
  </button>;
}

function TemplatePreview({ item, title, translate, onClose }: { item: Template; title: string; translate: Translate; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const sourceUrl = isVideo(item) ? item.videoUrl : item.imageUrl;
  const media = useStudioMediaFeedback(sourceUrl);
  useStudioDialog(true, dialogRef, { onClose });
  useEffect(() => {
    const video = playerRef.current;
    return () => { if (video) { video.pause(); video.removeAttribute("src"); video.load(); } };
  }, [media.mediaKey]);
  return createPortal(<div className={styles.backdrop} onClick={onClose}>
    <section ref={dialogRef} data-template-preview role="dialog" aria-modal="true" aria-labelledby="template-preview-title" tabIndex={-1} className={styles.dialog} onClick={event => event.stopPropagation()}>
      <header><div><span>{item.categories.map(value => studioTemplateCategoryLabel(translate, value)).join(" · ")}</span><h2 id="template-preview-title" dir="auto">{title}</h2></div><button type="button" aria-label={translate("studio.modal.close")} onClick={onClose}><StudioIcon name="x" className="h-5 w-5" /></button></header>
      <div className={styles.player}>
        {media.failed ? <StudioMediaLoadError translate={translate} message={translate("studio.templates.unavailable")} onRetry={media.retry} originalUrl={sourceUrl} /> : null}
        {isVideo(item) ? <video ref={playerRef} key={media.mediaKey} src={item.videoUrl} poster={thumbnail(item.posterUrl)} controls autoPlay muted playsInline hidden={media.failed} onError={media.onError} /> : <img key={media.mediaKey} src={item.imageUrl} alt={title} hidden={media.failed} onError={media.onError} />}
      </div>
      <footer><span>Higgsfield Marketing Studio</span>{isVideo(item) ? <Link className={styles.create} href={studioVideoTemplateHref(item, translate("studio.referenceVideo.templatePrompt"))} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        onClose(); focusStudioVideoReference(item.videoUrl);
      }}>{translate("studio.templates.createLike")}<StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" /></Link> : <Link className={styles.create} href={studioImageTemplateHref(item, translate("studio.templates.createPrompt"))} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        onClose(); focusStudioTemplateReference(item.imageUrl);
      }}>{translate("studio.templates.createLike")}<StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" /></Link>}</footer>
    </section>
  </div>, document.body);
}

/** A public-media catalog only; generation, task data and billing remain in Studio. */
export function StudioTemplateGallery({ kind, translate, locale = "en", videoFocusRequest = 0 }: { kind: Kind; translate: Translate; locale?: Locale; videoFocusRequest?: number }) {
  const galleryRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const categories = templateCategories[kind];
  const [catalog, setCatalog] = useState<Catalog | null>(cachedCatalogs[kind] || null);
  const [category, setCategory] = useState<Category>("all");
  const [loading, setLoading] = useState(!cachedCatalogs[kind]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Template | null>(null);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">("all");
  const [enabled, setEnabled] = useState(kind !== "combined");
  const [pendingVideoFocus, setPendingVideoFocus] = useState(false);
  const templateTitle = useStudioTemplateTitles(enabled ? locale : "en");
  useEffect(() => {
    if (kind !== "combined" || !videoFocusRequest) return;
    setEnabled(true); setCategory("all"); setMediaFilter("video"); setPendingVideoFocus(true);
  }, [kind, videoFocusRequest]);
  useLayoutEffect(() => {
    if (!pendingVideoFocus || loading || (!catalog && !failed) || category !== "all" || mediaFilter !== "video") return;
    // Let the newly filtered virtual list establish its full height before scrolling.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      galleryRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      filtersRef.current?.querySelector<HTMLButtonElement>('[data-template-media="video"]')?.focus({ preventScroll: true });
      setPendingVideoFocus(false);
    }); });
    return () => cancelAnimationFrame(frame);
  }, [pendingVideoFocus, loading, catalog, failed, category, mediaFilter]);
  useEffect(() => {
    if (kind !== "combined") return;
    const enable = () => setEnabled(true);
    window.addEventListener("studio:load-template-gallery", enable);
    return () => window.removeEventListener("studio:load-template-gallery", enable);
  }, [kind]);
  useEffect(() => {
    if (enabled || !galleryRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setEnabled(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(galleryRef.current);
    return () => observer.disconnect();
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const cached = cachedCatalogs[kind];
    if (cached) { setCatalog(cached); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    loadCatalog(kind, controller.signal)
      .then(value => { if (!controller.signal.aborted) setCatalog(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, retry, enabled]);
  const items = useMemo(() => {
    if (!catalog) return [];
    const order = catalog.categoryOrder?.[category];
    let filtered: Template[];
    if (order) { const byId = new Map(catalog.items.map(item => [item.id, item])); filtered = order.flatMap(id => { const item = byId.get(id); return item ? [item] : []; }); }
    else filtered = category === "all" ? catalog.items : catalog.items.filter(item => item.categories.includes(category));
    return mediaFilter === "all" ? filtered : filtered.filter(item => isVideo(item) === (mediaFilter === "video"));
  }, [catalog, category, mediaFilter]);
  const resetScroll = () => {
        const heading = headingRef.current;
        const filters = filtersRef.current;
        const inset = filters ? Number.parseFloat(getComputedStyle(filters).top) || 0 : 0;
        if (heading && heading.getBoundingClientRect().top < inset) window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().bottom + (Number.parseFloat(getComputedStyle(heading).marginBottom) || 0) - inset, behavior: "instant" });
  };
  return <section ref={galleryRef} id={`${kind}-template-gallery`} className={styles.gallery} data-studio-video-templates={kind === "video" ? true : undefined} data-studio-image-templates={kind === "image" ? true : undefined} data-studio-combined-templates={kind === "combined" ? true : undefined} aria-busy={loading} aria-labelledby={`${kind}-templates-title`}>
    <div ref={headingRef} className={styles.heading}><div><h2 id={`${kind}-templates-title`}>{translate("studio.templates.title")}</h2><p>{translate(kind === "image" ? "studio.templates.imageHint" : kind === "combined" ? "studio.templates.combinedHint" : "studio.templates.hint")}</p></div></div>
    <div ref={filtersRef} data-template-toolbar className={styles.filterBar}>
    <div className={styles.filters} role="group" aria-label={translate("studio.templates.title")}>
      {categories.map(value => <button type="button" key={value.id} data-template-category={value.id} aria-pressed={category === value.id} onClick={() => {
        if (value.id === category) return;
        resetScroll();
        setCategory(value.id);
      }}>{studioTemplateCategoryLabel(translate, value.id)}</button>)}
    </div>
    {kind === "combined" ? <div className={styles.mediaFilters} role="group" aria-label={translate("studio.templates.media")}>
      {(["all", "image", "video"] as const).map(value => <button type="button" key={value} data-template-media={value} aria-pressed={mediaFilter === value} onClick={() => { if (value !== mediaFilter) { resetScroll(); setMediaFilter(value); } }}>{translate(value === "all" ? "studio.gallery.category.all" : value === "image" ? "studio.templates.images" : "studio.templates.videos")}</button>)}
    </div> : null}
    </div>
    {failed ? <div className={styles.error} role="alert"><p>{translate("studio.templates.unavailable")}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{translate("studio.templates.retry")}</button></div> : loading ? <div className={styles.skeletons} role="status" aria-label={translate("studio.templates.loading")}>{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div> : !items.length ? <p className={styles.empty}>{translate("studio.templates.empty")}</p> : <StudioVirtualMasonry key={`${category}:${mediaFilter}`} items={items} pinnedId={selected?.id} label={translate("studio.templates.title")} renderItem={item => <TemplateCard item={item} title={templateTitle(item.title)} translate={translate} onPreview={() => setSelected(item)} />} />}
    {selected ? <TemplatePreview item={selected} title={templateTitle(selected.title)} translate={translate} onClose={() => setSelected(null)} /> : null}
  </section>;
}
