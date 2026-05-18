"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomeHeroCarouselProps = {
  images: string[];
};

export function HomeHeroCarousel({ images }: HomeHeroCarouselProps) {
  const slides = images.length ? images : ["/images/Seedance2.0.png"];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  function hrefForSlide(src: string) {
    const normalized = src.toLowerCase();
    if (normalized.includes("video") || normalized.includes("seedance") || normalized.includes("kling") || normalized.includes("veo")) {
      return "/studio?mode=video";
    }
    return "/studio?mode=image";
  }

  function showPrevious() {
    setActive((current) => (current - 1 + slides.length) % slides.length);
  }

  function showNext() {
    setActive((current) => (current + 1) % slides.length);
  }

  return (
    <section className="relative">
      <div className="overflow-hidden rounded-[2.25rem] border border-black/5 bg-white shadow-[0_32px_90px_rgba(35,51,89,0.16)]">
        <div className="relative aspect-[16/7.6] min-h-[420px] w-full overflow-hidden sm:min-h-[500px] lg:min-h-[640px]">
        {slides.map((src, index) => (
          <Link
            key={src}
            href={hrefForSlide(src)}
            aria-label={`Open ${hrefForSlide(src).includes("video") ? "video" : "image"} studio`}
            className={`absolute inset-0 block transition-opacity duration-700 ${
              index === active ? "opacity-100" : "opacity-0"
            }`}
            tabIndex={index === active ? 0 : -1}
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </Link>
        ))}

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous hero slide"
              onClick={showPrevious}
              className="absolute left-0 top-1/2 z-10 hidden h-12 w-12 -translate-x-[calc(100%+1rem)] -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-2xl font-semibold text-[#1d1d1f] shadow-[0_12px_28px_rgba(18,22,33,0.14)] transition hover:scale-105 lg:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next hero slide"
              onClick={showNext}
              className="absolute right-0 top-1/2 z-10 hidden h-12 w-12 translate-x-[calc(100%+1rem)] -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-2xl font-semibold text-[#1d1d1f] shadow-[0_12px_28px_rgba(18,22,33,0.14)] transition hover:scale-105 lg:flex"
            >
              ›
            </button>
            <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full border border-black/10 bg-white/88 px-4 py-2.5 shadow-[0_12px_28px_rgba(18,22,33,0.14)] backdrop-blur">
              {slides.map((src, index) => (
                <button
                  key={`${src}-dot`}
                  type="button"
                  aria-label={`Show hero slide ${index + 1}`}
                  onClick={() => setActive(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === active ? "w-10 bg-[#1d1d1f]" : "w-2.5 bg-[#c6ccd8] hover:bg-[#7f8797]"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
        </div>
      </div>
    </section>
  );
}
