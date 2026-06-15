import type { Metadata } from "next";
import { loadMessages } from "../i18n/messages";
import { defaultLocale, isLocale, locales, type Locale } from "../i18n/routing";
import { siteUrl } from "./site-url";

export type MarketingPage = "home" | "price" | "auth" | "billing";

type MetadataCopy = {
  title: string;
  description: string;
};

const pagePath: Record<MarketingPage, string> = {
  home: "/",
  price: "/price",
  auth: "/auth",
  billing: "/billing"
};

const openGraphLocales: Record<Locale, string> = {
  en: "en_US",
  "zh-CN": "zh_CN",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  vi: "vi_VN",
  de: "de_DE",
  fr: "fr_FR"
};

function localizedPath(locale: Locale, page: MarketingPage) {
  const path = pagePath[page];
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export async function createLocalizedMetadata(rawLocale: string, page: MarketingPage): Promise<Metadata> {
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const messages = await loadMessages(locale);
  const metadataMessages = messages.metadata as Record<MarketingPage, MetadataCopy>;
  const copy = metadataMessages[page] || metadataMessages.home;
  const baseUrl = siteUrl();
  const canonicalPath = localizedPath(locale, page);
  const languages = Object.fromEntries(locales.map((item) => [item, localizedPath(item, page)]));

  return {
    metadataBase: new URL(baseUrl),
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        ...languages,
        "x-default": localizedPath(defaultLocale, page)
      }
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonicalPath,
      type: "website",
      siteName: "DreamFace",
      locale: openGraphLocales[locale],
      alternateLocale: locales.filter((item) => item !== locale).map((item) => openGraphLocales[item])
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description
    }
  };
}
