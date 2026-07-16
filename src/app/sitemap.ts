import type { MetadataRoute } from "next";
import { defaultLocale, locales, type Locale } from "../i18n/routing";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";
import { LEGAL_DOCUMENTS } from "../lib/legal";
import { absoluteUrl, siteUrl } from "../lib/site-url";

const higgsfieldComparisonVerifiedDate = "2026-07-10";
const runwayComparisonVerifiedDate = "2026-07-10";
const klingAiComparisonVerifiedDate = "2026-07-10";
const pikaComparisonVerifiedDate = "2026-07-10";
const artlistComparisonVerifiedDate = "2026-07-10";
const heygenComparisonVerifiedDate = "2026-07-10";

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
      url: absoluteUrl(baseUrl, "/video/gemini-omni"),
      lastModified: "2026-07-16",
      changeFrequency: "monthly",
      priority: 0.85
    },
    {
      url: absoluteUrl(baseUrl, "/video/seedance-2"),
      lastModified: "2026-07-16",
      changeFrequency: "monthly",
      priority: 0.85
    },
    {
      url: absoluteUrl(baseUrl, "/about"),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: absoluteUrl(baseUrl, "/compare"),
      changeFrequency: "monthly",
      priority: 0.75
    },
    {
      url: absoluteUrl(baseUrl, "/compare/dreamface-vs-higgsfield"),
      lastModified: higgsfieldComparisonVerifiedDate,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: absoluteUrl(baseUrl, "/compare/dreamface-vs-runway"),
      lastModified: runwayComparisonVerifiedDate,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: absoluteUrl(baseUrl, "/compare/dreamface-vs-kling-ai"),
      lastModified: klingAiComparisonVerifiedDate,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: absoluteUrl(baseUrl, "/compare/dreamface-vs-pika"),
      lastModified: pikaComparisonVerifiedDate,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: absoluteUrl(baseUrl, "/compare/dreamface-vs-artlist"),
      lastModified: artlistComparisonVerifiedDate,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: absoluteUrl(baseUrl, "/compare/dreamface-vs-heygen"),
      lastModified: heygenComparisonVerifiedDate,
      changeFrequency: "monthly",
      priority: 0.8
    }
  ];

  return [
    ...localizedMarketingUrls,
    ...staticUrls,
    ...legalUrls,
    ...galleryUrls
  ];
}
