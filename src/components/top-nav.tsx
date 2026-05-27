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
      className={`sticky top-4 z-20 mb-8 rounded-[2rem] border px-6 py-4 transition-all duration-300 md:px-8 ${
        scrolled
          ? "border-[#b6c8ff] bg-white/94 shadow-xl shadow-black/10 backdrop-blur"
          : "border-[#a8d8ff] bg-white/86 shadow-lg shadow-black/5"
      }`}
    >
      <div className="flex items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-8 lg:gap-10">
          <Link href="/" onClick={() => trackEvent("nav_clicked", { item: "logo", target: "/" })} className="shrink-0 text-2xl font-black leading-none tracking-tight sm:text-3xl">
            dreamface
          </Link>
          <span className="hidden h-7 w-px bg-black/12 lg:block" />
          <nav className="hidden gap-7 whitespace-nowrap text-base font-bold text-[#2f2f32] lg:flex">
            <a onClick={() => trackEvent("nav_clicked", { item: "products", target: "/#products" })} className={pathname === "/" && active === "products" ? "text-[#111]" : ""} href="/#products">Products</a>
            <a onClick={() => trackEvent("nav_clicked", { item: "providers", target: "/#providers" })} className={pathname === "/" && active === "providers" ? "text-[#111]" : ""} href="/#providers">Providers</a>
            <Link onClick={() => trackEvent("nav_clicked", { item: "gallery", target: "/gallery" })} className={pathname?.startsWith("/gallery") ? "text-[#111]" : ""} href="/gallery">Gallery</Link>
            <a onClick={() => trackEvent("nav_clicked", { item: "platform", target: "/#platform" })} className={pathname === "/" && active === "platform" ? "text-[#111]" : ""} href="/#platform">Platform</a>
            <a onClick={() => trackEvent("nav_clicked", { item: "pricing", target: "/#pricing" })} className={pathname === "/" && active === "pricing" ? "text-[#111]" : ""} href="/#pricing">Pricing</a>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {email ? (
            <>
              <p className="hidden max-w-[180px] truncate text-xs font-semibold text-[#5f6779] xl:block">{email}</p>
              <button
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signOut();
                }}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f]"
              >
                Sign out
              </button>
              <Link href="/studio?view=projects" onClick={() => trackEvent("nav_clicked", { item: "projects", target: "/studio?view=projects" })} className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f]">
                Projects
              </Link>
              <Link href="/billing" onClick={() => trackEvent("nav_clicked", { item: "billing", target: "/billing" })} className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#1d1d1f]">
                Billing
              </Link>
              <Link href="/studio?mode=image&workflow=text-to-image" onClick={() => trackEvent("nav_clicked", { item: "open_studio", target: "/studio?mode=image&workflow=text-to-image" })} className="rounded-2xl bg-[#0b0b0d] px-5 py-2.5 text-sm font-black text-white transition-transform duration-150 active:scale-[0.97]">
                Open Studio
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
              <Link href="/auth?next=%2Fstudio%3Fmode%3Dimage%26workflow%3Dtext-to-image" onClick={() => trackEvent("nav_clicked", { item: "sign_in", target: "/auth" })} className="inline-flex items-center gap-2 rounded-2xl bg-[#0b0b0d] px-5 py-2.5 text-sm font-black text-white transition-transform duration-150 active:scale-[0.97]">
                Open Studio
                <span aria-hidden="true">-&gt;</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
