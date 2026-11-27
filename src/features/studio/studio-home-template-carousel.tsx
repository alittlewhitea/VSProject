"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "../../i18n/routing";
import { navigateStudio } from "../../lib/studio-navigation";
import { studioAppsCopy } from "./studio-apps-i18n";
import { StudioIcon } from "./studio-navigation";
import { studioTemplateCategoryLabel } from "./studio-template-labels";
import styles from "./studio-home-template-carousel.module.css";

type Slide = { id: string; category: string; label: string; title: string; imageUrl?: string; videoUrl?: string; posterUrl?: string; href?: string };
type Translate = (key: string) => string;
let cachedSlides: Slide[] | null = null;

function CarouselVideo({ slide }: { slide: Slide }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !slide.videoUrl) return;
    let visible = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const release = () => { video.pause(); if (video.hasAttribute("src")) { video.removeAttribute("src"); video.load(); } };
    const sync = () => {
      if (!visible || document.hidden || motion.matches) { release(); return; }
      if (!video.hasAttribute("src")) video.src = slide.videoUrl!;
      void video.play().catch(() => undefined);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(video); document.addEventListener("visibilitychange", sync); motion.addEventListener("change", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); motion.removeEventListener("change", sync); release(); };
  }, [slide.videoUrl]);
  return <video ref={ref} data-carousel-video poster={slide.posterUrl?.replace("/width=1080,", "/width=480,")} muted loop playsInline preload="none" aria-hidden="true" />;
}

export default function StudioHomeTemplateCarousel({ translate, locale = "en" }: { translate: Translate; locale?: Locale }) {
  const [slides, setSlides] = useState<Slide[]>(cachedSlides || []);
  const [activeCategory, setActiveCategory] = useState("pet-sing-dance");
  const resolvedActive = slides.findIndex(slide => slide.category === activeCategory);
  const active = resolvedActive >= 0 ? resolvedActive : Math.max(0, slides.findIndex(slide => slide.category === "tiktok"));
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width:767px)").matches);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const appsCopy = studioAppsCopy(locale);
  const slideLabel = (slide: Slide) =>
    slide.category === "pet-sing-dance" ? appsCopy.petAppTitle : studioTemplateCategoryLabel(translate, slide.category);
  useEffect(() => {
    const query = window.matchMedia("(max-width:767px)");
    const sync = () => setMobile(query.matches);
    query.addEventListener("change", sync); sync();
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (cachedSlides) { setSlides(cachedSlides); return; }
    const controller = new AbortController(); setFailed(false);
    fetch("/data/studio-home-template-slides.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Carousel unavailable");
      const value = await response.json() as { version: number; items: Slide[] };
      if (value.version !== 1 || !Array.isArray(value.items) || value.items.length < 7 || !value.items.every(item => item.id && item.label && (item.imageUrl || item.videoUrl))) throw new Error("Invalid carousel");
      if (!controller.signal.aborted) { cachedSlides = value.items; setSlides(value.items); }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [retry]);
  const move = (delta: number) => setActiveCategory(category => {
    const index = Math.max(0, slides.findIndex(slide => slide.category === category));
    return slides[(index + delta + slides.length) % slides.length].category;
  });
  const half = Math.floor(slides.length / 2);
  return <section data-home-template-carousel data-active-category={slides[active]?.category} className={styles.carousel} aria-roledescription="carousel" aria-label={translate("studio.templates.title")} onKeyDown={event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !slides.length) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move((event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1)); }
  }}>
    <div className={styles.stage}>
      {slides.map((slide, index) => {
        const distance = (index - active + slides.length + half) % slides.length - half;
        if (Math.abs(distance) > (mobile ? 1 : 2)) return null;
        const label = slideLabel(slide);
        return <button type="button" key={slide.id} data-carousel-category={slide.category} aria-label={label} aria-pressed={index === active} onClick={() => { if (index === active && slide.href) { navigateStudio(slide.href); return; } setActiveCategory(slide.category); }} className={styles.card} style={{ "--offset": distance, "--scale": 1 - Math.abs(distance) * .12, zIndex: 3 - Math.abs(distance) } as CSSProperties}>
          {slide.videoUrl ? <CarouselVideo slide={slide} /> : <img src={slide.imageUrl?.replace("/width=1080,", "/width=480,")} alt="" loading="lazy" decoding="async" />}
          <span><StudioIcon name={slide.videoUrl ? "video" : "image"} className="h-3.5 w-3.5" />{label}</span>
        </button>;
      })}
      {!slides.length ? <div className={styles.placeholder}>{failed ? <button type="button" onClick={() => setRetry(value => value + 1)}>{translate("studio.templates.retry")}</button> : <span role="status">{translate("studio.templates.loading")}</span>}</div> : null}
    </div>
    {slides.length ? <div className={styles.controls}>
      <div className={styles.dots} role="group" aria-label={translate("studio.templates.title")}>{slides.map((slide, index) => <button type="button" key={slide.id} data-carousel-dot={slide.category} aria-label={slideLabel(slide)} aria-pressed={active === index} onClick={() => setActiveCategory(slide.category)}><span /></button>)}</div>
    </div> : null}
  </section>;
}
