import { NextResponse } from "next/server";
import { isGalleryCategory, mapGalleryRow, toDbGalleryCategory } from "../../../lib/gallery";
import { listPublishedGalleryRows } from "../../../lib/gallery-db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "All";
    const sort = url.searchParams.get("sort") || "featured";
    const query = url.searchParams.get("q")?.trim().slice(0, 300) || "";
    const limitParam = Number(url.searchParams.get("limit") || "60");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 120) : 60;
    const offsetParam = Number(url.searchParams.get("offset") || "0");
    const offset = Number.isSafeInteger(offsetParam) ? Math.max(0, offsetParam) : 0;

    const rows = await listPublishedGalleryRows({
      category: isGalleryCategory(category) && category !== "All" ? toDbGalleryCategory(category) : null,
      sort,
      query,
      limit: limit + 1,
      offset
    });
    const hasMore = rows.length > limit;
    return NextResponse.json({ items: rows.slice(0, limit).map(mapGalleryRow), hasMore, nextOffset: hasMore ? offset + limit : null });
  } catch (error) {
    return NextResponse.json({
      items: [],
      storageWarning: `Gallery is temporarily unavailable: ${error instanceof Error ? error.message : "unknown error"}`
    });
  }
}
