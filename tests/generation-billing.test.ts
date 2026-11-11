import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avatarAudioBillableSeconds,
  normalizeBillableRequest,
  wavDataUrlSeconds,
  type BillableRequest
} from "../src/lib/generation-billing-normalize";
import { estimateGenerationCredits, type PricingMode } from "../src/lib/model-pricing";

const generateRoute = readFileSync(join(__dirname, "..", "..", "src/app/api/generate/route.ts"), "utf8");

function credits(body: BillableRequest) {
  return estimateGenerationCredits({
    mode: (body.mode === "avatar" ? "video" : body.mode) as PricingMode,
    provider: body.provider,
    duration: body.duration,
    resolution: body.resolution,
    imageSize: body.imageSize
  });
}

function normalized(body: BillableRequest) {
  return normalizeBillableRequest({ ...body });
}

const video = (provider: string, duration: string, resolution?: string): BillableRequest =>
  ({ mode: "video", provider, duration, ratio: "16:9", resolution });

test("out-of-range durations are billed at the length actually generated", () => {
  // Payload rules in /api/generate: invalid input falls back to these lengths.
  const cases: Array<[string, string, string]> = [
    ["veo-video", "1s", "8s"],
    ["kling-video", "1s", "5s"],
    ["seedance-video", "1s", "5s"],
    ["seedance-mini-video", "99s", "5s"],
    ["happy-horse-video", "1s", "5s"],
    ["grok-video", "0s", "5s"],
    ["minimax-h3-max-video", "20s", "15s"],
    ["minimax-h3-max-video", "abc", "5s"],
    ["minimax-h3-max-turbo-video", "2s", "5s"],
    ["flux-3-max-video", "1s", "5s"]
  ];
  for (const [provider, sent, generated] of cases) {
    const body = normalized(video(provider, sent));
    assert.equal(body.duration, generated, `${provider} ${sent}`);
  }
  const veoExploit = normalized(video("veo-video", "1s", "720p"));
  assert.equal(credits(veoExploit), credits(video("veo-video", "8s", "720p")), "Veo 1s now costs the same as the 8s it generates");
  assert.ok(credits(veoExploit) > credits(video("veo-video", "1s", "720p")), "previous under-charge is closed");
});

test("unsupported resolutions are billed at the resolution actually generated", () => {
  assert.equal(normalized(video("minimax-h3-max-video", "5s", "4k")).resolution, "480p");
  assert.equal(normalized(video("grok-video", "5s", "8k")).resolution, "480p");
  assert.equal(normalized(video("happy-horse-video", "5s", "480p")).resolution, "720p");
  assert.equal(normalized(video("flux-3-max-video", "5s", "480p")).resolution, "720p");
  assert.equal(normalized(video("kling-video", "5s", "480p")).resolution, undefined);
  assert.equal(normalized({ mode: "image", provider: "nano-banana-pro", duration: "", ratio: "1:1", resolution: "4k" }).resolution, "1K");
});

test("valid requests from the studio keep exactly the same price", () => {
  const valid: BillableRequest[] = [
    video("veo-video", "4s", "720p"), video("veo-video", "8s", "4k"),
    video("kling-video", "10s", "720p"),
    video("seedance-video", "6s", "1080p"), video("seedance-mini-video", "5s", "720p"),
    video("happy-horse-video", "8s", "1080p"),
    video("grok-video", "6s", "720p"),
    video("minimax-h3-max-video", "10s", "768p"), video("minimax-h3-max-turbo-video", "5s", "480p"),
    video("flux-3-max-video", "12s", "1080p"),
    { mode: "image", provider: "nano-banana-image", duration: "", ratio: "1:1", resolution: "2K" },
    { mode: "image", provider: "flux-dev", duration: "", ratio: "16:9", imageSize: "landscape_16_9" }
  ];
  for (const body of valid) {
    assert.equal(credits(normalized(body)), credits(body), `${body.provider} ${body.duration} ${body.resolution ?? body.imageSize ?? ""}`);
  }
});

test("normalization is idempotent", () => {
  const once = normalized(video("veo-video", "1s", "bogus"));
  assert.deepEqual(normalized(once), once);
});

test("FLUX image size is billed from the size actually sent to the provider", () => {
  const body = normalized({ mode: "image", provider: "flux-dev", duration: "", ratio: "1:1" });
  assert.equal(body.imageSize, "square_hd");
});

function wavDataUrl(seconds: number, sampleRate = 8000, declaredSeconds = seconds) {
  const dataSize = Math.round(seconds * sampleRate) * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(Math.round(declaredSeconds * sampleRate) * 2, 40);
  return `data:audio/wav;base64,${buffer.toString("base64")}`;
}

test("avatar audio is billed by its measured length", () => {
  assert.equal(wavDataUrlSeconds(wavDataUrl(6)), 6);
  assert.deepEqual(avatarAudioBillableSeconds(wavDataUrl(6), 15), { seconds: 6 });
  assert.deepEqual(avatarAudioBillableSeconds(wavDataUrl(6.4), 15), { seconds: 7 });
  assert.ok("error" in avatarAudioBillableSeconds(wavDataUrl(20), 15), "audio over the limit is rejected");
});

test("an inflated WAV header cannot claim more audio than is present", () => {
  assert.equal(wavDataUrlSeconds(wavDataUrl(2, 8000, 60)), null);
});

test("WAV byteRate and sample format cannot be forged to underbill", () => {
  const original = wavDataUrl(12), bytes = Buffer.from(original.split(",")[1], "base64");
  bytes.writeUInt32LE(8000 * 2 * 12, 28);
  const forged = `data:audio/wav;base64,${bytes.toString("base64")}`;
  assert.equal(wavDataUrlSeconds(forged), null);
  assert.ok("error" in avatarAudioBillableSeconds(forged, 15));
});

test("remote and compressed audio require server verification instead of maximum-price fallback", () => {
  assert.ok("error" in avatarAudioBillableSeconds("https://example.com/voice.mp3", 15));
  assert.ok("error" in avatarAudioBillableSeconds("data:audio/mpeg;base64,SUQz", 15));
});

test("generate route normalizes before pricing and bills avatar audio", () => {
  const normalizeAt = generateRoute.indexOf("normalizeBillableRequest(body);");
  const priceAt = generateRoute.indexOf("const baseEstimatedCredits");
  assert.ok(normalizeAt > 0 && normalizeAt < priceAt, "normalization runs before the credit estimate");
  assert.match(generateRoute, /prepareAvatarAudio\(admin, user\.id, userAudio, AVATAR_MAX_SECONDS\)/);
  assert.doesNotMatch(generateRoute, /^const (VEO_VIDEO_DURATIONS|MINIMAX_H3_MAX_VIDEO_RESOLUTIONS) =/m, "value sets have one definition");
});
