"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
      if (mounted) {
        setEmail(data.user?.email ?? null);
      }
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
      className={`sticky top-4 z-20 mb-10 rounded-2xl border px-5 py-3 transition-all duration-300 ${
        scrolled
          ? "border-black/10 bg-white/92 shadow-xl shadow-black/10 backdrop-blur"
          : "border-black/8 bg-white/78 shadow-lg shadow-black/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            dreamface
          </Link>
          <nav className="hidden gap-6 text-sm text-[#4b4b54] lg:flex">
            <a className={pathname === "/" && active === "products" ? "font-semibold text-[#111]" : ""} href="/#products">Products</a>
            <a className={pathname === "/" && active === "providers" ? "font-semibold text-[#111]" : ""} href="/#providers">Providers</a>
            <Link className={pathname?.startsWith("/gallery") ? "font-semibold text-[#111]" : ""} href="/gallery">Gallery</Link>
            <a className={pathname === "/" && active === "platform" ? "font-semibold text-[#111]" : ""} href="/#platform">Platform</a>
            <a className={pathname === "/" && active === "pricing" ? "font-semibold text-[#111]" : ""} href="/#pricing">Pricing</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email ? (
            <>
              <p className="hidden text-xs text-[#5f6779] md:block">{email}</p>
              <button
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signOut();
                }}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
              >
                Sign out
              </button>
              <Link
                href="/creations"
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
              >
                Creations
              </Link>
              <Link
                href="/billing"
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
              >
                Billing
              </Link>
              <Link
                href="/studio?mode=image"
                className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
              >
                Open Studio
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth?next=%2Fstudio%3Fmode%3Dimage"
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#1d1d1f]"
              >
                Sign in
              </Link>
              <Link
                href="/studio?mode=image"
                className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
              >
                Open Studio
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
