export const GALLERY_CATEGORIES = [
  "All",
  "Ecommerce Ads",
  "Content Creation",
  "Product Design",
  "Culture & Tourism",
  "Games & Film",
  "Photo Editing",
  "Architecture Scenes",
  "Daily Life"
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];
export type PublicGalleryCategory = Exclude<GalleryCategory, "All">;

const DB_CATEGORY_BY_PUBLIC: Record<PublicGalleryCategory, string> = {
  "Ecommerce Ads": "电商广告",
  "Content Creation": "内容创作",
  "Product Design": "产品设计",
  "Culture & Tourism": "文旅文创",
  "Games & Film": "游戏影视",
  "Photo Editing": "摄影后期",
  "Architecture Scenes": "建筑场景",
  "Daily Life": "生活日常"
};

const PUBLIC_CATEGORY_BY_DB = Object.fromEntries(
  Object.entries(DB_CATEGORY_BY_PUBLIC).map(([publicCategory, dbCategory]) => [dbCategory, publicCategory])
) as Record<string, PublicGalleryCategory>;

export type GalleryItem = {
  id: string;
  title: string;
  category: PublicGalleryCategory;
  imageUrl: string;
  thumbnailUrl: string | null;
  prompt: string;
  model: string;
  authorName: string | null;
  authorHandle: string | null;
  sourcePlatform: string | null;
  sourceUrl: string;
  aspectRatio: string | null;
  width: number | null;
  height: number | null;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string | null;
};

export type GalleryRow = {
  id: string;
  title: string;
  category: string;
  image_url: string;
  thumbnail_url: string | null;
  prompt: string;
  model: string;
  author_name: string | null;
  author_handle: string | null;
  source_platform: string | null;
  source_url: string;
  aspect_ratio: string | null;
  width: number | null;
  height: number | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string | null;
};

export function isGalleryCategory(value: string): value is GalleryCategory {
  return GALLERY_CATEGORIES.includes(value as GalleryCategory);
}

export function toDbGalleryCategory(category: string) {
  if (category === "All") return null;
  return DB_CATEGORY_BY_PUBLIC[category as PublicGalleryCategory] || category;
}

export function toPublicGalleryCategory(category: string): PublicGalleryCategory {
  return PUBLIC_CATEGORY_BY_DB[category] || (category as PublicGalleryCategory);
}

export function slugifyGalleryTitle(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "prompt";
}

export function galleryItemPath(item: Pick<GalleryItem, "id" | "title">) {
  return `/gallery/${item.id}-${slugifyGalleryTitle(item.title)}`;
}

export function extractGalleryId(value: string) {
  return (
    value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ||
    value
  );
}

export function mapGalleryRow(row: GalleryRow): GalleryItem {
  return {
    id: row.id,
    title: row.title,
    category: toPublicGalleryCategory(row.category),
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    prompt: row.prompt,
    model: row.model,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    sourcePlatform: row.source_platform,
    sourceUrl: row.source_url,
    aspectRatio: row.aspect_ratio,
    width: row.width,
    height: row.height,
    isFeatured: row.is_featured,
    publishedAt: row.published_at,
    createdAt: row.created_at
  };
}
