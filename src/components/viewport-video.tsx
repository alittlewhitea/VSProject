"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type ViewportVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "children" | "src" | "autoPlay" | "preload"> & {
  src: string;
  mobileSrc?: string;
};

/** Decorative previews: no media request until visible, pause when off-screen. */
export function ViewportVideo({ src, mobileSrc, ...props }: ViewportVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const syncPlayback = () => {
      if (visible.current && !document.hidden && video.getAttribute("src")) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) setLoaded(true);
      syncPlayback();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    video.addEventListener("loadeddata", syncPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.removeEventListener("loadeddata", syncPlayback);
      video.pause();
    };
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || !loaded) return;
    const media = window.matchMedia("(max-width: 639px)");
    const selectSource = () => {
      const nextSrc = mobileSrc && media.matches ? mobileSrc : src;
      if (video.getAttribute("src") !== nextSrc) {
        video.src = nextSrc;
        video.load();
      }
      if (visible.current && !document.hidden) void video.play().catch(() => undefined);
    };
    selectSource();
    media.addEventListener("change", selectSource);
    return () => media.removeEventListener("change", selectSource);
  }, [loaded, src, mobileSrc]);

  return <video {...props} ref={ref} preload="none" />;
}
