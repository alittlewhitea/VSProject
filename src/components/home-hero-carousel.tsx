"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  gradient: string;
  accentGradient: string;
  tools: Array<{ label: string; body: string; icon: string; href: string }>;
};

const HERO_VIDEO_SRC = "/videos/Dreamface_home_ios.mp4";

const SLIDES: HeroSlide[] = [
  {
    eyebrow: "DreamFace AI Studio",
    title: "Create campaign assets with",
    accent: "one AI workspace.",
    body: "Generate images, edit references, animate frames, and keep every result organized in Projects.",
    href: "/studio?view=home",
    action: "Explore apps",
    gradient: "from-[#c7eaff] via-[#e8f3ff] to-[#d8f7df]",
    accentGradient: "from-[#0ea5e9] via-[#14b8a6] to-[#22c55e]",
    tools: [
      { label: "Text to Image", body: "Product posters, ads, thumbnails", icon: "TI", href: "/studio?mode=image&workflow=text-to-image" },
      { label: "Image to Image", body: "Reference edits and restyles", icon: "II", href: "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image" },
      { label: "Image to Video", body: "Animate products and portraits", icon: "IV", href: "/studio?mode=video&workflow=image-to-video" }
    ]
  },
  {
    eyebrow: "Model routing",
    title: "GPT Image 2, FLUX, and",
    accent: "Seedance are ready.",
    body: "Pick the job you want to create. DreamFace routes the model, shows credits, and keeps the task running.",
    href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image",
    action: "Try it now",
    gradient: "from-[#d8e7ff] via-[#ece8ff] to-[#f5dcff]",
    accentGradient: "from-[#8b5cf6] via-[#0ea5e9] to-[#06b6d4]",
    tools: [
      { label: "GPT Image 2", body: "Readable typography and layouts", icon: "G2", href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image" },
      { label: "FLUX Schnell", body: "Fast prompt drafts", icon: "FX", href: "/studio?mode=image&workflow=text-to-image&provider=flux-image" },
      { label: "Seedance 2", body: "Short AI video scenes", icon: "S2", href: "/studio?mode=video&workflow=image-to-video" }
    ]
  },
  {
    eyebrow: "Creation projects",
    title: "Every output stays",
    accent: "reusable.",
    body: "Download, copy prompts, retry, use as reference, and inspect credits from a single project workspace.",
    href: "/studio?view=projects",
    action: "Open projects",
    gradient: "from-[#ffe1d5] via-[#f5d8e9] to-[#ecc7ff]",
    accentGradient: "from-[#fb7185] via-[#f97316] to-[#8b5cf6]",
    tools: [
      { label: "Prompt reuse", body: "Copy and remix prior results", icon: "PR", href: "/studio?view=projects" },
      { label: "Refund trail", body: "Charges and failures stay visible", icon: "RT", href: "/studio?view=projects" },
      { label: "Reference flow", body: "Use outputs as new inputs", icon: "RF", href: "/studio?view=projects" }
    ]
  }
];

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

export function HomeHeroCarousel(_props: HomeHeroCarouselProps) {
  const [active, setActive] = useState(0);
  const slide = SLIDES[active];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % SLIDES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  function showPrevious() {
    setActive((current) => (current - 1 + SLIDES.length) % SLIDES.length);
  }

  function showNext() {
    setActive((current) => (current + 1) % SLIDES.length);
  }

  return (
    <section className="relative">
      <div className="overflow-hidden rounded-[2.25rem] border border-black/[0.06] bg-white shadow-[0_32px_90px_rgba(35,51,89,0.14)]">
        <div className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_58%,#f8fbff_100%)] px-5 py-7 sm:px-8 md:px-12 lg:px-16">
          <div className="pointer-events-none absolute left-[12%] top-6 h-72 w-72 rounded-full bg-[#bde0fe]/38 blur-3xl" />
          <div className="pointer-events-none absolute right-[10%] top-4 h-72 w-72 rounded-full bg-[#ffc8dd]/28 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-28 h-44 bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.22),rgba(244,194,255,0.20),transparent)] blur-2xl" />

          <div className={`relative overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-r ${slide.gradient} px-6 py-8 text-center shadow-[0_22px_70px_rgba(45,65,115,0.12)] md:px-12 md:py-9`}>
            <button
              type="button"
              aria-label="Previous hero slide"
              onClick={showPrevious}
              className="absolute left-5 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/78 text-[#667085] shadow-[0_12px_28px_rgba(18,22,33,0.12)] backdrop-blur transition hover:-translate-x-0.5 hover:bg-white hover:text-[#202633]"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next hero slide"
              onClick={showNext}
              className="absolute right-5 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/78 text-[#667085] shadow-[0_12px_28px_rgba(18,22,33,0.12)] backdrop-blur transition hover:translate-x-0.5 hover:bg-white hover:text-[#202633]"
            >
              <ArrowIcon direction="right" />
            </button>

            <div className="relative mx-auto max-w-5xl px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">{slide.eyebrow}</p>
              <h1 className="mx-auto mt-2 max-w-4xl text-4xl font-black leading-tight tracking-tight text-[#202633] md:text-6xl">
                {slide.title}{" "}
                <span className={`bg-gradient-to-r ${slide.accentGradient} bg-clip-text text-transparent`}>{slide.accent}</span>
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-base font-medium leading-7 text-[#5f6b7d] md:text-lg">{slide.body}</p>
              <Link
                href={slide.href}
                onClick={() => trackEvent("hero_slide_clicked", { slide: slide.eyebrow, target: slide.href, index: active })}
                className="mt-6 inline-flex items-center gap-3 rounded-full bg-white/88 px-5 py-3 text-sm font-semibold text-[#202633] shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
              >
                <span className="rounded-full bg-[#111827] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">New</span>
                {slide.action}
                <ArrowIcon direction="right" />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto mt-10 grid max-w-6xl gap-7 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-1">
              {slide.tools.map((tool) => (
                <Link
                  key={tool.label}
                  href={tool.href}
                  onClick={() => trackEvent("hero_slide_clicked", { slide: slide.eyebrow, target: tool.href, item: tool.label, index: active })}
                  className="group rounded-[1.75rem] border border-black/[0.04] bg-[#f8fafc]/76 p-6 text-left shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_28px_70px_rgba(15,23,42,0.09)]"
                >
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-sm font-black text-[#0ea5e9] shadow-sm transition group-hover:scale-105">
                    {tool.icon}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-[#202633]">{tool.label}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#7a8496]">{tool.body}</p>
                </Link>
              ))}
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.18),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(168,85,247,0.14),transparent_38%)] blur-xl" />
              <div className="relative overflow-hidden rounded-[2.25rem] border border-black/[0.06] bg-white p-3 shadow-[0_32px_100px_rgba(35,51,89,0.18)]">
                <div className="overflow-hidden rounded-[1.75rem] bg-[#0f172a]">
                  <video
                    key={HERO_VIDEO_SRC}
                    src={HERO_VIDEO_SRC}
                    className="aspect-[16/10] h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster="/images/gpt_image2.png"
                  />
                </div>
                <div className="absolute left-7 top-7 rounded-full border border-white/30 bg-white/82 px-4 py-2 text-xs font-semibold text-[#202633] shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                  Live studio preview
                </div>
                <div className="absolute bottom-7 left-7 right-7 rounded-[1.35rem] border border-white/30 bg-white/86 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8791a3]">Generation flow</p>
                      <p className="mt-1 text-sm font-semibold text-[#202633]">Prompt, create, save to Projects</p>
                    </div>
                    <span className="rounded-full bg-[#ecfeff] px-3 py-1 text-xs font-semibold text-[#0891b2]">Synced</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e6ebf4]">
                    <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-[#38bdf8] via-[#14b8a6] to-[#8b5cf6]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-2">
            {SLIDES.map((item, index) => (
              <button
                key={`${item.eyebrow}-dot`}
                type="button"
                aria-label={`Show hero slide ${index + 1}`}
                onClick={() => setActive(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === active ? "w-10 bg-[#202633]" : "w-2.5 bg-[#c6ccd8] hover:bg-[#7f8797]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
