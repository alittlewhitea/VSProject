"use client";

import Link from "next/link";
import { useState } from "react";
import { galleryItemPath, type GalleryItem } from "../lib/gallery";
import { GalleryImage } from "./gallery-image";

export function HomeGalleryGrid({ items, maxVisible = 8 }: { items: GalleryItem[]; maxVisible?: number }) {
  const [brokenIds, setBrokenIds] = useState<string[]>([]);

  const visibleItems = items
    .filter((item) => !brokenIds.includes(item.id))
    .slice(0, maxVisible);

  if (!visibleItems.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {visibleItems.map((item) => (
        <Link
          key={item.id}
          href={galleryItemPath(item)}
          className="card group overflow-hidden rounded-2xl bg-white"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f7]">
            <GalleryImage
              src={item.thumbnailUrl || item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              fill
              sizes="(min-width: 1540px) 350px, (min-width: 1024px) 25vw, 50vw"
              onError={() =>
                setBrokenIds((current) => (current.includes(item.id) ? current : [...current, item.id]))
              }
            />
          </div>
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate rounded-full border border-black/10 bg-[#f8fbff] px-2.5 py-1 text-[10px] font-semibold text-[#4c5a70] sm:text-[11px]">
                {item.category}
              </span>
              <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#8792a5] sm:inline">
                {item.model}
              </span>
            </div>
            <h3 className="mt-3 line-clamp-1 text-sm font-semibold tracking-tight text-[#1d1d1f] sm:text-base">
              {item.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#687386]">{item.prompt}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
