"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type ViewportVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "children" | "src" | "autoPlay" | "preload"> & {
  src: string;
  mobileSrc?: string;
  playbackGroup?: string;
  deferUntilIdle?: boolean;
};

type PreviewMember = { video: HTMLVideoElement; visible: { current: boolean } };
const previewGroups = new Map<string, Set<PreviewMember>>();
function syncPreviewGroup(group: Set<PreviewMember>) {
  const active = document.hidden ? undefined : [...group].find(member => member.visible.current && member.video.getAttribute("src"));
  for (const member of group) if (member !== active) member.video.pause();
  if (active) void active.video.play().catch(() => undefined);
}

/** Decorative previews: no media request until visible, pause when off-screen. */
export function ViewportVideo({ src, mobileSrc, playbackGroup, deferUntilIdle = false, ...props }: ViewportVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [readyToFetch, setReadyToFetch] = useState(!deferUntilIdle);

  useEffect(() => {
    if (!deferUntilIdle) {
      setReadyToFetch(true);
      return;
    }
    let timer: number | null = null;
    let idleId: number | null = null;
    const events = ["pointerdown", "touchstart", "scroll", "keydown"] as const;
    const cleanup = () => {
      for (const eventName of events) window.removeEventListener(eventName, activate);
      window.removeEventListener("load", schedule);
      if (timer !== null) window.clearTimeout(timer);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
    const activate = () => {
      cleanup();
      setReadyToFetch(true);
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(activate, { timeout: 1400 });
      } else {
        timer = window.setTimeout(activate, 1000);
      }
    };
    for (const eventName of events) window.addEventListener(eventName, activate, { once: true, passive: true });
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    timer = window.setTimeout(activate, 1800);
    return cleanup;
  }, [deferUntilIdle]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const member = { video, visible };
    let group: Set<PreviewMember> | undefined;
    if (playbackGroup) {
      group = previewGroups.get(playbackGroup) || new Set<PreviewMember>();
      group.add(member);
      previewGroups.set(playbackGroup, group);
    }
    const syncPlayback = () => {
      if (group) {
        syncPreviewGroup(group);
      } else if (visible.current && !document.hidden && video.getAttribute("src")) {
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
      if (group && playbackGroup) {
        group.delete(member);
        if (!group.size) previewGroups.delete(playbackGroup);
        else syncPreviewGroup(group);
      }
    };
  }, [playbackGroup]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !loaded || !readyToFetch) return;
    const media = window.matchMedia("(max-width: 639px)");
    const selectSource = () => {
      const nextSrc = mobileSrc && media.matches ? mobileSrc : src;
      if (video.getAttribute("src") !== nextSrc) {
        video.src = nextSrc;
        video.load();
      }
      if (playbackGroup) {
        const group = previewGroups.get(playbackGroup);
        if (group) syncPreviewGroup(group);
      } else if (visible.current && !document.hidden) void video.play().catch(() => undefined);
    };
    selectSource();
    media.addEventListener("change", selectSource);
    return () => media.removeEventListener("change", selectSource);
  }, [loaded, readyToFetch, src, mobileSrc, playbackGroup]);

  return <video {...props} ref={ref} preload={playbackGroup ? "metadata" : "none"} />;
}
