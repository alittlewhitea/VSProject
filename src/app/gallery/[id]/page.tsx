import type { Metadata } from "next";
import { extractGalleryId, galleryItemPath, mapGalleryRow } from "../../../lib/gallery";
import { fetchPublishedGalleryItem } from "../../../lib/gallery-server";
import { GalleryDetailClient } from "./gallery-detail-client";

type GalleryDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function promptDescription(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  return cleaned.length > 155 ? `${cleaned.slice(0, 152)}...` : cleaned;
}

export async function generateMetadata({ params }: GalleryDetailPageProps): Promise<Metadata> {
  const itemId = extractGalleryId((await params).id);
  const row = await fetchPublishedGalleryItem(itemId).catch(() => null);
  if (!row) {
    return {
      title: "Gallery Item | Nova Studio",
      description: "Curated GPT-image-2 prompt reference from Nova Studio."
    };
  }

  const item = mapGalleryRow(row);
  const description = promptDescription(item.prompt);

  return {
    title: `${item.title} | GPT-image-2 Prompt Gallery`,
    description,
    alternates: {
      canonical: galleryItemPath(item)
    },
    openGraph: {
      title: item.title,
      description,
      type: "article",
      images: [
        {
          url: item.imageUrl,
          alt: item.title,
          width: item.width || undefined,
          height: item.height || undefined
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      images: [item.imageUrl]
    }
  };
}

export default async function GalleryDetailPage({ params }: GalleryDetailPageProps) {
  return <GalleryDetailClient itemId={extractGalleryId((await params).id)} />;
}
