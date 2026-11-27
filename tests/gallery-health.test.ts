import assert from "node:assert/strict";
import test from "node:test";
import { filterReachableGalleryRows } from "../src/lib/gallery-health";
import type { GalleryRow } from "../src/lib/gallery";

function row(id: string, image_url: string): GalleryRow {
  return {
    id,
    title: `Title ${id}`,
    category: "Daily Life",
    image_url,
    thumbnail_url: null,
    prompt: "Prompt",
    model: "GPT Image 2",
    author_name: null,
    author_handle: null,
    source_platform: null,
    source_url: "",
    aspect_ratio: null,
    width: null,
    height: null,
    is_featured: false,
    published_at: null,
    created_at: null
  };
}

test("filterReachableGalleryRows drops 403/404/410 dead posts and backfills from later healthy rows", async () => {
  const rows = [
    row("ok-1", "https://pbs.twimg.com/media/ok1.jpg"),
    row("deleted-403", "https://pbs.twimg.com/media/dead403.jpg"),
    row("deleted-404", "https://pbs.twimg.com/media/dead404.jpg"),
    row("local", "/images/sample.webp"),
    row("ok-2", "https://pbs.twimg.com/media/ok2.jpg")
  ];

  const statuses: Record<string, number> = {
    "https://pbs.twimg.com/media/ok1.jpg": 200,
    "https://pbs.twimg.com/media/dead403.jpg": 403,
    "https://pbs.twimg.com/media/dead404.jpg": 404,
    "https://pbs.twimg.com/media/ok2.jpg": 200
  };

  const kept = await filterReachableGalleryRows(rows, {
    limit: 3,
    probeFetch: async (url) => ({ status: statuses[url] ?? 200 })
  });

  assert.deepEqual(
    kept.map((item) => item.id),
    ["ok-1", "local", "ok-2"]
  );
});

test("filterReachableGalleryRows fails open on transient network errors", async () => {
  const rows = [row("timeout-1", "https://pbs.twimg.com/media/slow.jpg")];
  const kept = await filterReachableGalleryRows(rows, {
    limit: 8,
    probeFetch: async () => {
      throw new Error("timeout");
    }
  });
  assert.deepEqual(kept.map((item) => item.id), ["timeout-1"]);
});
