import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { ownStudioMediaId, readStudioVideo, StudioMediaError } from "./r2-studio-media";
import { validTopazVideoMetadata, type TopazVideoMetadata, type TopazVideoSource } from "./topaz-video-upscale";

const run = promisify(execFile);
const activeInspections = new Set<string>();

function signature(userId: string, id: string, expires: number, info: TopazVideoMetadata) {
  const secret = process.env.AUTH_SESSION_SECRET?.trim() || process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!secret) throw new StudioMediaError("Video verification is unavailable.", 503);
  return createHmac("sha256", secret).update(JSON.stringify([
    "topaz-video-metadata", userId, id, expires, info.width, info.height, info.duration, info.fps
  ])).digest("hex");
}

export function verifyTopazVideoSource(userId: string, url: string, value: unknown) {
  const id = ownStudioMediaId(url);
  if (!id || !value || typeof value !== "object") throw invalidSource();
  const source = value as TopazVideoMetadata & { proof?: string };
  if (!validTopazVideoMetadata(source) || typeof source.proof !== "string") throw invalidSource();
  const proof = /^(\d{13})\.([a-f0-9]{64})$/.exec(source.proof);
  if (!proof || Number(proof[1]) <= Date.now()) throw invalidSource();
  const { width, height, duration, fps } = source;
  const metadata = { width, height, duration, fps };
  const expected = signature(userId, id, Number(proof[1]), metadata);
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(proof[2], "hex"))) throw invalidSource();
  return metadata;
}

function invalidSource() {
  return new StudioMediaError("Select your video again to check its duration and price.", 400);
}

function parseFps(value: string | undefined) {
  const [numerator, denominator] = (value || "").split("/").map(Number);
  return numerator / (denominator ?? 1);
}

export async function inspectTopazVideo(userId: string, url: string): Promise<TopazVideoSource> {
  const id = ownStudioMediaId(url);
  if (!id) throw invalidSource();
  if (activeInspections.has(userId) || activeInspections.size >= 3) {
    throw new StudioMediaError("Video checks are busy. Try again shortly.", 429);
  }
  activeInspections.add(userId);
  let directory: string | undefined;
  try {
    directory = await mkdtemp(path.join(tmpdir(), "dreamface-topaz-"));
    const input = path.join(directory, "source");
    await pipeline(await readStudioVideo(userId, id), createWriteStream(input, { flags: "wx" }), {
      signal: AbortSignal.timeout(45_000)
    });
    const { stdout } = await run(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
      "-v", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm",
      "-select_streams", "v:0", "-show_entries",
      "format=duration:stream=width,height,avg_frame_rate,r_frame_rate,duration:stream_side_data=rotation",
      "-of", "json", input
    ], { timeout: 12_000, maxBuffer: 32_768, windowsHide: true });
    const data = JSON.parse(stdout);
    const stream = data.streams?.[0];
    const durations = [data.format?.duration, stream?.duration].map(Number).filter(Number.isFinite);
    const rotation = Number(stream?.side_data_list?.[0]?.rotation || 0);
    const portrait = Math.abs(rotation) % 180 === 90;
    const info = {
      width: Number(portrait ? stream?.height : stream?.width),
      height: Number(portrait ? stream?.width : stream?.height),
      duration: Math.max(...durations),
      fps: parseFps(stream?.avg_frame_rate) || parseFps(stream?.r_frame_rate)
    };
    if (!validTopazVideoMetadata(info)) throw new StudioMediaError("Choose a readable video up to 5 minutes long.", 400);
    const expires = Date.now() + 8 * 60 * 60 * 1000;
    return { url, ...info, proof: `${expires}.${signature(userId, id, expires, info)}` };
  } catch (error) {
    if (error instanceof StudioMediaError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StudioMediaError("Video verification is temporarily unavailable.", 503);
    throw new StudioMediaError("This video could not be inspected. Choose an MP4, MOV or WebM file and try again.", 400);
  } finally {
    activeInspections.delete(userId);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => null);
  }
}
