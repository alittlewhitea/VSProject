"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "../../../components/top-nav";
import { AppButton } from "../../../components/ui/button";
import { galleryItemPath, type GalleryItem } from "../../../lib/gallery";

function sourceName(item: GalleryItem) {
  const author = item.authorHandle ? `@${item.authorHandle.replace(/^@/, "")}` : item.authorName;
  return [item.sourcePlatform || "Source", author].filter(Boolean).join(" / ");
}

export function GalleryDetailClient({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [relatedItems, setRelatedItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/gallery/${encodeURIComponent(itemId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as { item?: GalleryItem; error?: string };
        if (!response.ok || !payload.item) {
          throw new Error(payload.error || "Gallery item could not be loaded.");
        }
        if (!cancelled) setItem(payload.item);
      })
      .catch((error) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Gallery item could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const params = new URLSearchParams({
      category: item.category,
      sort: "featured",
      limit: "8"
    });

    fetch(`/api/gallery?${params.toString()}`)
      .then(async (response) => {
        const payload = (await response.json()) as { items?: GalleryItem[] };
        if (!response.ok) return;
        if (!cancelled) {
          setRelatedItems((payload.items || []).filter((related) => related.id !== item.id).slice(0, 4));
        }
      })
      .catch(() => {
        if (!cancelled) setRelatedItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  async function copyPrompt() {
    if (!item) return;
    await navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function sourceHandle() {
    if (!item) return "";
    if (item.authorHandle) return `@${item.authorHandle.replace(/^@/, "")}`;
    return item.authorName || "Original creator";
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-[1540px] px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/gallery" className="text-sm font-semibold text-[#34506f]">
            &lt;- Back to Gallery
          </Link>
          {item ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyPrompt}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-sm"
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>
              <AppButton href={`/studio?mode=image&workflow=text-to-image&prompt=${encodeURIComponent(item.prompt)}`} variant="primary" size="md">
                Use Prompt
              </AppButton>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-sm"
              >
                Original Source
              </a>
            </div>
          ) : null}
        </div>

        {loading ? (
          <section className="rounded-2xl border border-black/10 bg-white p-8 text-sm text-[#667084]">Loading gallery item...</section>
        ) : error || !item ? (
          <section className="rounded-2xl border border-black/10 bg-white p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Item unavailable</h1>
            <p className="mt-3 text-sm text-[#667084]">{error || "Gallery item could not be loaded."}</p>
          </section>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px]">
              <article className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-[#f3f6fb] p-2 shadow-[0_18px_46px_rgba(13,18,35,0.08)]">
                <div className="flex min-h-[58vh] items-center justify-center rounded-[1.35rem] bg-white">
                  <img src={item.imageUrl} alt={item.title} className="max-h-[82vh] w-full rounded-[1.35rem] object-contain" />
                </div>
              </article>

              <aside className="space-y-5">
                <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_14px_36px_rgba(13,18,35,0.07)]">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-[#4c5a70]">
                      {item.category}
                    </span>
                    {item.isFeatured ? (
                      <span className="rounded-full border border-black/10 bg-[#fff8df] px-3 py-1 text-xs font-semibold text-[#705d1d]">
                        Featured
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold tracking-tight">{item.title}</h1>
                  <p className="mt-3 text-sm leading-6 text-[#667084]">
                    Curated from {sourceHandle()}. The prompt below is preserved from the source or the provided original text.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="rounded-2xl bg-[#1d1d1f] px-4 py-3 text-sm font-semibold text-white shadow-sm"
                    >
                      {copied ? "Copied" : "Copy Prompt"}
                    </button>
                    <Link
                      href={`/studio?mode=image&workflow=text-to-image&prompt=${encodeURIComponent(item.prompt)}`}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-[#1d1d1f] shadow-sm"
                    >
                      Use in Studio
                    </Link>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm">
                    <div className="rounded-xl border border-black/10 bg-white/80 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Model</dt>
                      <dd className="mt-1 font-semibold text-[#1d1d1f]">{item.model}</dd>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white/80 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Source</dt>
                      <dd className="mt-1 break-words font-semibold text-[#1d1d1f]">
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-black/20 underline-offset-4">
                          {sourceName(item)}
                        </a>
                      </dd>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white/80 p-3">
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#778194]">Format</dt>
                      <dd className="mt-1 font-semibold text-[#1d1d1f]">
                        {[item.aspectRatio, item.width && item.height ? `${item.width}x${item.height}` : null]
                          .filter(Boolean)
                          .join(" / ") || "Not specified"}
                      </dd>
                    </div>
                  </dl>
                </article>

                <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_14px_36px_rgba(13,18,35,0.07)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Prompt</p>
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] shadow-sm"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#343d4d]">{item.prompt}</p>
                </article>

                <article className="rounded-3xl border border-black/10 bg-white/70 p-5 text-xs leading-6 text-[#6b7587]">
                  Images and prompts are curated from public source posts for attribution and reference. Check the original source for creator context and usage rights.
                </article>
              </aside>
            </section>

            {relatedItems.length ? (
              <section className="mt-10">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#778194]">More Like This</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">Related {item.category} prompts</h2>
                  </div>
                  <Link href={`/gallery?category=${encodeURIComponent(item.category)}`} className="text-sm font-semibold text-[#1d1d1f]">
                    View category -&gt;
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {relatedItems.map((related) => (
                    <Link key={related.id} href={galleryItemPath(related)} className="card group overflow-hidden rounded-2xl bg-white">
                      <div className="aspect-[4/5] overflow-hidden bg-[#eef2f7]">
                        <img
                          src={related.thumbnailUrl || related.imageUrl}
                          alt={related.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-[11px] font-semibold text-[#4c5a70]">{related.category}</p>
                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold tracking-tight">{related.title}</h3>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#667084]">{related.prompt}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
