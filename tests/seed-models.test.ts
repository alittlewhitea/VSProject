import assert from "node:assert/strict";
import { test } from "node:test";
import { SEEDANCE_FLASH_PROVIDER, seedanceFlashEndpoint, seedanceFlashError, seedanceFlashValidationKey, seedanceFlashNoticeKeys, buildSeedanceFlashInput, parseReferenceMediaUrls } from "../src/lib/seedance-flash";
import { SEEDREAM_55_PROVIDER, seedream55Endpoint, seedream55Error, buildSeedream55Input } from "../src/lib/seedream-55";
import { estimateGenerationCostUsd, estimateGenerationCredits, MODEL_PRICING_ROWS } from "../src/lib/model-pricing";
import { VIDEO_PROVIDERS_BY_WORKFLOW, videoModelDurations, videoModelRatios } from "../src/features/studio/video-models";
import { videoSupportsEndFrame } from "../src/lib/video-keyframes";
import { CREDIT_PACK_PRICES } from "../src/lib/credit-pack-prices";
import { seedModelCreditsFromCostUsd } from "../src/lib/seed-model-pricing";
import { falActualCreditsFromCost, falRefundCreditsFromCost } from "../src/lib/fal-errors";

const image = "https://media.example.com/image.png", video = "https://media.example.com/input.mp4", audio = "https://media.example.com/input.wav";
const flash = { mode: "video" as const, provider: SEEDANCE_FLASH_PROVIDER, videoWorkflow: "text-to-video" as const, prompt: "A bird in flight", duration: "5s", ratio: "16:9", resolution: "720p" };
const dream = { mode: "image" as const, provider: SEEDREAM_55_PROVIDER, imageWorkflow: "text-to-image", prompt: "A blue vase", imageSize: "auto_2K", outputFormat: "png" };
const quotedCredits = (cost: number) => Math.ceil(cost / ((49.99 / 11000) * 0.75) - 1e-9);

function assertMargin(cost: number, credits: number) {
  for (const pack of Object.values(CREDIT_PACK_PRICES)) {
    const revenue = credits * pack.amountCents / 100 / pack.credits;
    assert.ok(revenue * 0.95 - cost >= revenue * 0.20 - 1e-9, "Every paid pack retains at least 20% after the 5% fee budget and estimated supplier cost");
  }
}

test("Seed prices use the cheapest paid pack with a 20% margin and 5% fee allowance", () => {
  for (const [cost, credits] of [[0.721, 212], [1.547, 454], [0.03, 9], [0.0405, 12]]) {
    assert.equal(seedModelCreditsFromCostUsd(cost), credits);
    assertMargin(cost, credits);
  }
  assert.equal(estimateGenerationCredits({ ...flash, resolution: "480p" }), 212);
  assert.equal(estimateGenerationCredits(flash), 454);
  assert.equal(estimateGenerationCredits({ ...dream, imageSize: "auto_1K" }), 9);
  assert.equal(estimateGenerationCredits({ ...dream, imageSize: "auto_1.5K" }), 9);
  assert.equal(estimateGenerationCredits(dream), 12);
  assert.throws(() => seedModelCreditsFromCostUsd(1, 0.95));
  assert.throws(() => seedModelCreditsFromCostUsd(1, -0.1));
});

test("Seed failure refunds recover verified supplier cost and fee allowance without retaining a profit margin", () => {
  for (const [provider, cost, quoted, retained] of [[SEEDANCE_FLASH_PROVIDER, 0.721, 212, 168], [SEEDANCE_FLASH_PROVIDER, 1.547, 454, 359], [SEEDREAM_55_PROVIDER, 0.03, 9, 7], [SEEDREAM_55_PROVIDER, 0.0405, 12, 10]] as const) {
    assert.equal(falActualCreditsFromCost(cost, quoted, provider), retained);
    assert.equal(falRefundCreditsFromCost(cost, quoted, provider), quoted - retained);
    assert.equal(falRefundCreditsFromCost(0, quoted, provider), quoted);
    assert.equal(falRefundCreditsFromCost(null, quoted, provider), quoted, "Preserve the existing missing-cost refund policy");
    assert.equal(falActualCreditsFromCost(cost * 10, quoted, provider), quoted, "Never charge above the original quote");
  }
});

test("Flash missing-input messages describe the current workflow instead of requiring a reference video", () => {
  assert.equal(seedanceFlashValidationKey({ ...flash, prompt: "" }), "studio.seedance.validation.prompt");
  assert.equal(seedanceFlashValidationKey({ ...flash, videoWorkflow: "image-to-video", ratio: "source", prompt: "", imageUrls: [] }), "studio.seedance.validation.startImage");
  assert.equal(seedanceFlashValidationKey({ ...flash, videoWorkflow: "image-to-video", ratio: "source", prompt: "", imageUrls: [image] }), null);
  assert.equal(seedanceFlashValidationKey({ ...flash, videoWorkflow: "reference-to-video", seedanceTask: "editing", videoUrls: [] }), "studio.seedance.validation.referenceVideo");
  assert.equal(seedanceFlashValidationKey({ ...flash, resolution: "1080p" }), "studio.seedance.validation.resolution");
});

test("Flash only shows the 30-second estimate and source-ratio notes when applicable", () => {
  assert.deepEqual(seedanceFlashNoticeKeys("text-to-video", "5s", "editing"), ["studio.seedance.quote.selected", "studio.seedance.quote.audio"]);
  assert.deepEqual(seedanceFlashNoticeKeys("image-to-video", "5s", "auto"), ["studio.seedance.quote.selected", "studio.seedance.quote.sourceRatio", "studio.seedance.quote.audio"]);
  assert.ok(seedanceFlashNoticeKeys("text-to-video", "auto").includes("studio.seedance.quote.automatic"));
  assert.ok(seedanceFlashNoticeKeys("image-to-video", "auto").includes("studio.seedance.quote.automatic"));
  for (const task of ["editing", "auto"]) assert.ok(seedanceFlashNoticeKeys("reference-to-video", "5s", task).includes("studio.seedance.quote.automatic"));
  assert.ok(!seedanceFlashNoticeKeys("reference-to-video", "5s", "reference").includes("studio.seedance.quote.automatic"));
});

test("all five endpoints are registered and all three video workflows expose Flash", () => {
  const endpoints = ["text-to-video", "image-to-video", "reference-to-video"].map(seedanceFlashEndpoint).concat([seedream55Endpoint(), seedream55Endpoint(true)]);
  for (const endpoint of endpoints) assert.ok(MODEL_PRICING_ROWS.some(row => row.endpointId === endpoint));
  for (const workflow of ["text-to-video", "image-to-video", "reference-to-video"] as const) assert.ok(VIDEO_PROVIDERS_BY_WORKFLOW[workflow].includes(SEEDANCE_FLASH_PROVIDER));
  assert.equal(videoSupportsEndFrame(SEEDANCE_FLASH_PROVIDER), true);
  assert.ok(videoModelDurations(SEEDANCE_FLASH_PROVIDER).includes("30s"));
  assert.deepEqual(videoModelRatios(SEEDANCE_FLASH_PROVIDER, "image-to-video"), ["source"]);
});

test("Flash payloads use string seconds, native audio, correct media fields and optional end frames", () => {
  assert.equal(seedanceFlashError(flash), null);
  const text = buildSeedanceFlashInput(flash, flash.prompt, "end-user");
  assert.equal(text.duration, "5"); assert.equal(text.generate_audio, true); assert.equal(text.end_user_id, "end-user");
  assert.ok(!("image_url" in text)); assert.ok(!("seed" in text));
  const startEnd = { ...flash, videoWorkflow: "image-to-video", ratio: "source", imageUrls: [image, image + "?end=1"], prompt: "", generateAudio: false };
  assert.equal(seedanceFlashError(startEnd), null);
  const input = buildSeedanceFlashInput(startEnd, "");
  assert.equal(input.aspect_ratio, "auto"); assert.equal(input.end_image_url, image + "?end=1"); assert.equal(input.generate_audio, false);
  assert.ok(!("prompt" in input));
  const reference = { ...flash, videoWorkflow: "reference-to-video", imageUrls: [image], videoUrls: [video], audioUrls: [audio], seedanceTask: "reference", seed: 42, codec: "H265", bitrateMode: "high" };
  assert.equal(seedanceFlashError(reference), null);
  const refs = buildSeedanceFlashInput(reference, flash.prompt);
  assert.deepEqual(refs.image_urls, [image]); assert.deepEqual(refs.video_urls, [video]); assert.deepEqual(refs.audio_urls, [audio]);
  assert.equal(refs.codec, "H265"); assert.equal(refs.bitrate_mode, "high"); assert.equal(refs.seed, 42);
  const editing = buildSeedanceFlashInput({ ...reference, seedanceTask: "editing" }, flash.prompt);
  assert.equal(editing.duration, "auto"); assert.equal(editing.aspect_ratio, "auto");
  assert.deepEqual(parseReferenceMediaUrls(` ${video}\r\n\n${video}?next=1 `), [video, video + "?next=1"]);
});

test("Flash rejects invalid workflow, reference counts, private URLs and unsupported options before submission", () => {
  for (const duration of ["3s", "31s", "5junk", "5.5s"]) assert.ok(seedanceFlashError({ ...flash, duration }));
  assert.ok(seedanceFlashError({ ...flash, mode: "image" }));
  assert.ok(seedanceFlashError({ ...flash, resolution: "1080p" }));
  assert.ok(seedanceFlashError({ ...flash, imageUrls: [image] }));
  assert.ok(seedanceFlashError({ ...flash, videoWorkflow: "image-to-video", imageUrls: [] }));
  const reference = { ...flash, videoWorkflow: "reference-to-video" };
  assert.ok(seedanceFlashError({ ...reference, imageUrls: Array(11).fill(image) }));
  assert.ok(seedanceFlashError({ ...reference, videoUrls: Array(6).fill(video) }));
  assert.ok(seedanceFlashError({ ...reference, audioUrls: Array(6).fill(audio) }));
  assert.ok(seedanceFlashError({ ...reference, videoUrls: ["http://127.0.0.1/private.mp4"] }));
  assert.ok(seedanceFlashError({ ...reference, seedanceTask: "editing" }));
  assert.equal(seedanceFlashError({ ...reference, imageUrls: Array(10).fill(image), videoUrls: Array(5).fill(video), audioUrls: Array(5).fill(audio) }), null);
});

test("Flash quotes match documented resolution rates and never omit reference-video input cost", () => {
  for (const [resolution, rate] of [["480p", 0.1442], ["720p", 0.3094]] as const) {
    for (let seconds = 4; seconds <= 30; seconds++) {
      const request = { ...flash, resolution, duration: `${seconds}s` };
      assert.equal(estimateGenerationCredits(request), quotedCredits(seconds * rate));
      assertMargin(seconds * rate, estimateGenerationCredits(request));
      assert.equal(estimateGenerationCredits({ ...request, seedanceTask: "editing" }), estimateGenerationCredits(request), "Reference task state cannot affect text-to-video quotes");
      assert.equal(estimateGenerationCredits({ ...request, generateAudio: false }), estimateGenerationCredits({ ...request, generateAudio: true }));
      const refs = { ...request, videoWorkflow: "reference-to-video" as const, referenceVideoCount: 1 };
      assert.equal(estimateGenerationCredits(refs), quotedCredits((seconds + 30.2) * rate * 0.614));
      assertMargin((seconds + 30.2) * rate * 0.614, estimateGenerationCredits(refs));
    }
    assert.equal(estimateGenerationCredits({ ...flash, resolution, duration: "auto" }), estimateGenerationCredits({ ...flash, resolution, duration: "30s" }));
    for (const seedanceTask of ["editing", "auto"]) assert.equal(estimateGenerationCredits({ ...flash, resolution, duration: "4s", seedanceTask, videoWorkflow: "reference-to-video", referenceVideoCount: 1 }), quotedCredits(60.2 * rate * 0.614));
  }
});

test("Seedream builds text/edit inputs with transparent PNG and six outputs", () => {
  assert.equal(seedream55Error(dream), null);
  const request = { ...dream, imageWorkflow: "image-to-image", imageUrls: [image, image], numImages: 6, background: "transparent" };
  assert.equal(seedream55Error(request), null);
  const payload = buildSeedream55Input(request, dream.prompt);
  assert.equal(payload.num_images, 6); assert.equal(payload.background, "transparent"); assert.equal(payload.enable_safety_checker, true);
  assert.deepEqual(payload.image_urls, [image, image]); assert.equal(payload.sync_mode, false);
  assert.deepEqual(buildSeedream55Input({ ...dream, imageSize: "custom", imageWidth: 1280, imageHeight: 720 }, dream.prompt).image_size, { width: 1280, height: 720 });
});

test("Seedream validates dimension boundaries, reference limits and transparent output", () => {
  for (const [imageWidth, imageHeight] of [[512, 512], [4096, 4096], [100, 10000], [0, 1024], [1280.5, 720]]) assert.ok(seedream55Error({ ...dream, imageSize: "custom", imageWidth, imageHeight }));
  assert.equal(seedream55Error({ ...dream, imageSize: "custom", imageWidth: 1280, imageHeight: 720 }), null);
  assert.ok(seedream55Error({ ...dream, background: "transparent", outputFormat: "jpeg" }));
  assert.ok(seedream55Error({ ...dream, outputFormat: "webp" }));
  assert.ok(seedream55Error({ ...dream, imageWorkflow: "image-to-image" }));
  assert.ok(seedream55Error({ ...dream, imageUrls: Array(11).fill(image) }));
  assert.ok(seedream55Error({ ...dream, numImages: 7 }));
  assert.ok(seedream55Error({ ...dream, numImages: 1.5 }));
});

test("Seedream bills each input per output, with the correct custom-area threshold and six-image batch", () => {
  for (const [imageSize, outputRate] of [["auto_1K", 0.03], ["auto_1.5K", 0.03], ["auto_2K", 0.0405]] as const) {
    for (let references = 0; references <= 10; references++) for (let numImages = 1; numImages <= 6; numImages++) {
      const request = { ...dream, imageSize, numImages, hasReferences: references > 0, referenceCount: references };
      const expectedUsd = (outputRate + references * 0.012) * numImages;
      assert.ok(Math.abs(estimateGenerationCostUsd(request) - expectedUsd) < 1e-10);
      assert.equal(estimateGenerationCredits(request), quotedCredits(outputRate + references * 0.012) * numImages);
      assertMargin(expectedUsd, estimateGenerationCredits(request));
    }
  }
  assert.equal(estimateGenerationCostUsd({ ...dream, imageSize: "custom", imageWidth: 1800, imageHeight: 1450 }), 0.03);
  assert.equal(estimateGenerationCostUsd({ ...dream, imageSize: "custom", imageWidth: 1800, imageHeight: 1451 }), 0.0405);
});
