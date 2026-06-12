import type { MetadataRoute } from "next";
import { defaultLocale, locales, type Locale } from "../i18n/routing";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";
import { LEGAL_DOCUMENTS } from "../lib/legal";
import { absoluteUrl, siteUrl } from "../lib/site-url";

const localizedMarketingPaths = ["/", "/price", "/auth", "/billing"] as const;

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
  const now = new Date();
  const rows = await fetchPublishedGalleryItems({ limit: 200, featuredFirst: false }).catch(() => []);
  const galleryUrls = rows.map((row) => {
    const item = mapGalleryRow(row);
    return {
      url: absoluteUrl(baseUrl, galleryItemPath(item)),
      lastModified: item.publishedAt || item.createdAt || now,
      changeFrequency: "weekly" as const,
      priority: item.isFeatured ? 0.8 : 0.7
    };
  });
  const legalUrls = LEGAL_DOCUMENTS.map((document) => ({
    url: absoluteUrl(baseUrl, `/legal/${document.slug}`),
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.3
  }));
  const localizedMarketingUrls: MetadataRoute.Sitemap = localizedMarketingPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: absoluteUrl(baseUrl, localizedPath(locale, path)),
      lastModified: now,
      changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : path === "/price" ? 0.9 : 0.7,
      alternates: localizedAlternates(baseUrl, path)
    }))
  );

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(baseUrl, "/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: absoluteUrl(baseUrl, "/studio"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95
    },
    {
      url: absoluteUrl(baseUrl, "/studio?view=home"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: absoluteUrl(baseUrl, "/studio?mode=image&workflow=text-to-image"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: absoluteUrl(baseUrl, "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85
    },
    {
      url: absoluteUrl(baseUrl, "/studio?mode=video&workflow=text-to-video"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85
    },
    {
      url: absoluteUrl(baseUrl, "/studio?mode=video&workflow=image-to-video"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: absoluteUrl(baseUrl, "/gallery"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: absoluteUrl(baseUrl, "/about"),
      lastModified: now,
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
