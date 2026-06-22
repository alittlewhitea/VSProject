import type { MetadataRoute } from "next";
import { defaultLocale, locales, type Locale } from "../i18n/routing";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";
import { LEGAL_DOCUMENTS } from "../lib/legal";
import { absoluteUrl, siteUrl } from "../lib/site-url";

// Only include public, canonical marketing pages. Authentication and billing
// pages are user-flow pages rather than search landing pages.
const localizedMarketingPaths = ["/", "/price"] as const;

function localizedPath(locale: Locale, path: string) {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function localizedAlternates(baseUrl: string, path: string) {
  return {
    languages: {
      ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(baseUrl, localizedPath(locale, path))])),
      "x-default": absoluteUrl(baseUrl, localizedPath(defaultLocale, path))
    }
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl();
  const rows = await fetchPublishedGalleryItems({ limit: 200, featuredFirst: false }).catch(() => []);
  const galleryUrls = rows.map((row) => {
    const item = mapGalleryRow(row);
    const lastModified = item.publishedAt || item.createdAt;
    return {
      url: absoluteUrl(baseUrl, galleryItemPath(item)),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: item.isFeatured ? 0.8 : 0.7
    };
  });
  const legalUrls = LEGAL_DOCUMENTS.map((document) => ({
    url: absoluteUrl(baseUrl, `/legal/${document.slug}`),
    changeFrequency: "yearly" as const,
    priority: 0.3
  }));
  const localizedMarketingUrls: MetadataRoute.Sitemap = localizedMarketingPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: absoluteUrl(baseUrl, localizedPath(locale, path)),
      changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : 0.9,
      alternates: localizedAlternates(baseUrl, path)
    }))
  );

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(baseUrl, "/studio"),
      changeFrequency: "weekly",
      priority: 0.95
    },
    {
      url: absoluteUrl(baseUrl, "/gallery"),
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: absoluteUrl(baseUrl, "/about"),
      changeFrequency: "monthly",
      priority: 0.6
    }
  ];

  return [
    ...localizedMarketingUrls,
    ...staticUrls,
    ...legalUrls,
    ...galleryUrls
  ];
}
