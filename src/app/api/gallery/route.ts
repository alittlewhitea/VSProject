import { NextResponse } from "next/server";
import { isGalleryCategory, mapGalleryRow, toDbGalleryCategory } from "../../../lib/gallery";
import { listPublishedGalleryRows } from "../../../lib/gallery-db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "All";
    const sort = url.searchParams.get("sort") || "featured";
    const query = url.searchParams.get("q")?.trim() || "";
    const limitParam = Number(url.searchParams.get("limit") || "60");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 120) : 60;

    const rows = await listPublishedGalleryRows({
      category: isGalleryCategory(category) && category !== "All" ? toDbGalleryCategory(category) : null,
      sort,
      query,
      limit
    });
    return NextResponse.json({ items: rows.map(mapGalleryRow) });
  } catch (error) {
    return NextResponse.json({
      items: [],
      storageWarning: `Gallery is temporarily unavailable: ${error instanceof Error ? error.message : "unknown error"}`
    });
  }
}
