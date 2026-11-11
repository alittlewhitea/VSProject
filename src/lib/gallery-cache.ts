import { revalidateTag } from "next/cache";

export const HOME_GALLERY_CACHE_TAG = "public-home-gallery";

export function invalidateHomeGalleryCache() {
  revalidateTag(HOME_GALLERY_CACHE_TAG);
}
