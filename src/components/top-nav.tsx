"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { defaultLocale, getLocaleFromPathname, localizeMarketingHref, stripLocaleFromPathname } from "../i18n/routing";
import { trackEvent } from "../lib/analytics";
import { createBrowserSupabaseClient } from "../lib/supabase-client";

export function TopNav() {
  const pathname = usePathname();
  const cleanPathname = stripLocaleFromPathname(pathname || "/");
  const locale = getLocaleFromPathname(pathname || "") || defaultLocale;
  const localizedHref = (href: string) => localizeMarketingHref(locale, href);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("platform");
  const [email, setEmail] = useState<string | null>(null);
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);
  const platformCloseTimerRef = useRef<number | null>(null);

  function openPlatformMenu() {
    if (platformCloseTimerRef.current) {
      window.clearTimeout(platformCloseTimerRef.current);
      platformCloseTimerRef.current = null;
    }
    setPlatformMenuOpen(true);
  }

  function schedulePlatformMenuClose() {
    if (platformCloseTimerRef.current) window.clearTimeout(platformCloseTimerRef.current);
    platformCloseTimerRef.current = window.setTimeout(() => {
      setPlatformMenuOpen(false);
      platformCloseTimerRef.current = null;
    }, 180);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (platformCloseTimerRef.current) window.clearTimeout(platformCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (cleanPathname !== "/") return;

    const ids = ["platform", "providers", "pricing"];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0.2, 0.4, 0.65] }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, [cleanPathname]);

  return (
    <header
      className={`sticky top-2 z-20 mb-5 rounded-[1.5rem] border px-3 py-3 transition-all duration-300 sm:top-4 sm:mb-8 sm:rounded-[2rem] sm:px-6 sm:py-4 md:px-8 ${
        scrolled
          ? "border-[#b6c8ff] bg-white/94 shadow-xl shadow-black/10 backdrop-blur"
          : "border-[#a8d8ff] bg-white/86 shadow-lg shadow-black/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3 sm:gap-5">
        <div className="flex min-w-0 items-center gap-5 lg:gap-10">
          <Link href={localizedHref("/")} onClick={() => trackEvent("nav_clicked", { item: "logo", target: "/" })} className="shrink-0 text-xl font-black leading-none tracking-tight sm:text-3xl">
            dreamface
          </Link>
          <span className="hidden h-7 w-px bg-black/12 lg:block" />
          <nav className="hidden gap-7 whitespace-nowrap text-base font-bold text-[#2f2f32] lg:flex">
            <div onMouseEnter={openPlatformMenu} onMouseLeave={schedulePlatformMenuClose}>
              <a
                onClick={() => trackEvent("nav_clicked", { item: "platform", target: "/#platform" })}
                className={`rounded-full px-4 py-2 transition ${platformMenuOpen ? "bg-[#e8f7ff]" : ""} ${cleanPathname === "/" && active === "platform" ? "text-[#111]" : ""}`}
                href={localizedHref("/#platform")}
              >
                Platform
              </a>
              <div
                onMouseEnter={openPlatformMenu}
                onMouseLeave={schedulePlatformMenuClose}
                className={`absolute left-6 right-6 top-full z-50 pt-2 transition duration-150 ${
                  platformMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <div className="overflow-hidden rounded-[2rem] border border-[#08bff1] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.16)]">
                  <div className="grid gap-10 px-8 py-8 xl:grid-cols-[0.8fr_1.2fr]">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#303238]">Products</p>
                      <div className="mt-6 space-y-5 border-t border-[#1dc9ff] pt-5">
                        <Link href="/studio?view=home" className="block rounded-2xl bg-[linear-gradient(120deg,#10bff3,#a3adff_58%,#f29df7)] px-5 py-4 text-white shadow-[0_18px_38px_rgba(16,191,243,0.24)]">
                          <span className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]">Featured</span>
                          <span className="mt-3 block text-xl font-black">Creative AI Toolkit</span>
                          <span className="mt-1 block text-sm font-semibold text-white/86">Open every DreamFace workspace from one hub</span>
                        </Link>
                        {[
                          ["AI Image Studio", "Create images from prompts or reference assets", "/studio?mode=image&workflow=text-to-image"],
                          ["AI Video Studio", "Turn text or images into polished video", "/studio?mode=video&workflow=text-to-video"],
                          ["AI Audio Generator", "Generate ElevenLabs voiceovers from scripts", "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts"],
                          ["Projects", "Manage creations, prompts, refunds, and history", "/studio?view=projects"]
                        ].map(([title, body, href]) => (
                          <Link key={title} href={href} className="block rounded-2xl px-4 py-2 transition hover:bg-[#f3f8ff]">
                            <span className="block text-lg font-black text-[#202124]">{title}</span>
                            <span className="mt-1 block text-sm font-semibold text-[#6b7280]">{body}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#303238]">Create</p>
                      <div className="mt-6 grid gap-x-10 gap-y-5 border-t border-[#1dc9ff] pt-7 md:grid-cols-2">
                        {[
                          ["Text to Image", "Generate polished ads, posters, thumbnails, and concepts", "/studio?mode=image&workflow=text-to-image"],
                          ["Image to Image", "Edit, restyle, or extend reference images", "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image"],
                          ["Image Enhance", "Upscale and clean up owned images", "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image"],
                          ["Background Remove", "Remove backgrounds and export transparent PNG assets", "/studio?mode=image&workflow=background-remove&provider=bria-background-remove"],
                          ["Text to Video", "Turn written scenes into short motion clips", "/studio?mode=video&workflow=text-to-video"],
                          ["Image to Video", "Animate a product, portrait, or reference frame", "/studio?mode=video&workflow=image-to-video"],
                          ["Text to Audio", "Create natural voiceovers from scripts", "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts"]
                        ].map(([title, body, href]) => (
                          <Link key={title} href={href} className="block rounded-2xl px-4 py-3 transition hover:bg-[#f7fbff]">
                            <span className="block text-lg font-black text-[#202124]">{title}</span>
                            <span className="mt-1 block text-sm font-semibold text-[#6b7280]">{body}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Link href={localizedHref("/price")} className="flex items-center justify-between bg-[linear-gradient(90deg,#10bff3,#9cb3ff_58%,#f29df7)] px-8 py-5 text-white">
                    <span>
                      <span className="rounded-full border border-white/40 bg-white/15 px-4 py-1 text-xs font-black uppercase tracking-[0.14em]">Pay as you go</span>
                      <span className="ml-5 text-xl font-black">Credit packs for individuals</span>
                    </span>
                    <span className="text-2xl font-black">-&gt;</span>
                  </Link>
                </div>
              </div>
            </div>
            <a onClick={() => trackEvent("nav_clicked", { item: "providers", target: "/#providers" })} className={cleanPathname === "/" && active === "providers" ? "text-[#111]" : ""} href={localizedHref("/#providers")}>Providers</a>
            <Link onClick={() => trackEvent("nav_clicked", { item: "gallery", target: "/gallery" })} className={pathname?.startsWith("/gallery") ? "text-[#111]" : ""} href="/gallery">Gallery</Link>
            <Link onClick={() => trackEvent("nav_clicked", { item: "pricing", target: "/price" })} className={cleanPathname.startsWith("/price") || cleanPathname.startsWith("/billing") || (cleanPathname === "/" && active === "pricing") ? "text-[#111]" : ""} href={localizedHref("/price")}>Pricing</Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {email ? (
            <>
              <p className="hidden max-w-[180px] truncate text-xs font-semibold text-[#5f6779] xl:block">{email}</p>
              <button
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signOut();
                }}
                className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f] sm:inline-flex"
              >
                Sign out
              </button>
              <Link href="/studio?view=projects" onClick={() => trackEvent("nav_clicked", { item: "projects", target: "/studio?view=projects" })} className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f] md:inline-flex">
                Projects
              </Link>
              <LanguageSwitcher />
              <Link href={localizedHref("/price")} onClick={() => trackEvent("nav_clicked", { item: "pricing", target: "/price" })} className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f] md:inline-flex">
                Pricing
              </Link>
              <Link href="/studio?view=home" onClick={() => trackEvent("nav_clicked", { item: "open_studio", target: "/studio?view=home" })} className="rounded-2xl bg-[#0b0b0d] px-4 py-2.5 text-xs font-black text-white transition-transform duration-150 active:scale-[0.97] sm:px-5 sm:text-sm">
                <span className="sm:hidden">Studio</span>
                <span className="hidden sm:inline">Open Studio</span>
              </Link>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <Link href={localizedHref("/auth?next=%2Fstudio%3Fmode%3Dimage%26workflow%3Dtext-to-image")} onClick={() => trackEvent("nav_clicked", { item: "sign_in", target: "/auth" })} className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f] md:inline-flex">
                Sign in
              </Link>
              <Link href="/studio?view=home" onClick={() => trackEvent("nav_clicked", { item: "open_studio", target: "/studio?view=home" })} className="inline-flex items-center gap-2 rounded-2xl bg-[#0b0b0d] px-4 py-2.5 text-xs font-black text-white transition-transform duration-150 active:scale-[0.97] sm:px-5 sm:text-sm">
                <span className="sm:hidden">Studio</span>
                <span className="hidden sm:inline">Open Studio</span>
                <span aria-hidden="true" className="hidden sm:inline">-&gt;</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
