"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, MouseEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";
import { GALLERY_CATEGORIES, galleryItemPath, isGalleryCategory, type GalleryCategory, type GalleryItem } from "../../lib/gallery";

type GallerySort = "featured" | "latest";

function sourceLabel(item: GalleryItem) {
  const handle = item.authorHandle ? `@${item.authorHandle.replace(/^@/, "")}` : item.authorName;
  return [item.sourcePlatform || "Source", handle].filter(Boolean).join(" / ");
}

function GalleryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") || "All";
  const sortParam = searchParams.get("sort") === "latest" ? "latest" : "featured";
  const queryParam = searchParams.get("q") || "";
  const activeCategory: GalleryCategory = isGalleryCategory(categoryParam) ? categoryParam : "All";
  const activeSort: GallerySort = sortParam;
  const activeQuery = queryParam.trim();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(activeQuery);

  useEffect(() => {
    setSearchInput(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNote("");

    const params = new URLSearchParams({
      category: activeCategory,
      sort: activeSort,
      limit: "80"
    });
    if (activeQuery) params.set("q", activeQuery);

    fetch(`/api/gallery?${params.toString()}`)
      .then(async (response) => {
        const payload = (await response.json()) as { items?: GalleryItem[]; storageWarning?: string };
        if (!response.ok) throw new Error(payload.storageWarning || "Gallery could not be loaded.");
        if (!cancelled) {
          setItems(Array.isArray(payload.items) ? payload.items : []);
          setNote(payload.storageWarning || "");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setItems([]);
          setNote(error instanceof Error ? error.message : "Gallery could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory, activeSort, activeQuery]);

  const featuredCount = useMemo(() => items.filter((item) => item.isFeatured).length, [items]);

  function galleryHref(category: GalleryCategory, sort: GallerySort, search = activeQuery) {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (sort !== "featured") params.set("sort", sort);
    if (search.trim()) params.set("q", search.trim());
    const queryString = params.toString();
    return queryString ? `/gallery?${queryString}` : "/gallery";
  }

  function setCategory(category: GalleryCategory) {
    router.push(galleryHref(category, activeSort));
  }

  function setSort(sort: GallerySort) {
    router.push(galleryHref(activeCategory, sort));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(galleryHref(activeCategory, activeSort, searchInput));
  }

  function clearSearch() {
    setSearchInput("");
    router.push(galleryHref(activeCategory, activeSort, ""));
  }

  async function copyPrompt(event: MouseEvent, item: GalleryItem) {
    event.preventDefault();
    event.stopPropagation();
    await navigator.clipboard.writeText(item.prompt);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1600);
  }

  function openSource(event: MouseEvent, sourceUrl: string) {
    event.preventDefault();
    event.stopPropagation();
    window.open(sourceUrl, "_blank", "noreferrer");
  }

  function viewPromptLabel(item: GalleryItem) {
    if (copiedId === item.id) return "Copied";
    return "Copy Prompt";
  }

  function displayDate(value: string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="hero-sheen rounded-[2rem] border border-black/5 bg-gradient-to-b from-white to-[#f7f9fd] p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Curated GPT-image-2 Library</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Gallery</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374]">
                Hand-picked visual references with original source links, author attribution, model notes, and reusable prompts.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-black/10 bg-white/75 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#7a8494]">Items</p>
                <p className="mt-1 text-2xl font-semibold">{items.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#7a8494]">Featured</p>
                <p className="mt-1 text-2xl font-semibold">{featuredCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {GALLERY_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === category
                    ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                    : "border-black/10 bg-white/85 text-[#435064] hover:bg-[#f1f6ff]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-black/10 bg-white p-1 shadow-sm">
            {(["featured", "latest"] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                onClick={() => setSort(sort)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                  activeSort === sort ? "bg-[#1d1d1f] text-white" : "text-[#4f596b] hover:bg-[#f1f6ff]"
                }`}
              >
                {sort === "featured" ? "Editor Picks" : "Latest"}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#7a8494]">
            Original source and creator attribution are kept on every detail page.
          </p>
        </section>

        <form onSubmit={submitSearch} className="mt-4 grid gap-3 rounded-2xl border border-black/10 bg-white/85 p-3 shadow-sm md:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="sr-only">Search gallery</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#77a8e8]"
              placeholder="Search prompts, titles, creators, models..."
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Search
          </button>
          {activeQuery ? (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-[#1d1d1f]"
            >
              Clear
            </button>
          ) : null}
        </form>

        {activeQuery ? (
          <p className="mt-3 text-sm text-[#667084]">
            Showing results for <span className="font-semibold text-[#1d1d1f]">{activeQuery}</span>.
          </p>
        ) : null}

        {note ? (
          <p className="mt-5 rounded-xl border border-[#d8b85d]/30 bg-[#fff8df] px-4 py-3 text-sm text-[#705d1d]">
            {note}
          </p>
        ) : null}

        {loading ? (
          <section className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="mb-4 h-72 break-inside-avoid rounded-2xl border border-black/10 bg-white/70 shadow-[0_14px_36px_rgba(13,18,35,0.07)]"
              />
            ))}
          </section>
        ) : items.length ? (
          <section className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {items.map((item) => (
              <Link
                key={item.id}
                href={galleryItemPath(item)}
                className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_14px_36px_rgba(13,18,35,0.07)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(13,18,35,0.11)]"
              >
                <img
                  src={item.thumbnailUrl || item.imageUrl}
                  alt={item.title}
                  className="max-h-[560px] w-full bg-[#eef2f7] object-cover"
                  loading="lazy"
                />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-black/10 bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#4c5a70]">
                      {item.category}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[#8792a5]">{item.model}</span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold tracking-tight text-[#1d1d1f]">{item.title}</h2>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#687386]">{item.prompt}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#4b5d76]">{sourceLabel(item)}</p>
                      {displayDate(item.publishedAt || item.createdAt) ? (
                        <p className="mt-1 text-[11px] text-[#9aa3b2]">{displayDate(item.publishedAt || item.createdAt)}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => copyPrompt(event, item)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] shadow-sm hover:bg-[#f8fbff]"
                      >
                        {viewPromptLabel(item)}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openSource(event, item.sourceUrl)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] shadow-sm hover:bg-[#f8fbff]"
                      >
                        Source
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">No curated items yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#667084]">
              {activeQuery
                ? "No items matched this search. Try a broader keyword or clear the search."
                : "Add rows to the public gallery table and published items will appear here."}
            </p>
            <div className="mt-5">
              <AppButton href="/studio?mode=image" variant="secondary" size="md">Open Studio</AppButton>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={null}>
      <GalleryContent />
    </Suspense>
  );
}
