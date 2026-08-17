import type { GalleryItem } from "./gallery";

export const FALLBACK_GALLERY_ITEMS: GalleryItem[] = [
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

export function filterFallbackGalleryItems(category: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return FALLBACK_GALLERY_ITEMS.filter((item) => {
    if (category !== "All" && item.category !== category) return false;
    if (!normalizedQuery) return true;
    return [item.title, item.prompt, item.model, item.category].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}
