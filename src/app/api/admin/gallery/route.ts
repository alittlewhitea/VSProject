import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { GALLERY_CATEGORIES, mapGalleryRow, toDbGalleryCategory } from "../../../../lib/gallery";
import {
  deleteAdminGalleryRow,
  findDuplicateGalleryRow,
  insertAdminGalleryRow,
  listAdminGalleryRows,
  updateAdminGalleryRow
} from "../../../../lib/gallery-db";

const INSERTABLE_CATEGORIES = GALLERY_CATEGORIES.filter((category) => category !== "All");

type GalleryAdminPayload = {
  id?: string;
  title?: string;
  category?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
  model?: string;
  authorName?: string;
  authorHandle?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  aspectRatio?: string;
  width?: number | string;
  height?: number | string;
  publishedAt?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
};

function parseOptionalInt(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validatePayload(body: GalleryAdminPayload) {
  const title = cleanOptionalText(body.title);
  const category = cleanOptionalText(body.category);
  const imageUrl = cleanOptionalText(body.imageUrl);
  const thumbnailUrl = cleanOptionalText(body.thumbnailUrl);
  const prompt = cleanOptionalText(body.prompt);
  const sourceUrl = cleanOptionalText(body.sourceUrl);

  if (!title) return { error: "Title is required." };
  if (!category || !INSERTABLE_CATEGORIES.includes(category as (typeof INSERTABLE_CATEGORIES)[number])) {
    return { error: "A valid category is required." };
  }
  if (!imageUrl || !isHttpUrl(imageUrl)) return { error: "A valid image URL is required." };
  if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) return { error: "Thumbnail URL must be a valid URL." };
  if (!prompt) return { error: "Prompt is required." };
  if (!sourceUrl || !isHttpUrl(sourceUrl)) return { error: "A valid source URL is required." };

  const data: Record<string, unknown> = {
    title,
    category: toDbGalleryCategory(category),
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl,
    prompt,
    model: cleanOptionalText(body.model) || "GPT-image-2",
    author_name: cleanOptionalText(body.authorName),
    author_handle: cleanOptionalText(body.authorHandle)?.replace(/^@/, "") || null,
    source_platform: cleanOptionalText(body.sourcePlatform) || "X",
    source_url: sourceUrl,
    aspect_ratio: cleanOptionalText(body.aspectRatio),
    width: parseOptionalInt(body.width),
    height: parseOptionalInt(body.height),
    is_featured: Boolean(body.isFeatured),
    is_published: body.isPublished !== false
  };
  const publishedAt = cleanOptionalText(body.publishedAt);
  if (publishedAt) data.published_at = publishedAt;

  return { data };
}

export async function GET(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  try {
    const data = await listAdminGalleryRows();
    return NextResponse.json({ items: data.map(mapGalleryRow), adminEmail: adminUser.email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin gallery could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as GalleryAdminPayload | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });

  const validated = validatePayload(body);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    const duplicate = await findDuplicateGalleryRow(validated.data.source_url, validated.data.image_url);
    if (duplicate) {
      return NextResponse.json({ error: `Duplicate gallery item: ${duplicate.title}`, item: mapGalleryRow(duplicate), duplicate: true }, { status: 409 });
    }
    const data = await insertAdminGalleryRow(validated.data);
    return NextResponse.json({ item: data ? mapGalleryRow(data) : null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be saved." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as GalleryAdminPayload | null;
  if (!body?.id) return NextResponse.json({ error: "Gallery item id is required." }, { status: 400 });

  const validated = validatePayload(body);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    const duplicate = await findDuplicateGalleryRow(validated.data.source_url, validated.data.image_url, body.id);
    if (duplicate) {
      return NextResponse.json({ error: `Duplicate gallery item: ${duplicate.title}`, item: mapGalleryRow(duplicate), duplicate: true }, { status: 409 });
    }
    const data = await updateAdminGalleryRow(body.id, validated.data);
    if (!data) return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });
    return NextResponse.json({ item: mapGalleryRow(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be updated." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Gallery item id is required." }, { status: 400 });

  try {
    const data = await deleteAdminGalleryRow(id);
    if (!data) return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });
    return NextResponse.json({ item: mapGalleryRow(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be deleted." },
      { status: 500 }
    );
  }
}
