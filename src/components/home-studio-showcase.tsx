"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isRtlLocale, type Locale } from "../i18n/routing";
import { trackEvent } from "../lib/analytics";
import {
  buildHomeShowcaseStudioHref,
  HOME_SHOWCASE_MODES,
  HOME_SHOWCASE_SLIDES,
  homeStudioShowcaseCopy,
  type HomeShowcaseMode,
  type HomeShowcaseSlide
} from "./home-studio-showcase-i18n";
import styles from "./home-studio-showcase.module.css";

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
      <path d="m5 3 8 5-8 5V3Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 rtl:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ActiveShowcaseVideo({ slide, inView }: { slide: HomeShowcaseSlide; inView: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !slide.videoUrl) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const release = () => {
      video.pause();
      if (video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    };

    const sync = () => {
      if (!inView || document.hidden || motion.matches) {
        release();
        return;
      }
      if (video.getAttribute("src") !== slide.videoUrl) {
        video.src = slide.videoUrl!;
      }
      void video.play().catch(() => undefined);
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      release();
    };
  }, [inView, slide.videoUrl]);

  if (!slide.videoUrl) return null;

  return (
    <video
      ref={videoRef}
      poster={slide.posterUrl}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      className={styles.cardVideo}
    />
  );
}

export function HomeStudioShowcase({ locale }: { locale: Locale }) {
  const router = useRouter();
  const copy = homeStudioShowcaseCopy(locale);
  const sectionRef = useRef<HTMLElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);

  const [inView, setInView] = useState(false);
  const [activeIndex, setActiveIndex] = useState(2);
  const [mode, setMode] = useState<HomeShowcaseMode>("video");
  const [prompt, setPrompt] = useState("");
  const [selectedPillId, setSelectedPillId] = useState<string | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { rootMargin: "120px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const total = HOME_SHOWCASE_SLIDES.length;
  const half = Math.floor(total / 2);

  function stepCarousel(delta: number) {
    setActiveIndex((current) => (current + delta + total) % total);
  }

  function handleCardClick(index: number, slide: HomeShowcaseSlide) {
    if (index === activeIndex) {
      trackEvent("home_showcase_card_clicked", { slide: slide.key, target: slide.href });
      router.push(slide.href);
      return;
    }
    setActiveIndex(index);
  }

  function handleSubmit() {
    const href = buildHomeShowcaseStudioHref(mode, prompt);
    trackEvent("home_showcase_prompt_submitted", {
      mode,
      has_prompt: Boolean(prompt.trim()),
      pill: selectedPillId || "custom"
    });
    router.push(href);
  }

  return (
    <section
      ref={sectionRef}
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      data-home-studio-showcase
      className={`mt-10 md:mt-16 ${styles.section}`}
      aria-labelledby="home-studio-showcase-title"
    >
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          <span aria-hidden="true">✦</span>
          {copy.eyebrow}
        </span>
        <h2 id="home-studio-showcase-title" className={styles.title}>
          {copy.titlePrefix} <span className={styles.titleAccent}>{copy.titleAccent}</span>
        </h2>
        <p className={styles.subtitle}>{copy.subtitle}</p>
      </div>

      <div
        className={styles.stage}
        role="region"
        aria-roledescription="carousel"
        aria-label={copy.carouselAriaLabel}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const rtl = isRtlLocale(locale);
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            stepCarousel((event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1));
          }
        }}
        onTouchStart={(event) => {
          swipeStartXRef.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = swipeStartXRef.current;
          swipeStartXRef.current = null;
          const endX = event.changedTouches[0]?.clientX;
          if (startX === null || typeof endX !== "number") return;
          const deltaX = endX - startX;
          if (Math.abs(deltaX) < 36) return;
          const rtl = isRtlLocale(locale);
          stepCarousel((deltaX < 0 ? 1 : -1) * (rtl ? -1 : 1));
        }}
      >
        {HOME_SHOWCASE_SLIDES.map((slide, index) => {
          const offset = ((index - activeIndex + total + half) % total) - half;
          const isActive = offset === 0;
          const slideLabel = copy.slides[slide.key];
          return (
            <button
              key={slide.id}
              type="button"
              data-showcase-slide={slide.key}
              data-offset={offset}
              aria-label={slideLabel}
              aria-pressed={isActive}
              className={styles.card}
              onClick={() => handleCardClick(index, slide)}
            >
              <img
                src={slide.posterUrl}
                alt=""
                width={480}
                height={720}
                loading="lazy"
                decoding="async"
                className={styles.cardMedia}
              />
              {isActive && slide.videoUrl ? <ActiveShowcaseVideo slide={slide} inView={inView} /> : null}
              {slide.hot ? <span className={styles.hotBadge}>{copy.hotBadge}</span> : null}
              {slide.videoUrl ? (
                <span className={styles.playBadge} aria-hidden="true">
                  <PlayIcon />
                </span>
              ) : null}
              <span className={styles.cardFooter}>
                <span>{slideLabel}</span>
                <span className={styles.ctaChip}>
                  {slide.hot ? copy.cardTry : copy.cardOpen}
                  <span aria-hidden="true">→</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.dots} role="group" aria-label={copy.carouselAriaLabel}>
        {HOME_SHOWCASE_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={styles.dot}
            aria-label={copy.slides[slide.key]}
            aria-pressed={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>

      <div className={styles.composer}>
        <label htmlFor="home-showcase-prompt" className="sr-only">
          {copy.promptAriaLabel}
        </label>
        <textarea
          id="home-showcase-prompt"
          dir="auto"
          rows={2}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setSelectedPillId(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={copy.placeholders[mode]}
          className={styles.textarea}
        />

        <div className={styles.pills}>
          {copy.pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={styles.pill}
              aria-pressed={selectedPillId === pill.id}
              onClick={() => {
                setSelectedPillId(pill.id);
                setMode(pill.mode);
                setPrompt(pill.prompt);
              }}
            >
              <span aria-hidden="true">{pill.emoji}</span>
              <span>{pill.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.bar}>
          <div className={styles.modes} role="group" aria-label={copy.modeGroupAriaLabel}>
            {HOME_SHOWCASE_MODES.map((item) => (
              <button
                key={item}
                type="button"
                className={styles.modeBtn}
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
              >
                {copy.modes[item]}
              </button>
            ))}
          </div>

          <button type="button" data-home-showcase-submit className={styles.submitBtn} onClick={handleSubmit}>
            <span>{copy.submitLabel}</span>
            <ArrowIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
