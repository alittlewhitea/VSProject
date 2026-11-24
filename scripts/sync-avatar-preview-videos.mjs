import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    limit: 200,
    concurrency: 3,
    seconds: 5,
    width: 480,
    baseUrl: "https://media.dreamface.io/avatar-previews",
    prefix: "avatar-previews",
    manifestPath: "public/data/avatar-preview-videos.json",
    outDir: "",
    writeManifest: false,
    force: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--write-manifest") args.writeManifest = true;
    else if (arg === "--force") args.force = true;
    else if (arg.startsWith("--limit=")) args.limit = Math.max(1, Number.parseInt(arg.slice(8), 10) || 200);
    else if (arg.startsWith("--concurrency=")) args.concurrency = Math.min(8, Math.max(1, Number.parseInt(arg.slice(14), 10) || 3));
    else if (arg.startsWith("--seconds=")) args.seconds = Math.min(10, Math.max(2, Number.parseInt(arg.slice(10), 10) || 5));
    else if (arg.startsWith("--width=")) args.width = Math.min(720, Math.max(240, Number.parseInt(arg.slice(8), 10) || 480));
    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.slice(11).replace(/\/+$/, "");
    else if (arg.startsWith("--prefix=")) args.prefix = arg.slice(9).replace(/^\/+|\/+$/g, "");
    else if (arg.startsWith("--out-dir=")) args.outDir = arg.slice(10);
    else if (arg.startsWith("--manifest=")) args.manifestPath = arg.slice(11);
  }
  return args;
}

function createR2Client() {
  const accountId = (process.env.R2_MEDIA_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "").trim();
  const bucket = (process.env.R2_MEDIA_BUCKET_NAME || "").trim();
  const accessKeyId = (process.env.R2_MEDIA_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_MEDIA_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "").trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });
  return { client, bucket };
}

async function fetchFirstLookPreviewVideoUrl(apiKey, groupId) {
  const params = new URLSearchParams({ ownership: "public", limit: "3", group_id: groupId });
  const response = await fetch(`https://api.heygen.com/v3/avatars/looks?${params}`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  for (const row of rows) {
    if (typeof row?.preview_video_url === "string" && row.preview_video_url.startsWith("https://")) {
      return row.preview_video_url;
    }
  }
  return null;
}

async function fetchPublicAvatarGroups(apiKey, limit) {
  const groups = [];
  const seen = new Set();
  let token = null;
  while (groups.length < limit) {
    const params = new URLSearchParams({ ownership: "public", limit: "50" });
    if (token) params.set("token", token);
    const response = await fetch(`https://api.heygen.com/v3/avatars?${params}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`HeyGen API failed with status ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      groups.push({
        id: String(row.id),
        name: String(row.name || row.id),
        previewVideoUrl: typeof row.preview_video_url === "string" && row.preview_video_url.startsWith("https://")
          ? row.preview_video_url
          : null
      });
      if (groups.length >= limit) break;
    }
    if (!payload?.has_more || !payload?.next_token || payload.next_token === token) break;
    token = payload.next_token;
  }
  return groups;
}

async function transcodePreview(ffmpegPath, sourceUrl, outputPath, { seconds, width }) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp.mp4`;
  try {
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-hide_banner",
        "-loglevel", "error",
        "-rw_timeout", "20000000",
        "-t", String(seconds),
        "-i", sourceUrl,
        "-an",
        "-sn",
        "-dn",
        "-vf", `scale='min(${width},iw)':-2:flags=lanczos,fps=24`,
        "-c:v", "libx264",
        "-profile:v", "main",
        "-pix_fmt", "yuv420p",
        "-preset", "medium",
        "-crf", "28",
        "-maxrate", "900k",
        "-bufsize", "1800k",
        "-movflags", "+faststart",
        tempPath
      ],
      { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 }
    );
    const bytes = statSync(tempPath).size;
    if (bytes < 4096) throw new Error(`Transcoded output too small (${bytes} bytes)`);
    if (existsSync(outputPath)) rmSync(outputPath, { force: true });
    writeFileSync(outputPath, readFileSync(tempPath));
    rmSync(tempPath, { force: true });
    return bytes;
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

async function existsInR2(r2, key) {
  try {
    await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadToR2(r2, key, filePath) {
  const body = readFileSync(filePath);
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: body,
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable"
    })
  );
  return body.length;
}

async function main() {
  const root = process.cwd();
  loadEnvFile(join(root, ".env.local"));
  const args = parseArgs(process.argv.slice(2));
  const apiKey = (process.env.HEYGEN_API_KEY || "").trim();
  if (!apiKey) throw new Error("HEYGEN_API_KEY is required.");

  const ffmpegPath = (process.env.FFMPEG_PATH || "ffmpeg").trim();
  const r2 = createR2Client();
  if (!r2 && !args.outDir) {
    throw new Error(
      "Set R2_MEDIA_ACCOUNT_ID (or R2_ACCOUNT_ID), R2_MEDIA_BUCKET_NAME, R2_MEDIA_ACCESS_KEY_ID, R2_MEDIA_SECRET_ACCESS_KEY to upload directly to R2, or pass --out-dir=<path> to export transcoded MP4s locally."
    );
  }

  console.log(`Fetching up to ${args.limit} public HeyGen avatar groups...`);
  const groups = await fetchPublicAvatarGroups(apiKey, args.limit);
  const missingVideoGroups = groups.filter((group) => !group.previewVideoUrl);
  if (missingVideoGroups.length > 0) {
    console.log(`Resolving first look previewVideoUrl for ${missingVideoGroups.length} groups without group-level video...`);
    let lookCursor = 0;
    await Promise.all(Array.from({ length: Math.min(6, missingVideoGroups.length) }, async () => {
      while (lookCursor < missingVideoGroups.length) {
        const group = missingVideoGroups[lookCursor++];
        try {
          group.previewVideoUrl = await fetchFirstLookPreviewVideoUrl(apiKey, group.id);
        } catch {
          group.previewVideoUrl = null;
        }
      }
    }));
  }
  const targets = groups.filter((group) => Boolean(group.previewVideoUrl));
  console.log(`Found ${groups.length} groups (${targets.length} with previewVideoUrl).`);

  const manifestFile = resolve(root, args.manifestPath);
  const existingManifest = existsSync(manifestFile)
    ? JSON.parse(readFileSync(manifestFile, "utf8"))
    : { version: 1, baseUrl: args.baseUrl, items: {} };
  const items = { ...(existingManifest.items || {}) };

  const workDir = args.outDir ? resolve(root, args.outDir, args.prefix) : join(tmpdir(), `dreamface-avatar-previews-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  let cursor = 0;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;

  async function worker() {
    while (cursor < targets.length) {
      const index = cursor++;
      const target = targets[index];
      const fileName = `${target.id}.mp4`;
      const r2Key = `${args.prefix}/${fileName}`;
      const localPath = join(workDir, fileName);

      try {
        if (r2) {
          if (!args.force && await existsInR2(r2, r2Key)) {
            items[target.id] = fileName;
            skipped++;
            console.log(`[${index + 1}/${targets.length}] SKIP (R2 exists) ${target.name} (${target.id})`);
            continue;
          }
          const bytes = await transcodePreview(ffmpegPath, target.previewVideoUrl, localPath, args);
          await uploadToR2(r2, r2Key, localPath);
          if (!args.outDir) rmSync(localPath, { force: true });
          items[target.id] = fileName;
          uploaded++;
          totalBytes += bytes;
          console.log(`[${index + 1}/${targets.length}] UPLOADED ${target.name}: ${(bytes / 1024).toFixed(1)} KB -> ${args.baseUrl}/${fileName}`);
        } else {
          if (!args.force && existsSync(localPath) && statSync(localPath).size >= 4096) {
            const bytes = statSync(localPath).size;
            items[target.id] = fileName;
            skipped++;
            totalBytes += bytes;
            console.log(`[${index + 1}/${targets.length}] SKIP (local exists) ${target.name}: ${(bytes / 1024).toFixed(1)} KB`);
            continue;
          }
          const bytes = await transcodePreview(ffmpegPath, target.previewVideoUrl, localPath, args);
          items[target.id] = fileName;
          uploaded++;
          totalBytes += bytes;
          console.log(`[${index + 1}/${targets.length}] EXPORTED ${target.name}: ${(bytes / 1024).toFixed(1)} KB -> ${localPath}`);
        }
      } catch (error) {
        failed++;
        console.error(`[${index + 1}/${targets.length}] FAILED ${target.name} (${target.id}):`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));

  if (!args.outDir) rmSync(workDir, { recursive: true, force: true });

  const sortedItems = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b, "en")));
  const nextManifest = { version: 1, baseUrl: args.baseUrl, items: sortedItems };

  if (r2 || args.writeManifest) {
    mkdirSync(dirname(manifestFile), { recursive: true });
    writeFileSync(manifestFile, JSON.stringify(nextManifest, null, 2) + "\n", "utf8");
    console.log(`Updated manifest: ${manifestFile} (${Object.keys(sortedItems).length} entries)`);
  } else {
    console.log(`Local export complete in ${workDir}. Upload the '${args.prefix}' folder to ${args.baseUrl}, then re-run with --write-manifest (or upload directly with R2 credentials).`);
  }

  console.log(`Summary: processed=${uploaded}, skipped=${skipped}, failed=${failed}, totalSize=${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  if (failed > 0 && uploaded === 0 && skipped === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
