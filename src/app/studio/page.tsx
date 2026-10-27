import { cookies } from "next/headers";
import type { Metadata } from "next";
import { defaultLocale, isLocale, localeCookieKey } from "../../i18n/routing";
import { hasOnlyTrackingParameters, isPrivateStudioView, type SearchParameters } from "../../lib/search-url-policy";
import { absoluteUrl, siteUrl } from "../../lib/site-url";
import { StudioPageClient } from "./studio-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParameters> }): Promise<Metadata> {
  const params = await searchParams;
  const title = "AI Creative Studio";
  const description = "Create AI images, videos, avatars, voiceovers, and music in the DreamFace creative workspace.";
  return {
    title,
    description,
    ...(isPrivateStudioView(params) ? { robots: { index: false, follow: true } } : {}),
    ...(hasOnlyTrackingParameters(params) ? { alternates: { canonical: absoluteUrl(siteUrl(), "/studio") } } : {}),
    openGraph: { title: `${title} | DreamFace`, description, type: "website" }
  };
}

export default async function StudioPage() {
  const cookieLocale = (await cookies()).get(localeCookieKey)?.value;
  return <StudioPageClient initialLocale={isLocale(cookieLocale) ? cookieLocale : defaultLocale} />;
}
