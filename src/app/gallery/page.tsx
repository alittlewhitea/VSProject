import type { Metadata } from "next";
import { hasOnlyTrackingParameters, type SearchParameters } from "../../lib/search-url-policy";
import { absoluteUrl, siteUrl } from "../../lib/site-url";
import GalleryPageClient from "./gallery-client";
import { listPublishedGalleryRows } from "../../lib/gallery-db";
import { isGalleryCategory, mapGalleryRow, toDbGalleryCategory } from "../../lib/gallery";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParameters> }): Promise<Metadata> {
  const params = await searchParams;
  const title = "AI Prompt Gallery and Creative Examples";
  const description = "Explore AI image examples and prompts in the DreamFace gallery, with creative references for your next project.";
  return {
    title,
    description,
    ...(hasOnlyTrackingParameters(params) ? { alternates: { canonical: absoluteUrl(siteUrl(), "/gallery") } } : {}),
    openGraph: { title: `${title} | DreamFace`, description, type: "website" }
  };
}

export default async function GalleryPage({ searchParams }: { searchParams: Promise<SearchParameters> }) {
  const params = await searchParams;
  const category = typeof params.category === "string" && isGalleryCategory(params.category) ? params.category : "All";
  const sort = params.sort === "latest" ? "latest" : "featured";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 300) : "";
  const initialKey = JSON.stringify([category, sort, query]);
  try {
    const rows = await listPublishedGalleryRows({ category: toDbGalleryCategory(category), sort, query, limit: 80 });
    return <GalleryPageClient initialItems={rows.map(mapGalleryRow)} initialLoaded initialKey={initialKey} />;
  } catch {
    return <GalleryPageClient initialItems={[]} initialLoaded={false} initialKey={initialKey} />;
  }
}
