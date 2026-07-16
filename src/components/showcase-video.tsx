"use client";

import { useEffect, useId, useRef, useState } from "react";

type ShowcaseVideoProps = {
  src: string;
  poster: string;
  label: string;
  priority?: boolean;
  className?: string;
};

const playEvent = "dreamface:showcase-video-play";

export function ShowcaseVideo({ src, poster, label, priority = false, className = "" }: ShowcaseVideoProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canLoad, setCanLoad] = useState(priority);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (priority || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setCanLoad(true);
      },
      { rootMargin: "320px 0px" }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !canLoad) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          video.pause();
          return;
        }
        if (!reducedMotion && !saveData && entry.intersectionRatio >= 0.65) {
          void video.play().catch(() => undefined);
        }
      },
      { threshold: [0, 0.65] }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [canLoad]);

  useEffect(() => {
    const pauseOtherVideo = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== id) videoRef.current?.pause();
    };
    window.addEventListener(playEvent, pauseOtherVideo);
    return () => window.removeEventListener(playEvent, pauseOtherVideo);
  }, [id]);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (!canLoad) setCanLoad(true);
    if (video.paused) void video.play().catch(() => setFailed(true));
    else video.pause();
  }

  return (
    <div
      ref={containerRef}
      className={`group relative aspect-video overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#080808] shadow-[0_24px_70px_rgba(0,0,0,0.24)] ${className}`}
    >
      <video
        ref={videoRef}
        src={canLoad ? src : undefined}
        poster={poster}
        muted
        loop
        playsInline
        preload={priority ? "metadata" : "none"}
        aria-label={label}
        onPlay={() => {
          setPlaying(true);
          window.dispatchEvent(new CustomEvent(playEvent, { detail: id }));
        }}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={`${playing ? "Pause" : "Play"} ${label}`}
        className="absolute bottom-4 left-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span aria-hidden="true" className="text-base font-black">{playing ? "II" : "▶"}</span>
      </button>
      {failed ? (
        <p className="absolute inset-x-5 bottom-5 left-20 rounded-xl bg-black/70 px-3 py-2 text-xs font-semibold text-white">
          Video preview is temporarily unavailable.
        </p>
      ) : null}
    </div>
  );
}
