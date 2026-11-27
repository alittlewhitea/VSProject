import assert from "node:assert/strict";
import { test } from "node:test";
import { locales } from "../src/i18n/routing";
import { estimateGenerationCredits } from "../src/lib/model-pricing";
import {
  PET_APP_DEFAULT_PROVIDER,
  PET_APP_PROVIDER_IDS,
  PET_SING_DANCE_TEMPLATES,
  estimatePetAppCredits,
  normalizePetAppDuration,
  normalizePetAppResolution,
  petAppDurationsForProvider,
  petAppRatioForProvider,
  petAppResolutionsForProvider
} from "../src/features/studio/studio-apps-catalog";
import { studioAppsCopy } from "../src/features/studio/studio-apps-i18n";
import {
  VIDEO_MODEL_CONFIGS,
  videoModelDurations,
  videoModelRatios,
  videoModelResolutions
} from "../src/features/studio/video-models";
import { uploadStudioDataUrl } from "../src/features/studio/upload-studio-media";

test("Pet Sing & Dance templates cover dance and sing styles with detailed native-audio prompts", () => {
  assert.ok(PET_SING_DANCE_TEMPLATES.length >= 16);
  const categories = new Set(PET_SING_DANCE_TEMPLATES.map((item) => item.category));
  assert.deepEqual([...categories].sort(), ["dance", "sing"]);

  const ids = new Set<string>();
  for (const template of PET_SING_DANCE_TEMPLATES) {
    assert.ok(!ids.has(template.id), `duplicate template id: ${template.id}`);
    ids.add(template.id);
    assert.ok(template.prompt.length >= 220, `template ${template.id} prompt should be richly detailed`);
    assert.match(template.prompt, /audio/i, `template ${template.id} prompt should describe synchronized audio`);
    assert.match(template.prompt, /pet/i, `template ${template.id} prompt should preserve the uploaded pet`);
    assert.equal(
      template.coverUrl,
      `https://media.dreamface.io/apps/pet-sing-dance/${template.id}.webp`,
      `template ${template.id} coverUrl should point to Cloudflare R2 media CDN`
    );
  }
});

test("Pet Sing & Dance providers match active image-to-video capabilities and pricing", () => {
  assert.ok(PET_APP_PROVIDER_IDS.includes(PET_APP_DEFAULT_PROVIDER));

  for (const provider of PET_APP_PROVIDER_IDS) {
    const config = VIDEO_MODEL_CONFIGS[provider];
    assert.ok(config, `missing VIDEO_MODEL_CONFIGS entry for ${provider}`);
    assert.ok(config.workflows["image-to-video"], `${provider} must support image-to-video`);

    const durations = petAppDurationsForProvider(provider);
    const modelDurations = videoModelDurations(provider);
    assert.ok(durations.length > 0);
    assert.ok(durations.includes("6s"), `${provider} durations should include 6s`);
    for (const d of durations) {
      assert.ok(modelDurations.includes(d), `${provider} duration ${d} must be supported`);
    }

    const resolutions = petAppResolutionsForProvider(provider);
    const modelResolutions = videoModelResolutions(provider);
    assert.deepEqual(resolutions, modelResolutions);

    const ratio = petAppRatioForProvider(provider);
    assert.ok(
      videoModelRatios(provider, "image-to-video").includes(ratio),
      `${provider} ratio ${ratio} must be supported for image-to-video`
    );

    const duration = normalizePetAppDuration(provider, "5s");
    const resolution = normalizePetAppResolution(provider, "480p");
    const quote = estimatePetAppCredits({ provider, duration, resolution });
    const direct = estimateGenerationCredits({
      mode: "video",
      provider,
      videoWorkflow: "image-to-video",
      duration,
      resolution,
      generateAudio: true,
      hasReferences: true,
      referenceCount: 1
    });
    assert.equal(quote, direct);
    assert.ok(Number.isInteger(quote) && quote > 0);
  }
});

test("Studio Apps i18n resolves cleanly across all 16 supported locales", () => {
  for (const locale of locales) {
    const copy = studioAppsCopy(locale);
    assert.ok(copy.navLabel.trim().length > 0, `${locale} missing navLabel`);
    assert.ok(copy.hubTitle.trim().length > 0, `${locale} missing hubTitle`);
    assert.ok(copy.petAppTitle.trim().length > 0, `${locale} missing petAppTitle`);
    assert.ok(copy.voiceAppTitle.trim().length > 0, `${locale} missing voiceAppTitle`);
    for (const tpl of PET_SING_DANCE_TEMPLATES) {
      assert.ok(copy.templates[tpl.id]?.title.trim().length > 0, `${locale} missing title for ${tpl.id}`);
      assert.ok(copy.templates[tpl.id]?.subtitle.trim().length > 0, `${locale} missing subtitle for ${tpl.id}`);
    }
  }
});

test("uploadStudioDataUrl decodes data URLs in memory without fetch(data:) CSP violations", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.ok(!url.startsWith("data:"), `uploadStudioDataUrl must never call fetch() on a data: URL (${url})`);
    return new Response(JSON.stringify({ code: "cloud_media_disabled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const sample = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0s0AAAAASUVORK5CYII=";
    const result = await uploadStudioDataUrl(sample, "image", "test-token");
    assert.equal(result, sample);
    assert.deepEqual(calls, ["/api/media"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
