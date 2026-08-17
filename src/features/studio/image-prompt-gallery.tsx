"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory, type GalleryItem } from "../../lib/gallery";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

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

  const copyPrompt = async (item: GalleryItem) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.prompt);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = item.prompt;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((current) => current === item.id ? null : current), 1600);
      onPromptCopied?.(item);
    } catch {
      setCopiedId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gallery?sort=featured&limit=48")
      .then(async (response) => {
        const payload = (await response.json()) as { items?: GalleryItem[]; storageWarning?: string };
        if (!response.ok || payload.storageWarning) throw new Error(payload.storageWarning || "Gallery unavailable");
        const apiItems = Array.isArray(payload.items) ? payload.items : [];
        if (!cancelled) {
          setItems(apiItems.length ? apiItems : FALLBACK_GALLERY_ITEMS);
          setFailed(!apiItems.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems(FALLBACK_GALLERY_ITEMS);
          setFailed(true);
        }
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
    <section className="mt-4 w-full rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 text-start shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]" aria-label={translate("studio.gallery.eyebrow")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#101828]">{translate("studio.gallery.title")}</h3>
          <p className="mt-1 text-xs text-[#667085]">{translate("studio.projects.copyPrompt")}</p>
        </div>
        <Link href="/gallery" className="inline-flex min-h-11 items-center rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054] transition hover:bg-[#f8f8fb]">
          {translate("studio.gallery.browse")} <span aria-hidden="true">-&gt;</span>
        </Link>
      </div>

      {!loading && categories.length > 1 ? (
        <div className="mt-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1.5">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`min-h-10 rounded-[9px] px-3 text-xs font-bold transition ${
                  activeCategory === category
                    ? "bg-[#f1efff] text-[#6a5af9] shadow-[inset_0_0_0_1px_#d7d1ff]"
                    : "border border-[#eaecf0] bg-white text-[#667085] hover:bg-[#f8f8fb]"
                }`}
              >
                {category}
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
                className={`mb-2.5 break-inside-avoid animate-pulse rounded-xl bg-[#eef0f5] ${index % 3 === 1 ? "h-72" : "h-52"}`}
              />
            ))
          : visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => copyPrompt(item)}
                className="group relative mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-xl border border-[#eaecf0] bg-[#edf2f8] text-start shadow-sm outline-none ring-[#7a6cff] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,24,40,0.14)] focus-visible:ring-2"
                title={translate("studio.projects.copyPrompt")}
              >
                <img
                  src={item.thumbnailUrl || item.imageUrl}
                  alt={item.title}
                  width={item.width || undefined}
                  height={item.height || undefined}
                  loading="lazy"
                  className="h-auto max-h-[520px] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                />
                <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-100 transition md:bg-black/65 md:p-3 md:opacity-0 md:backdrop-blur-[2px] md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                  <span className="hidden line-clamp-4 text-xs font-medium leading-5 text-white/90 md:block">{item.prompt}</span>
                  <span className="mt-2 inline-flex h-8 items-center justify-center rounded-[9px] bg-white px-3 text-xs font-bold text-[#344054] shadow-sm">{copiedId === item.id ? "\u2713 " : ""}{translate("studio.projects.copyPrompt")}</span>
                </span>
              </button>
            ))}
      </div>
    </section>
  );
}
