"use client";

import Link from "next/link";
import { trackEvent } from "../lib/analytics";

type HomeHeroCarouselProps = {
  images?: string[];
};

const HERO_VIDEO_SRC = "/videos/Dreamface_home_ios.mp4";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function HomeHeroCarousel(_props: HomeHeroCarouselProps) {
  return (
    <section className="relative min-h-[760px] overflow-hidden rounded-[2.5rem] bg-white">
      <div className="pointer-events-none absolute -right-16 top-24 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(189,224,254,0.52),rgba(255,200,221,0.18)_46%,transparent_70%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-44 w-[760px] -translate-x-1/2 rounded-full bg-[#bde0fe]/20 blur-3xl" />

      <div className="relative grid min-h-[760px] items-center gap-10 px-0 py-10 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="max-w-4xl pt-8 lg:pt-20">
          <h1 className="text-[clamp(4rem,7.1vw,8.2rem)] font-black leading-[0.92] tracking-[-0.055em] text-[#2f2f32]">
            Turn your ideas into
            <span className="block text-[#11bff3]">videos in minutes</span>
          </h1>
          <p className="mt-9 max-w-2xl text-xl font-medium leading-8 text-[#3f4148]">
            Go from script, image, presentation, or prompt to finished creative. No cameras, no crew, no editing skills required.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/auth?next=%2Fstudio%3Fview%3Dhome"
              onClick={() => trackEvent("hero_slide_clicked", { slide: "heygen_style_home", target: "/auth", item: "google_signup" })}
              className="inline-flex h-14 items-center gap-3 rounded-md border border-black/10 bg-white px-5 text-base font-semibold text-[#2f2f32] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-lg font-black text-[#4285f4]">G</span>
              Continue with Google
            </Link>
            <Link
              href="/studio?view=home"
              onClick={() => trackEvent("hero_slide_clicked", { slide: "heygen_style_home", target: "/studio?view=home", item: "get_started" })}
              className="inline-flex h-14 items-center gap-3 rounded-xl bg-[#08bdf2] px-7 text-base font-black text-[#08232d] shadow-[0_18px_38px_rgba(8,189,242,0.22)] transition hover:-translate-y-0.5 hover:bg-[#15c8fa]"
            >
              Get Started for Free
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[560px] lg:min-h-[680px]">
          <div className="pointer-events-none absolute left-[10%] top-[8%] h-[540px] w-[540px] rounded-[7rem] bg-[linear-gradient(135deg,rgba(125,255,193,0.35),rgba(56,189,248,0.20),rgba(244,194,255,0.28))] blur-2xl" />
          <div className="absolute left-[8%] top-[11%] h-[560px] w-[560px] rotate-[-16deg] overflow-hidden rounded-[7.2rem] border border-white/70 bg-white/30 shadow-[0_42px_100px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="absolute inset-0 rounded-[7.2rem] bg-[linear-gradient(135deg,rgba(134,239,172,0.42),rgba(125,211,252,0.22),rgba(255,200,221,0.32))]" />
            <div className="absolute inset-[18px] overflow-hidden rounded-[6.3rem] border border-white/70 bg-[#eaf8ff] shadow-[inset_0_0_46px_rgba(255,255,255,0.85)]">
              <video
                src={HERO_VIDEO_SRC}
                className="h-full w-full rotate-[16deg] scale-[1.32] object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/images/gpt_image2.png"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.45),transparent_28%),linear-gradient(180deg,transparent_54%,rgba(255,255,255,0.18))]" />
            </div>
          </div>

          <div className="absolute right-[2%] top-[25%] h-[430px] w-[150px] rotate-[12deg] overflow-hidden rounded-[3rem] border border-white/70 bg-white/40 shadow-[0_30px_70px_rgba(15,23,42,0.16)] backdrop-blur">
            <video
              src={HERO_VIDEO_SRC}
              className="h-full w-full scale-[1.55] object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/images/gpt_image2.png"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
