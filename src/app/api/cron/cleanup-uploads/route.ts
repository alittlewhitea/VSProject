import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cronAuthorized } from "../../../../lib/cron-auth";

export const dynamic = "force-dynamic";

const DEFAULT_RETENTION_DAYS = 7;

function retentionDays() {
  const value = Number(process.env.UPLOAD_CLEANUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RETENTION_DAYS;
}

async function cleanupDirectory(root: string, cutoffMs: number) {
  let scanned = 0;
  let deletedFiles = 0;
  let deletedDirs = 0;

  async function walk(directory: string) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const emptyAfterCleanup = await walk(target);
        if (emptyAfterCleanup && target !== root) {
          await rm(target, { recursive: true, force: true }).catch(() => null);
          deletedDirs += 1;
        }
        continue;
      }

      if (!entry.isFile()) continue;
      scanned += 1;
      const info = await stat(target).catch(() => null);
      if (info && info.mtimeMs < cutoffMs) {
        await rm(target, { force: true }).catch(() => null);
        deletedFiles += 1;
      }
    }

    const remaining = await readdir(directory).catch(() => []);
    return remaining.length === 0;
  }

  await walk(root);
  return { scanned, deletedFiles, deletedDirs };
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const days = retentionDays();
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const roots = [
    path.join(process.cwd(), ".data", "uploads", "generation-inputs"),
    path.join(process.cwd(), "public", "uploads", "generation-inputs")
  ];

  const results = [];
  for (const root of roots) {
    const result = await cleanupDirectory(root, cutoffMs);
    results.push({ root, ...result });
  }

  return NextResponse.json({
    ok: true,
    retentionDays: days,
    results
  });
}
