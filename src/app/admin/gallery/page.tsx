"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "../../../components/top-nav";
import { AppButton } from "../../../components/ui/button";
import { createBrowserSupabaseClient } from "../../../lib/supabase-client";
import { GALLERY_CATEGORIES, galleryItemPath, type GalleryItem } from "../../../lib/gallery";

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.filter((category) => category !== "All");

type FormState = {
  title: string;
  category: string;
  imageUrl: string;
  thumbnailUrl: string;
  prompt: string;
  model: string;
  authorName: string;
  authorHandle: string;
  sourcePlatform: string;
  sourceUrl: string;
  aspectRatio: string;
  width: string;
  height: string;
  publishedAt: string;
  isFeatured: boolean;
  isPublished: boolean;
};

type XCandidate = {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  authorName: string;
  authorHandle: string;
  sourceUrl: string;
  media: Array<{
    url: string;
    type: string;
    width: number | null;
    height: number | null;
  }>;
};

type XMediaDraft = {
  selected: boolean;
  title: string;
};

const initialForm: FormState = {
  title: "",
  category: "Ecommerce Ads",
  imageUrl: "",
  thumbnailUrl: "",
  prompt: "",
  model: "GPT-image-2",
  authorName: "",
  authorHandle: "",
  sourcePlatform: "X",
  sourceUrl: "",
  aspectRatio: "",
  width: "",
  height: "",
  publishedAt: "",
  isFeatured: false,
  isPublished: true
};

function cleanTitleText(text: string) {
  return text.replace(/https:\/\/t\.co\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function defaultTitle(candidate: XCandidate) {
  const cleaned = cleanTitleText(candidate.text);
  if (!cleaned) return `X pick by @${candidate.authorHandle}`;
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned;
}

function mediaTitle(candidate: XCandidate, index: number) {
  const base = defaultTitle(candidate);
  return candidate.media.length > 1 ? `${base} ${index + 1}` : base;
}

function imageAspect(width: number | null, height: number | null) {
  if (!width || !height) return "";
  return `${width}:${height}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function GalleryAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "error" | "idle">("idle");
  const [recentItems, setRecentItems] = useState<GalleryItem[]>([]);
  const [createdItem, setCreatedItem] = useState<GalleryItem | null>(null);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [xUrl, setXUrl] = useState("");
  const [xCandidate, setXCandidate] = useState<XCandidate | null>(null);
  const [xMediaDrafts, setXMediaDrafts] = useState<Record<string, XMediaDraft>>({});
  const [parsingX, setParsingX] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || null;
      if (!accessToken) {
        router.replace("/auth?next=/admin/gallery");
        return;
      }
      setToken(accessToken);
    });
  }, [router, supabase]);

  useEffect(() => {
    if (!token) return;

    fetch("/api/admin/gallery", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        const payload = (await response.json()) as { items?: GalleryItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Admin access failed.");
        setRecentItems(payload.items || []);
        setMessage("");
      })
      .catch((error) => {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Admin access failed.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitItem() {
    if (!token || saving) return;

    setSaving(true);
    setMessage("");
    setCreatedItem(null);

    try {
      const response = await fetch("/api/admin/gallery", {
        method: editingItem ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingItem ? { ...form, id: editingItem.id } : form)
      });
      const payload = (await response.json()) as { item?: GalleryItem; error?: string };
      if (!response.ok || !payload.item) {
        throw new Error(payload.error || "Gallery item could not be saved.");
      }
      setCreatedItem(payload.item);
      setRecentItems((prev) => {
        const next = editingItem
          ? prev.map((item) => (item.id === payload.item?.id ? (payload.item as GalleryItem) : item))
          : [payload.item as GalleryItem, ...prev];
        return next.slice(0, 12);
      });
      setForm({ ...initialForm, category: form.category, model: form.model, sourcePlatform: form.sourcePlatform });
      setEditingItem(null);
      setTone("ok");
      setMessage(editingItem ? "Gallery item updated." : "Gallery item saved.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Gallery item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function editItem(item: GalleryItem) {
    setEditingItem(item);
    setCreatedItem(null);
    setMessage("");
    setForm({
      title: item.title,
      category: item.category,
      imageUrl: item.imageUrl,
      thumbnailUrl: item.thumbnailUrl || "",
      prompt: item.prompt,
      model: item.model,
      authorName: item.authorName || "",
      authorHandle: item.authorHandle || "",
      sourcePlatform: item.sourcePlatform || "X",
      sourceUrl: item.sourceUrl,
      aspectRatio: item.aspectRatio || "",
      width: item.width ? String(item.width) : "",
      height: item.height ? String(item.height) : "",
      publishedAt: item.publishedAt || "",
      isFeatured: item.isFeatured,
      isPublished: true
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteItem(item: GalleryItem) {
    if (!token || saving) return;
    const confirmed = window.confirm(`Delete "${item.title}" from Gallery?`);
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/gallery?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as { item?: GalleryItem; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Gallery item could not be deleted.");
      }
      setRecentItems((prev) => prev.filter((recent) => recent.id !== item.id));
      if (editingItem?.id === item.id) {
        setEditingItem(null);
        setForm(initialForm);
      }
      setTone("ok");
      setMessage("Gallery item deleted.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Gallery item could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  function applyCandidate(candidate: XCandidate, imageUrl = candidate.media[0]?.url || "") {
    const selectedMedia = candidate.media.find((item) => item.url === imageUrl) || candidate.media[0];
    setXCandidate(candidate);
    setXMediaDrafts((prev) => {
      const next: Record<string, XMediaDraft> = {};
      candidate.media.forEach((media, index) => {
        next[media.url] = prev[media.url] || {
          selected: index === 0,
          title: mediaTitle(candidate, index)
        };
      });
      return next;
    });
    setForm((prev) => ({
      ...prev,
      title: xMediaDrafts[imageUrl]?.title || defaultTitle(candidate),
      imageUrl,
      thumbnailUrl: imageUrl,
      prompt: candidate.text,
      authorName: candidate.authorName,
      authorHandle: candidate.authorHandle,
      sourcePlatform: "X",
      sourceUrl: candidate.sourceUrl,
      aspectRatio: imageAspect(selectedMedia?.width ?? null, selectedMedia?.height ?? null),
      width: selectedMedia?.width ? String(selectedMedia.width) : "",
      height: selectedMedia?.height ? String(selectedMedia.height) : "",
      publishedAt: candidate.createdAt
    }));
  }

  function updateMediaDraft(url: string, patch: Partial<XMediaDraft>) {
    setXMediaDrafts((prev) => ({
      ...prev,
      [url]: {
        selected: prev[url]?.selected ?? false,
        title: prev[url]?.title || form.title || "Untitled item",
        ...patch
      }
    }));
  }

  async function postGalleryItem(payload: FormState) {
    const response = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = (await response.json()) as { item?: GalleryItem; error?: string; duplicate?: boolean };
    if (response.status === 409 && data.duplicate) {
      return { duplicate: true, item: data.item || null };
    }
    if (!response.ok || !data.item) {
      throw new Error(data.error || "Gallery item could not be saved.");
    }
    return { duplicate: false, item: data.item };
  }

  async function saveSelectedImages() {
    if (!token || !xCandidate || saving) return;
    const selected = xCandidate.media.filter((media) => xMediaDrafts[media.url]?.selected);
    if (!selected.length) {
      setTone("error");
      setMessage("Select at least one image to save.");
      return;
    }

    setSaving(true);
    setMessage("");
    setCreatedItem(null);

    try {
      const saved: GalleryItem[] = [];
      let duplicates = 0;
      for (const media of selected) {
        const mediaDraft = xMediaDrafts[media.url];
        const result = await postGalleryItem({
          ...form,
          title: mediaDraft?.title || form.title,
          imageUrl: media.url,
          thumbnailUrl: media.url,
          aspectRatio: imageAspect(media.width, media.height),
          width: media.width ? String(media.width) : "",
          height: media.height ? String(media.height) : ""
        });
        if (result.duplicate) {
          duplicates += 1;
        } else if (result.item) {
          saved.push(result.item);
        }
      }

      if (saved.length) {
        setCreatedItem(saved[0]);
        setRecentItems((prev) => [...saved, ...prev].slice(0, 12));
      }
      setTone("ok");
      setMessage(`Saved ${saved.length} image${saved.length === 1 ? "" : "s"}${duplicates ? `, skipped ${duplicates} duplicate${duplicates === 1 ? "" : "s"}` : ""}.`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Selected images could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function parseXLink() {
    if (!token || parsingX || !xUrl.trim()) return;
    setParsingX(true);
    setMessage("");
    setCreatedItem(null);

    try {
      const params = new URLSearchParams({ tweetUrl: xUrl.trim() });
      const response = await fetch(`/api/admin/gallery/import-x?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json()) as { candidates?: XCandidate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "X post could not be parsed.");
      const candidate = payload.candidates?.[0];
      if (!candidate) throw new Error("No image was found on this X post.");
      applyCandidate(candidate);
      setTone("ok");
      setMessage(`Parsed @${candidate.authorHandle}'s post with ${candidate.media.length} image${candidate.media.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setXCandidate(null);
      setTone("error");
      setMessage(error instanceof Error ? error.message : "X post could not be parsed.");
    } finally {
      setParsingX(false);
    }
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="hero-sheen rounded-[2rem] border border-black/5 bg-gradient-to-b from-white to-[#f7f9fd] p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Admin Curation</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Gallery Admin</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374]">
                Add hand-picked GPT-image-2 references with source attribution, author metadata, and exact original prompts.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AppButton href="/gallery" variant="secondary" size="md">
                Public Gallery
              </AppButton>
            </div>
          </div>
        </section>

        {loading ? (
          <p className="mt-5 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
            Checking admin access...
          </p>
        ) : message ? (
          <p
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              tone === "ok"
                ? "border-[#74c69d]/40 bg-[#edf9f1] text-[#197a46]"
                : "border-[#e5a3a3]/50 bg-[#fff1f1] text-[#a53439]"
            }`}
          >
            {message}
            {createdItem ? (
              <>
                {" "}
                <Link href={galleryItemPath(createdItem)} className="font-semibold underline">
                  View item
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="card rounded-3xl p-6 md:p-7">
            <div className="mb-5 rounded-2xl border border-black/10 bg-white/75 p-4 text-sm leading-6 text-[#5f6779]">
              Keep the prompt exactly as it appears in the source post or in your provided text. The public card will truncate long text, but the detail page preserves the full original prompt.
            </div>

            <section className="mb-6 rounded-3xl border border-black/10 bg-[#f8fbff] p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block">
                  <span className="text-sm font-medium text-[#5f6779]">X Post URL</span>
                  <input
                    value={xUrl}
                    onChange={(event) => setXUrl(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                    placeholder="https://x.com/creator/status/..."
                  />
                </label>
                <AppButton onClick={parseXLink} disabled={!token || parsingX || !xUrl.trim()}>
                  {parsingX ? "Parsing..." : "Parse X Link"}
                </AppButton>
              </div>
              {xCandidate ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">
                        {xCandidate.authorName} @{xCandidate.authorHandle}
                      </p>
                      <p className="mt-1 text-xs text-[#667084]">
                        {formatDate(xCandidate.createdAt)} / {xCandidate.likeCount.toLocaleString()} likes
                      </p>
                    </div>
                    <a href={xCandidate.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#1d4f91]">
                      Open on X
                    </a>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {xCandidate.media.map((media, index) => (
                      <div
                        key={media.url}
                        className={`rounded-2xl border bg-white p-2 ${
                          form.imageUrl === media.url ? "border-[#0071e3] ring-2 ring-[#0071e3]/20" : "border-black/10"
                        }`}
                      >
                        <button type="button" onClick={() => applyCandidate(xCandidate, media.url)} className="block w-full overflow-hidden rounded-xl">
                          <img src={media.url} alt="X media option" className="h-32 w-full rounded-xl object-cover" />
                        </button>
                        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#4f596b]">
                          <input
                            type="checkbox"
                            checked={Boolean(xMediaDrafts[media.url]?.selected)}
                            onChange={(event) => updateMediaDraft(media.url, { selected: event.target.checked })}
                          />
                          Save image {index + 1}
                        </label>
                        <input
                          value={xMediaDrafts[media.url]?.title || mediaTitle(xCandidate, index)}
                          onChange={(event) => updateMediaDraft(media.url, { title: event.target.value })}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-2 text-xs outline-none focus:border-[#77a8e8]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              {editingItem ? (
                <div className="md:col-span-2 rounded-2xl border border-[#74c69d]/40 bg-[#edf9f1] px-4 py-3 text-sm text-[#197a46]">
                  Editing <span className="font-semibold">{editingItem.title}</span>. Saving will update this gallery item.
                </div>
              ) : null}
              <label className="block">
                <span className="text-sm text-[#5f6779]">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="Luxury product visual"
                />
              </label>
              <label className="block">
                <span className="text-sm text-[#5f6779]">Category</span>
                <select
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#5f6779]">Image URL</span>
                <input
                  value={form.imageUrl}
                  onChange={(event) => updateField("imageUrl", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="https://..."
                />
              </label>
              <label className="block">
                <span className="text-sm text-[#5f6779]">Thumbnail URL</span>
                <input
                  value={form.thumbnailUrl}
                  onChange={(event) => updateField("thumbnailUrl", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm text-[#5f6779]">Prompt</span>
              <textarea
                rows={8}
                value={form.prompt}
                onChange={(event) => updateField("prompt", event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-4 outline-none focus:border-[#77a8e8]"
                placeholder="Paste the prompt or instruction from the source post..."
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm text-[#5f6779]">Model</span>
                <input
                  value={form.model}
                  onChange={(event) => updateField("model", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                />
              </label>
              <label className="block">
                <span className="text-sm text-[#5f6779]">Aspect Ratio</span>
                <input
                  value={form.aspectRatio}
                  onChange={(event) => updateField("aspectRatio", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="4:5"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-[#5f6779]">Width</span>
                  <input
                    value={form.width}
                    onChange={(event) => updateField("width", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                    placeholder="1536"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-[#5f6779]">Height</span>
                  <input
                    value={form.height}
                    onChange={(event) => updateField("height", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                    placeholder="1920"
                  />
                </label>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-sm text-[#5f6779]">Source Date</span>
              <input
                value={form.publishedAt}
                onChange={(event) => updateField("publishedAt", event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                placeholder="Auto-filled from X"
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#5f6779]">Author Name</span>
                <input
                  value={form.authorName}
                  onChange={(event) => updateField("authorName", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="text-sm text-[#5f6779]">Author Handle</span>
                <input
                  value={form.authorHandle}
                  onChange={(event) => updateField("authorHandle", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="@creator"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[0.35fr_0.65fr]">
              <label className="block">
                <span className="text-sm text-[#5f6779]">Source Platform</span>
                <input
                  value={form.sourcePlatform}
                  onChange={(event) => updateField("sourcePlatform", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                />
              </label>
              <label className="block">
                <span className="text-sm text-[#5f6779]">Source URL</span>
                <input
                  value={form.sourceUrl}
                  onChange={(event) => updateField("sourceUrl", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-3 outline-none focus:border-[#77a8e8]"
                  placeholder="https://x.com/..."
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#4f596b]">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) => updateField("isFeatured", event.target.checked)}
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-[#4f596b]">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => updateField("isPublished", event.target.checked)}
                />
                Published
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <AppButton onClick={submitItem} disabled={!token || saving || loading}>
                {saving ? "Saving..." : editingItem ? "Update Gallery Item" : "Save Gallery Item"}
              </AppButton>
              {xCandidate && xCandidate.media.length > 1 ? (
                <AppButton variant="secondary" onClick={saveSelectedImages} disabled={!token || saving || loading}>
                  Save Selected Images
                </AppButton>
              ) : null}
              <AppButton
                variant="secondary"
                onClick={() => {
                  setEditingItem(null);
                  setForm(initialForm);
                }}
                disabled={saving}
              >
                {editingItem ? "Cancel Edit" : "Reset"}
              </AppButton>
            </div>
          </article>

          <aside className="space-y-5">
            <article className="card rounded-3xl p-5">
              <h2 className="text-xl font-semibold tracking-tight">Preview</h2>
              {form.imageUrl ? (
                <img src={form.thumbnailUrl || form.imageUrl} alt="Preview" className="mt-4 max-h-[520px] w-full rounded-2xl bg-[#eef2f7] object-contain" />
              ) : (
                <p className="mt-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
                  Paste an image URL to preview it here.
                </p>
              )}
              <p className="mt-4 text-sm font-semibold">{form.title || "Untitled item"}</p>
              <p className="mt-1 line-clamp-4 text-xs leading-5 text-[#667084]">{form.prompt || "Prompt preview..."}</p>
            </article>

            <article className="card rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Recent</h2>
                <Link href="/gallery" className="text-sm font-semibold text-[#1d1d1f]">
                  Public Gallery
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {recentItems.length ? (
                  recentItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border border-black/10 bg-white p-2 hover:bg-[#f8fbff]"
                    >
                      <Link href={galleryItemPath(item)}>
                        <img src={item.thumbnailUrl || item.imageUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover" />
                      </Link>
                      <div className="min-w-0">
                        <Link href={galleryItemPath(item)} className="truncate text-sm font-semibold hover:underline">
                          {item.title}
                        </Link>
                        <p className="mt-1 text-xs text-[#667084]">{item.category}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f1f6ff]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            className="rounded-full border border-[#e5a3a3]/60 px-3 py-1 text-xs font-semibold text-[#a53439] hover:bg-[#fff1f1]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
                    No recent items loaded.
                  </p>
                )}
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}
