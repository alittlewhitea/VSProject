"use client";

import Link from "next/link";
import { trackEvent } from "../lib/analytics";

type HomeHeroCarouselProps = {
  images?: string[];
};

const HERO_VIDEO_SRC = "https://media.dreamface.io/videos/Dreamface_home_ios.mp4";

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
    <section className="relative overflow-hidden rounded-[1.75rem] bg-white sm:rounded-[2.5rem] lg:min-h-[760px]">
      <div className="pointer-events-none absolute -right-24 top-24 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(189,224,254,0.52),rgba(255,200,221,0.18)_46%,transparent_70%)] blur-2xl sm:h-[620px] sm:w-[620px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-[420px] -translate-x-1/2 rounded-full bg-[#bde0fe]/20 blur-3xl sm:h-44 sm:w-[760px]" />

      <div className="relative grid items-center gap-7 px-4 py-8 sm:px-6 sm:py-10 lg:min-h-[760px] lg:grid-cols-[0.94fr_1.06fr] lg:px-0">
        <div className="max-w-4xl pt-3 sm:pt-8 lg:pt-20">
          <h1 className="text-[clamp(3.35rem,15vw,5.8rem)] font-black leading-[0.92] tracking-[-0.055em] text-[#2f2f32] lg:text-[clamp(4rem,7.1vw,8.2rem)]">
            Turn your ideas into
            <span className="block text-[#11bff3]">videos in minutes</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[#3f4148] sm:mt-9 sm:text-xl sm:leading-8">
            Go from script, image, presentation, or prompt to finished creative. No cameras, no crew, no editing skills required.
          </p>

          <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <Link
              href="/auth?next=%2Fstudio%3Fview%3Dhome"
              onClick={() => trackEvent("hero_slide_clicked", { slide: "heygen_style_home", target: "/auth", item: "google_signup" })}
              className="inline-flex h-[52px] items-center justify-center gap-3 rounded-md border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-[#2f2f32] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-14 sm:justify-start sm:text-base"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-lg font-black text-[#4285f4]">G</span>
              Continue with Google
            </Link>
            <Link
              href="/studio?view=home"
              onClick={() => trackEvent("hero_slide_clicked", { slide: "heygen_style_home", target: "/studio?view=home", item: "get_started" })}
              className="inline-flex h-[52px] items-center justify-center gap-3 rounded-xl bg-[#08bdf2] px-7 py-3 text-sm font-black text-[#08232d] shadow-[0_18px_38px_rgba(8,189,242,0.22)] transition hover:-translate-y-0.5 hover:bg-[#15c8fa] sm:h-14 sm:justify-start sm:text-base"
            >
              Get Started for Free
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[360px] sm:min-h-[520px] lg:min-h-[680px]">
          <div className="pointer-events-none absolute left-[8%] top-[8%] h-[330px] w-[330px] rounded-[4.5rem] bg-[linear-gradient(135deg,rgba(125,255,193,0.35),rgba(56,189,248,0.20),rgba(244,194,255,0.28))] blur-2xl sm:h-[540px] sm:w-[540px] sm:rounded-[7rem]" />
          <div className="absolute left-[8%] top-[9%] h-[330px] w-[330px] rotate-[-16deg] overflow-hidden rounded-[4.5rem] border border-white/70 bg-white/30 shadow-[0_32px_70px_rgba(15,23,42,0.16)] backdrop-blur sm:top-[11%] sm:h-[520px] sm:w-[520px] sm:rounded-[7.2rem] lg:h-[560px] lg:w-[560px]">
            <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(134,239,172,0.42),rgba(125,211,252,0.22),rgba(255,200,221,0.32))]" />
            <div className="absolute inset-[12px] overflow-hidden rounded-[3.95rem] border border-white/70 bg-[#eaf8ff] shadow-[inset_0_0_46px_rgba(255,255,255,0.85)] sm:inset-[18px] sm:rounded-[6.3rem]">
              <video
                src={HERO_VIDEO_SRC}
                className="h-full w-full rotate-[16deg] scale-[1.32] object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.45),transparent_28%),linear-gradient(180deg,transparent_54%,rgba(255,255,255,0.18))]" />
            </div>
          </div>

          <div className="absolute right-[1%] top-[26%] h-[250px] w-[88px] rotate-[12deg] overflow-hidden rounded-[2rem] border border-white/70 bg-white/40 shadow-[0_24px_52px_rgba(15,23,42,0.14)] backdrop-blur sm:h-[390px] sm:w-[136px] sm:rounded-[3rem] lg:h-[430px] lg:w-[150px]">
            <video
              src={HERO_VIDEO_SRC}
              className="h-full w-full scale-[1.55] object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
