import { type GalleryRow } from "./gallery";
import { getPublishedGalleryRow, listPublishedGalleryRows } from "./gallery-db";
import { unstable_cache } from "next/cache";
import { HOME_GALLERY_CACHE_TAG } from "./gallery-cache";

// The query only contains published public rows. Let failures reject so an outage
// cannot replace successful cached data with the page's empty fallback.
export const fetchHomeGalleryItems = unstable_cache(
  async () => (await listPublishedGalleryRows({ limit: 8, featuredFirst: true })) as GalleryRow[],
  ["public-home-gallery-v1"],
  { revalidate: 300, tags: [HOME_GALLERY_CACHE_TAG] }
);

export async function fetchPublishedGalleryItem(id: string) {
  return getPublishedGalleryRow(id);
}

export async function fetchPublishedGalleryItems(options: { limit?: number; featuredFirst?: boolean } = {}) {
  return (await listPublishedGalleryRows(options)) as GalleryRow[];
}
