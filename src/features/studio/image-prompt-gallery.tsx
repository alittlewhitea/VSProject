"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory, type GalleryItem } from "../../lib/gallery";
import { StudioIcon } from "./studio-navigation";
import { copyStudioText } from "./studio-clipboard";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
const CATEGORY_KEYS: Record<GalleryCategory, string> = {
  All: "all", "Ecommerce Ads": "ecommerce", "Content Creation": "content", "Product Design": "product",
  "Culture & Tourism": "travel", "Games & Film": "film", "Photo Editing": "photo", "Architecture Scenes": "architecture", "Daily Life": "life"
};

const FALLBACK_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "sample-storyboard", title: "Cinematic Storyboard", category: "Games & Film", imageUrl: "/images/seedance-2/seedance-2-storyboard-to-film-poster.webp", thumbnailUrl: null,
    prompt: "A cinematic storyboard coming to life, expressive character movement, dramatic camera angles, warm practical lighting, detailed production design, filmic color grading.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-anime", title: "Anime Character Set", category: "Content Creation", imageUrl: "/images/gemini-omni/gemini-omni-anime-stickers-poster.webp", thumbnailUrl: null,
    prompt: "A polished collection of expressive anime characters, cohesive color palette, crisp line art, playful poses, sticker-ready composition, clean studio background.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-legend", title: "Legendary Rider", category: "Games & Film", imageUrl: "/images/seedance-2/seedance-2-new-legend-ride-poster.webp", thumbnailUrl: null,
    prompt: "An epic lone rider crossing a vast cinematic landscape, golden-hour haze, sweeping scale, dynamic clouds, realistic textures, premium adventure film poster aesthetic.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-world", title: "World in Focus", category: "Culture & Tourism", imageUrl: "/images/gemini-omni/gemini-omni-world-understanding-poster.webp", thumbnailUrl: null,
    prompt: "A richly detailed travel editorial showing human connection with the natural world, authentic documentary photography, layered depth, soft daylight, sophisticated composition.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-roadtrip", title: "Friends Road Trip", category: "Daily Life", imageUrl: "/images/seedance-2/seedance-2-friends-road-trip-poster.webp", thumbnailUrl: null,
    prompt: "A joyful group of friends on a spontaneous road trip, candid laughter, sunlit scenery, natural skin tones, energetic lifestyle photography, cinematic depth of field.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-flash", title: "Future Technology", category: "Product Design", imageUrl: "/images/gemini-omni/gemini-omni-flash-video-generation-poster.webp", thumbnailUrl: null,
    prompt: "A futuristic technology concept presented as a premium product campaign, luminous interface details, deep violet accents, precise studio lighting, clean high-end advertising composition.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-asmr", title: "Sensory Studio", category: "Ecommerce Ads", imageUrl: "/images/gemini-omni/gemini-omni-asmr-storyboard-poster.webp", thumbnailUrl: null,
    prompt: "A tactile ASMR product scene with macro details, soft diffused highlights, satisfying material textures, minimal luxury styling, shallow depth of field, commercial photography.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  },
  {
    id: "sample-discourse", title: "Digital Culture", category: "Content Creation", imageUrl: "/images/seedance-2/seedance-2-ai-discourse-meme-poster.webp", thumbnailUrl: null,
    prompt: "A bold digital-culture editorial collage about AI and modern creativity, layered graphic elements, vibrant contrast, witty visual storytelling, contemporary magazine art direction.", model: "DreamFace", authorName: null, authorHandle: null, sourcePlatform: null, sourceUrl: "", aspectRatio: "16:9", width: null, height: null, isFeatured: true, publishedAt: null, createdAt: null
  }
];

export function ImagePromptGallery({
  translate,
  onPromptCopied
}: {
  translate: Translate;
  onPromptCopied?: (item: GalleryItem) => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>("All");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualPrompt, setManualPrompt] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(() => new Set());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const manualCopyRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => {
    if (manualPrompt !== null) { manualCopyRef.current?.focus(); manualCopyRef.current?.select(); }
  }, [manualPrompt]);

  const copyPrompt = async (item: GalleryItem) => {
    setManualPrompt(null);
    try {
      await copyStudioText(item.prompt);
      if (!mounted.current) return;
      setCopiedId(item.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId((current) => current === item.id ? null : current), 1600);
      onPromptCopied?.(item);
    } catch {
      if (!mounted.current) return;
      setCopiedId(null);
      setManualPrompt(item.prompt);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const collected = new Map<string, GalleryItem>();
    const load = async () => {
      let offset = 0;
      try {
        while (!controller.signal.aborted) {
          const response = await fetch(`/api/gallery?sort=featured&limit=120&offset=${offset}`, { signal: controller.signal });
          const payload = (await response.json()) as { items?: GalleryItem[]; storageWarning?: string; hasMore?: boolean; nextOffset?: number | null };
          if (!response.ok || payload.storageWarning) throw new Error(payload.storageWarning || "Gallery unavailable");
          if (controller.signal.aborted) return;
          const previousCount = collected.size;
          for (const item of Array.isArray(payload.items) ? payload.items : []) collected.set(item.id, item);
          setItems(collected.size ? [...collected.values()] : FALLBACK_GALLERY_ITEMS);
          setLoading(false);
          if (!payload.hasMore) { setFailed(!collected.size); break; }
          // Abort malformed/repeated pagination rather than fetching forever.
          if (collected.size === previousCount || !Number.isSafeInteger(payload.nextOffset) || payload.nextOffset! <= offset) throw new Error("Invalid gallery pagination");
          offset = payload.nextOffset!;
        }
      } catch {
        if (!controller.signal.aborted) {
          // A later page failing must not replace real, already loaded work.
          setItems(collected.size ? [...collected.values()] : FALLBACK_GALLERY_ITEMS);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => {
    const available = new Set(items.map((item) => item.category));
    return GALLERY_CATEGORIES.filter((category) => category === "All" || available.has(category));
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => !brokenImages.has(item.id) && (activeCategory === "All" || item.category === activeCategory)),
    [activeCategory, items, brokenImages]
  );

  if (!loading && !items.length) {
    return failed ? (
      <p className="mt-5 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-warning-soft)] px-4 py-3 text-sm font-bold text-[var(--studio-warning)]">
        {translate("studio.status.galleryUnavailable")}
      </p>
    ) : null;
  }

  return (
    <section data-studio-gallery className="mt-4 w-full rounded-[20px] border border-[var(--studio-border)] bg-[var(--studio-panel)] p-4 text-start shadow-none" aria-label={translate("studio.gallery.eyebrow")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--studio-text)]">{translate("studio.gallery.title")}</h3>
          <p className="mt-1 text-xs text-[var(--studio-muted)]">{translate("studio.projects.copyPrompt")}</p>
        </div>
        <Link href="/gallery" className="inline-flex min-h-11 items-center rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-xs font-bold text-[var(--studio-text)] transition hover:bg-[var(--studio-surface)]">
          {translate("studio.gallery.browse")} <StudioIcon name="chevron-right" className="ms-1 h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
      <span role="status" className="sr-only">{copiedId ? translate("studio.gallery.copyDone") : ""}</span>
      {failed && items.length ? <p role="status" className="mt-3 text-xs text-[var(--studio-muted)]">{translate("studio.status.galleryUnavailable")}</p> : null}
      {manualPrompt !== null ? <div className="mt-4 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
        <p role="alert" className="mb-2 text-sm text-[var(--studio-text)]">{translate("studio.gallery.copyFailed")}</p>
        <textarea ref={manualCopyRef} aria-label={translate("studio.field.prompt")} value={manualPrompt} readOnly dir="auto" rows={4} onFocus={event => event.currentTarget.select()} className="w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-sm text-[var(--studio-text)]" />
      </div> : null}

      {!loading && categories.length > 1 ? (
        <div className="mt-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1.5">
            {categories.map((category) => (
              <button
                key={category}
                data-gallery-category={category}
                aria-pressed={activeCategory === category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`min-h-10 rounded-[9px] px-3 text-xs font-bold transition ${
                  activeCategory === category
                    ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)] shadow-none"
                    : "border border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-surface)]"
                }`}
              >
                {translate(`studio.gallery.category.${CATEGORY_KEYS[category]}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 columns-2 gap-2.5 md:columns-3 lg:columns-4 xl:columns-5">
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={`mb-2.5 break-inside-avoid animate-pulse rounded-xl bg-[var(--studio-surface)] ${index % 3 === 1 ? "h-72" : "h-52"}`}
              />
            ))
          : visibleItems.map((item) => (
              <button
                key={item.id}
                data-gallery-item={item.id}
                type="button"
                onClick={() => copyPrompt(item)}
                className="group relative mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] text-start shadow-sm outline-none ring-[var(--studio-accent-border)] transition hover:-translate-y-0.5 hover:shadow-none focus-visible:ring-2"
                title={item.title}
                aria-label={`${translate(copiedId === item.id ? "studio.gallery.copyDone" : "studio.projects.copyPrompt")}: ${item.title}`}
              >
                <img
                  src={item.thumbnailUrl || item.imageUrl}
                  alt={item.title}
                  width={item.width || undefined}
                  height={item.height || undefined}
                  loading="lazy"
                  onError={(event) => {
                    // A deleted thumbnail need not mean the original is gone.
                    if (item.thumbnailUrl && item.thumbnailUrl !== item.imageUrl && event.currentTarget.getAttribute("src") === item.thumbnailUrl) {
                      event.currentTarget.src = item.imageUrl;
                      return;
                    }
                    setBrokenImages(current => new Set(current).add(item.id));
                  }}
                  className="h-auto max-h-[520px] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                />
                <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-100 transition md:bg-black/65 md:p-3 md:opacity-0 md:backdrop-blur-[2px] md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                  <span className="hidden line-clamp-4 text-xs font-medium leading-5 text-white/90 md:block">{item.prompt}</span>
                  <span className="mt-2 inline-flex min-h-8 items-center justify-center rounded-[9px] bg-[var(--studio-panel)] px-3 py-1 text-xs font-bold text-[var(--studio-text)] shadow-sm">{translate(copiedId === item.id ? "studio.gallery.copyDone" : "studio.projects.copyPrompt")}</span>
                </span>
              </button>
            ))}
      </div>
    </section>
  );
}
