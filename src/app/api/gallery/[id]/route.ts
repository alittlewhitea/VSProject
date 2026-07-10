import { NextResponse } from "next/server";
import { extractGalleryId, mapGalleryRow } from "../../../../lib/gallery";
import { getPublishedGalleryRow } from "../../../../lib/gallery-db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const item = await getPublishedGalleryRow(extractGalleryId((await params).id));
    if (!item) {
      return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });
    }

    return NextResponse.json({ item: mapGalleryRow(item) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be loaded." },
      { status: 500 }
    );
  }
}
