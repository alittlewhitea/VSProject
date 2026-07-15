"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory, type GalleryItem } from "../../lib/gallery";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

export function ImagePromptGallery({
  translate,
  onUsePrompt
}: {
  translate: Translate;
  onUsePrompt: (item: GalleryItem) => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>("All");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gallery?sort=featured&limit=48")
      .then(async (response) => {
        const payload = (await response.json()) as { items?: GalleryItem[]; storageWarning?: string };
        if (!response.ok || payload.storageWarning) throw new Error(payload.storageWarning || "Gallery unavailable");
        if (!cancelled) setItems(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const available = new Set(items.map((item) => item.category));
    return GALLERY_CATEGORIES.filter((category) => category === "All" || available.has(category));
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => activeCategory === "All" || item.category === activeCategory).slice(0, 12),
    [activeCategory, items]
  );

  if (!loading && !items.length) {
    return failed ? (
      <p className="mt-5 rounded-2xl border border-[#d8b85d]/25 bg-[#fff9e8] px-4 py-3 text-sm font-bold text-[#796525]">
        {translate("studio.status.galleryUnavailable")}
      </p>
    ) : null;
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-[1220px] text-left" aria-label={translate("studio.gallery.eyebrow")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7d8da8]">{translate("studio.gallery.eyebrow")}</p>
          <h3 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#202a42]">{translate("studio.gallery.title")}</h3>
        </div>
        <Link href="/gallery" className="text-sm font-black text-[#1685df] transition hover:text-[#0c65b1]">
          {translate("studio.gallery.browse")} <span aria-hidden="true">-&gt;</span>
        </Link>
      </div>

      {!loading && categories.length > 1 ? (
        <div className="mt-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`h-9 rounded-full px-3.5 text-xs font-black transition ${
                  activeCategory === category
                    ? "bg-[#202a42] text-white shadow-[0_7px_18px_rgba(32,42,66,0.18)]"
                    : "border border-[#758bac]/15 bg-white/75 text-[#68778f] hover:bg-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 columns-2 gap-3 md:columns-3 lg:columns-4">
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={`mb-3 break-inside-avoid animate-pulse rounded-2xl bg-[#eaf0f8] ${index % 3 === 1 ? "h-72" : "h-52"}`}
              />
            ))
          : visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onUsePrompt(item)}
                className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-[#edf2f8] text-left shadow-[0_8px_24px_rgba(42,67,112,0.09)] outline-none ring-[#2099ee] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(42,67,112,0.16)] focus-visible:ring-2"
                title={item.title}
              >
                <img
                  src={item.thumbnailUrl || item.imageUrl}
                  alt={item.title}
                  width={item.width || undefined}
                  height={item.height || undefined}
                  loading="lazy"
                  className="h-auto max-h-[520px] w-full object-cover transition duration-300 group-hover:scale-[1.015]"
                />
                <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/75 via-black/20 to-transparent px-3 pb-3 pt-12 text-xs font-black leading-4 text-white opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                  {item.title}
                </span>
              </button>
            ))}
      </div>
    </section>
  );
}
