import type { Metadata } from "next";
import { hasOnlyTrackingParameters, type SearchParameters } from "../../lib/search-url-policy";
import { absoluteUrl, siteUrl } from "../../lib/site-url";
import GalleryPageClient from "./gallery-client";

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

export default function GalleryPage() {
  return <GalleryPageClient />;
}
