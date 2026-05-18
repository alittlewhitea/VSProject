import type { MetadataRoute } from "next";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";
import { LEGAL_DOCUMENTS } from "../lib/legal";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    process.env.SITE_URL?.trim().replace(/\/$/, "") ||
    "http://127.0.0.1:3000"
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl();
  const now = new Date();
  const rows = await fetchPublishedGalleryItems({ limit: 200, featuredFirst: false }).catch(() => []);
  const galleryUrls = rows.map((row) => {
    const item = mapGalleryRow(row);
    return {
      url: `${baseUrl}${galleryItemPath(item)}`,
      lastModified: item.publishedAt || item.createdAt || now,
      changeFrequency: "weekly" as const,
      priority: item.isFeatured ? 0.8 : 0.7
    };
  });
  const legalUrls = LEGAL_DOCUMENTS.map((document) => ({
    url: `${baseUrl}/legal/${document.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.4
  }));

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${baseUrl}/studio`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6
    },
    ...legalUrls,
    ...galleryUrls
  ];
}
