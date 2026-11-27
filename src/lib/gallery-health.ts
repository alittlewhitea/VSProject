import type { GalleryRow } from "./gallery";

const DEAD_IMAGE_STATUSES = new Set([403, 404, 410, 451]);
const IMAGE_CHECK_TIMEOUT_MS = 2500;

export type ImageProbeFetch = (
  input: string,
  init?: RequestInit
) => Promise<{ status: number }>;

function primaryImageUrl(row: GalleryRow) {
  return (row.thumbnail_url || row.image_url || "").trim();
}

export async function isGalleryImageReachable(
  url: string,
  probeFetch: ImageProbeFetch = fetch
): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  if (!/^https?:\/\//i.test(url)) return true;

  try {
    const response = await probeFetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(IMAGE_CHECK_TIMEOUT_MS)
    });
    if (DEAD_IMAGE_STATUSES.has(response.status)) return false;
    return true;
  } catch {
    // Fail open on transient network timeouts so healthy rows are not dropped during upstream blips.
    return true;
  }
}

export async function filterReachableGalleryRows(
  rows: GalleryRow[],
  options: { limit?: number; probeFetch?: ImageProbeFetch } = {}
): Promise<GalleryRow[]> {
  const { limit = rows.length, probeFetch = fetch } = options;
  if (!rows.length || limit <= 0) return [];

  const results = await Promise.all(
    rows.map(async (row) => ({
      row,
      ok: await isGalleryImageReachable(primaryImageUrl(row), probeFetch)
    }))
  );

  return results
    .filter((entry) => entry.ok)
    .map((entry) => entry.row)
    .slice(0, limit);
}
