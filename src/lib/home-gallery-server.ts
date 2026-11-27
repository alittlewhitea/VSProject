import { unstable_cache } from "next/cache";
import type { GalleryRow } from "./gallery";
import { HOME_GALLERY_CACHE_TAG } from "./gallery-cache";
import { listPublishedGalleryRows } from "./gallery-db";
import { filterReachableGalleryRows } from "./gallery-health";

// Fetch an extra buffer of published rows and drop deleted third-party images (403/404/410)
// before caching so the homepage keeps a full 8-card grid without broken thumbnails.
export const fetchHealthyHomeGalleryItems = unstable_cache(
  async () => {
    const rows = (await listPublishedGalleryRows({ limit: 20, featuredFirst: true })) as GalleryRow[];
    return filterReachableGalleryRows(rows, { limit: 12 });
  },
  ["public-home-gallery-healthy-v1"],
  { revalidate: 300, tags: [HOME_GALLERY_CACHE_TAG] }
);
