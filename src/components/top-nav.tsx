"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { trackEvent } from "../lib/analytics";
import { createBrowserSupabaseClient } from "../lib/supabase-client";

export function TopNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("products");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
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
    if (pathname !== "/") return;

    const ids = ["products", "providers", "platform", "pricing"];
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
  }, [pathname]);

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
          <Link href="/" onClick={() => trackEvent("nav_clicked", { item: "logo", target: "/" })} className="shrink-0 text-xl font-black leading-none tracking-tight sm:text-3xl">
            dreamface
          </Link>
          <span className="hidden h-7 w-px bg-black/12 lg:block" />
          <nav className="hidden gap-7 whitespace-nowrap text-base font-bold text-[#2f2f32] lg:flex">
            <a onClick={() => trackEvent("nav_clicked", { item: "products", target: "/#products" })} className={pathname === "/" && active === "products" ? "text-[#111]" : ""} href="/#products">Products</a>
            <a onClick={() => trackEvent("nav_clicked", { item: "providers", target: "/#providers" })} className={pathname === "/" && active === "providers" ? "text-[#111]" : ""} href="/#providers">Providers</a>
            <Link onClick={() => trackEvent("nav_clicked", { item: "gallery", target: "/gallery" })} className={pathname?.startsWith("/gallery") ? "text-[#111]" : ""} href="/gallery">Gallery</Link>
            <a onClick={() => trackEvent("nav_clicked", { item: "platform", target: "/#platform" })} className={pathname === "/" && active === "platform" ? "text-[#111]" : ""} href="/#platform">Platform</a>
            <Link onClick={() => trackEvent("nav_clicked", { item: "pricing", target: "/price" })} className={pathname?.startsWith("/price") || pathname?.startsWith("/billing") || (pathname === "/" && active === "pricing") ? "text-[#111]" : ""} href="/price">Pricing</Link>
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
              <Link href="/price" onClick={() => trackEvent("nav_clicked", { item: "pricing", target: "/price" })} className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f] md:inline-flex">
                Pricing
              </Link>
              <Link href="/studio?view=home" onClick={() => trackEvent("nav_clicked", { item: "open_studio", target: "/studio?view=home" })} className="rounded-2xl bg-[#0b0b0d] px-4 py-2.5 text-xs font-black text-white transition-transform duration-150 active:scale-[0.97] sm:px-5 sm:text-sm">
                <span className="sm:hidden">Studio</span>
                <span className="hidden sm:inline">Open Studio</span>
              </Link>
            </>
          ) : (
            <>
              <span className="hidden items-center gap-2 text-sm font-black text-[#073b3a] md:inline-flex">
                <span aria-hidden="true">EN</span>
              </span>
              <Link href="/auth?next=%2Fstudio%3Fmode%3Dimage%26workflow%3Dtext-to-image" onClick={() => trackEvent("nav_clicked", { item: "sign_in", target: "/auth" })} className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f] md:inline-flex">
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
