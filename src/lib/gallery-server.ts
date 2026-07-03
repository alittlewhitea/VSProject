import { type GalleryRow } from "./gallery";
import { getPublishedGalleryRow, listPublishedGalleryRows } from "./gallery-db";

export async function fetchPublishedGalleryItem(id: string) {
  return getPublishedGalleryRow(id);
}

export async function fetchPublishedGalleryItems(options: { limit?: number; featuredFirst?: boolean } = {}) {
  return (await listPublishedGalleryRows(options)) as GalleryRow[];
}
