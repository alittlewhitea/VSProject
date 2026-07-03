import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function contentTypeFor(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".avif") return "image/avif";
  return "application/octet-stream";
}

function safeResolve(root: string, parts: string[]) {
  const target = path.resolve(root, ...parts);
  const resolvedRoot = path.resolve(root);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) return null;
  return target;
}

export async function GET(
  _request: Request,
  context: { params: { bucket: string; path?: string[] } }
) {
  const bucket = context.params.bucket;
  const objectPath = context.params.path || [];
  if (!/^[a-z0-9_-]+$/i.test(bucket) || !objectPath.length) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const roots = [
    path.join(process.cwd(), ".data", "uploads", bucket),
    path.join(process.cwd(), "public", "uploads", bucket),
    path.join(process.cwd(), ".next", "standalone", "public", "uploads", bucket)
  ];

  for (const root of roots) {
    const target = safeResolve(root, objectPath);
    if (!target) continue;
    try {
      const file = await readFile(target);
      return new Response(file, {
        headers: {
          "Content-Type": contentTypeFor(target),
          "Cache-Control": "public, max-age=3600"
        }
      });
    } catch {
      // Try the next compatible storage location.
    }
  }

  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
