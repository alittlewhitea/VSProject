"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "../lib/analytics";

type HomeHeroCarouselProps = {
  images?: string[];
};

type HeroSlide = {
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  href: string;
  action: string;
  mode: "image" | "video";
  chips: string[];
  stats: Array<{ label: string; value: string }>;
  metrics: Array<{ label: string; value: number; suffix?: string; note: string }>;
};

const SLIDES: HeroSlide[] = [
  {
    eyebrow: "AI Image Studio",
    title: "Generate campaign-ready visuals",
    accent: "from one prompt.",
    body: "Create text-to-image and image-to-image assets with routed model controls, visible credits, and a clean creation history.",
    href: "/studio?mode=image&workflow=text-to-image",
    action: "Start image generation",
    mode: "image",
    chips: ["GPT Image 2", "Nano Banana 2", "FLUX Schnell"],
    stats: [
      { label: "Workflow", value: "Text + Reference" },
      { label: "Canvas", value: "1:1 / 16:9 / 4:3" },
      { label: "Output", value: "Download ready" }
    ],
    metrics: [
      { label: "Image models", value: 3, note: "routed for prompt and reference workflows" },
      { label: "Free credits", value: 120, note: "included for new accounts" },
      { label: "Output sizes", value: 6, suffix: "+", note: "preset canvases for campaign formats" }
    ]
  },
  {
    eyebrow: "AI Video Studio",
    title: "Turn scenes into motion",
    accent: "without losing control.",
    body: "Queue text-to-video jobs, keep provider status visible, and return to a persistent workspace when the render finishes.",
    href: "/studio?mode=video&workflow=text-to-video",
    action: "Start video generation",
    mode: "video",
    chips: ["Seedance 2.0", "Kling", "Grok Imagine"],
    stats: [
      { label: "Duration", value: "6s / 8s / 10s" },
      { label: "Status", value: "Background queue" },
      { label: "Fallback", value: "Model routing" }
    ],
    metrics: [
      { label: "Video models", value: 4, note: "Seedance, Kling, Veo, and Grok routes" },
      { label: "Queue checks", value: 40, note: "status polling while jobs render" },
      { label: "Durations", value: 3, note: "short-form video presets" }
    ]
  },
  {
    eyebrow: "Creation Asset Hub",
    title: "Keep every result reusable",
    accent: "after generation.",
    body: "Inspect prompt, model parameters, charge ledger, refund status, downloads, retries, and reference reuse from one detail page.",
    href: "/creations",
    action: "Open creations",
    mode: "image",
    chips: ["Prompt copy", "Refund log", "Use as reference"],
    stats: [
      { label: "Ledger", value: "Charge + refund" },
      { label: "Reuse", value: "Prompt + output" },
      { label: "Library", value: "Favorites" }
    ],
    metrics: [
      { label: "Task trail", value: 100, suffix: "%", note: "prompt, model, charge, and refund visibility" },
      { label: "Detail views", value: 1, note: "one page for every generated asset" },
      { label: "Reuse paths", value: 3, note: "copy prompt, retry, or use as reference" }
    ]
  }
];

export function HomeHeroCarousel(_props: HomeHeroCarouselProps) {
  const [active, setActive] = useState(0);
  const [metricProgress, setMetricProgress] = useState(0);
  const slide = SLIDES[active];
  const networkNodes = useMemo(() => Array.from({ length: 9 }, (_, index) => index), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % SLIDES.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMetricProgress(0);
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      setMetricProgress(Math.min(1, frame / 28));
      if (frame >= 28) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [active]);

  function showPrevious() {
    setActive((current) => (current - 1 + SLIDES.length) % SLIDES.length);
  }

  function showNext() {
    setActive((current) => (current + 1) % SLIDES.length);
  }

  function animatedMetric(value: number) {
    return Math.round(value * metricProgress).toLocaleString();
  }

  return (
    <section className="relative">
      <div className="overflow-hidden rounded-[2.25rem] border border-black/5 bg-white shadow-[0_32px_90px_rgba(35,51,89,0.16)]">
        <div className="relative min-h-[620px] overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#f5f8ff_42%,#f3fffb_100%)] px-5 py-8 sm:px-8 md:px-12 lg:min-h-[680px] lg:px-16">
          <div className="absolute inset-0 opacity-75">
            <div className="absolute left-[8%] top-[10%] h-56 w-56 rounded-full bg-[#dbe9ff] blur-3xl" />
            <div className="absolute right-[8%] top-[8%] h-64 w-64 rounded-full bg-[#d7fbf4] blur-3xl" />
            <div className="absolute bottom-[5%] left-[42%] h-60 w-60 rounded-full bg-[#efe7ff] blur-3xl" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.045)_1px,transparent_1px)] bg-[size:42px_42px] opacity-60" />

          <div className="relative grid min-h-[560px] gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full border border-black/10 bg-white/80 p-1.5 shadow-[0_12px_30px_rgba(23,35,61,0.08)] backdrop-blur">
                {SLIDES.map((item, index) => (
                  <button
                    key={item.eyebrow}
                    type="button"
                    onClick={() => setActive(index)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      index === active ? "bg-[#1d1d1f] text-white" : "text-[#5f6c82] hover:bg-[#f3f7ff]"
                    }`}
                  >
                    {item.mode === "image" ? "Image" : "Video"}
                  </button>
                ))}
              </div>

              <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[#657187]">{slide.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.96] tracking-tight text-[#101827] sm:text-6xl md:text-7xl">
                {slide.title}
                <span className="block bg-gradient-to-r from-[#1a6df0] via-[#14a99a] to-[#7f5ce6] bg-clip-text text-transparent">
                  {slide.accent}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#53627b] sm:text-lg">{slide.body}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={slide.href}
                  onClick={() => trackEvent("hero_slide_clicked", { slide: slide.eyebrow, target: slide.href, index: active })}
                  className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/15 transition-transform duration-150 active:scale-[0.98]"
                >
                  {slide.action}
                </Link>
                <Link
                  href="/gallery"
                  onClick={() => trackEvent("hero_slide_clicked", { slide: slide.eyebrow, target: "/gallery", index: active })}
                  className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1f] shadow-sm transition-transform duration-150 active:scale-[0.98]"
                >
                  Explore prompts
                </Link>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {slide.stats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-black/10 bg-white/72 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#667084]">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-[#172033]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[540px]">
              <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-[720px] rounded-[2rem] border border-white/80 bg-white/82 p-5 shadow-[0_28px_70px_rgba(23,35,61,0.16)] backdrop-blur-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#657187]">Trust console</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">{slide.eyebrow}</h2>
                  </div>
                  <div className="rounded-full border border-[#bfe8df] bg-[#effbf8] px-3 py-1 text-xs font-semibold text-[#137a70]">
                    Live ready
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {slide.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#657187]">{metric.label}</p>
                      <p className="mt-3 text-4xl font-semibold tracking-tight text-[#111827]">
                        {animatedMetric(metric.value)}
                        {metric.suffix || ""}
                      </p>
                      <p className="mt-2 min-h-[40px] text-xs leading-5 text-[#667084]">{metric.note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl border border-black/10 bg-[#f7faff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#657187]">Model routing</p>
                    <div className="relative mt-5 aspect-square">
                      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-white shadow-[0_18px_40px_rgba(23,35,61,0.12)]" />
                      <div className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1d1d1f] text-center text-xs font-semibold uppercase tracking-[0.1em] text-white">
                        Dream
                      </div>
                      {networkNodes.map((node) => {
                        const angle = (node / networkNodes.length) * Math.PI * 2;
                        const x = 50 + Math.cos(angle) * 39;
                        const y = 50 + Math.sin(angle) * 39;
                        return (
                          <div
                            key={`${slide.eyebrow}-node-${node}`}
                            className={`absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-white bg-white text-xs font-semibold shadow-[0_10px_24px_rgba(23,35,61,0.12)] ${
                              node % 3 === 0 ? "text-[#1a6df0]" : node % 3 === 1 ? "text-[#13877e]" : "text-[#7657d9]"
                            }`}
                            style={{ left: `${x}%`, top: `${y}%` }}
                          >
                            {node + 1}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#657187]">Selected stack</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slide.chips.map((chip) => (
                          <span key={chip} className="rounded-full border border-black/10 bg-[#f7f9fc] px-3 py-1.5 text-xs font-semibold text-[#39445a]">
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#657187]">Generation health</p>
                        <span className="text-xs font-semibold text-[#137a70]">Synced</span>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf1f7]">
                        <div
                          key={slide.eyebrow}
                          className="h-full rounded-full bg-gradient-to-r from-[#3e82f6] via-[#19b4a5] to-[#8b6fe8] transition-all duration-700"
                          style={{ width: active === 0 ? "82%" : active === 1 ? "68%" : "92%" }}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          { label: "Queued", value: active === 1 ? "04" : "02" },
                          { label: "Running", value: active === 2 ? "03" : "08" },
                          { label: "Done", value: active === 0 ? "18" : "24" }
                        ].map((item) => (
                          <div key={item.label} className="rounded-xl bg-[#f7f9fc] p-3 text-center">
                            <p className="text-[11px] text-[#667084]">{item.label}</p>
                            <p className="mt-1 text-lg font-semibold text-[#111827]">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#d8e8ff] bg-[#f3f8ff] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4770a6]">Trust layer</p>
                      <p className="mt-2 text-sm leading-6 text-[#44546a]">
                        Every output keeps prompt, settings, billing ledger, retry path, and download state attached.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Previous hero slide"
            onClick={showPrevious}
            className="absolute left-5 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-xl font-semibold text-[#1d1d1f] shadow-[0_12px_28px_rgba(18,22,33,0.14)] transition hover:scale-105 lg:flex"
          >
            &lt;
          </button>
          <button
            type="button"
            aria-label="Next hero slide"
            onClick={showNext}
            className="absolute right-5 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-xl font-semibold text-[#1d1d1f] shadow-[0_12px_28px_rgba(18,22,33,0.14)] transition hover:scale-105 lg:flex"
          >
            &gt;
          </button>

          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full border border-black/10 bg-white/88 px-4 py-2.5 shadow-[0_12px_28px_rgba(18,22,33,0.14)] backdrop-blur">
            {SLIDES.map((item, index) => (
              <button
                key={`${item.eyebrow}-dot`}
                type="button"
                aria-label={`Show hero slide ${index + 1}`}
                onClick={() => setActive(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === active ? "w-10 bg-[#1d1d1f]" : "w-2.5 bg-[#c6ccd8] hover:bg-[#7f8797]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
