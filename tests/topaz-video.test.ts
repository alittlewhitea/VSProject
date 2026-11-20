import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { verifyTopazVideoSource } from "../src/lib/topaz-video-inspection";
import { studioMediaUrl } from "../src/lib/r2-studio-media";
import {
  buildTopazVideoInput, defaultTopazVideoOptions, defaultTopazVideoScale, parseTopazVideoOptions,
  topazVideoModels, topazVideoQuote, topazVideoResolutionOptions
} from "../src/lib/topaz-video-upscale";

test("Topaz Precision sends one video, the selected settings, and safety checking", () => {
  assert.equal(topazVideoModels.length, 21);
  const url = "https://bucket.example/input.mp4";
  const options = parseTopazVideoOptions({ ...defaultTopazVideoOptions, target_fps: 60, noise: 0.15, H264_output: false });
  assert.ok(options);
  assert.deepEqual(buildTopazVideoInput(url, options), {
    video_url: url, model: "Proteus", upscale_factor: 2, target_fps: 60, noise: 0.15,
    H264_output: false, enable_safety_checker: true
  });
  for (const invalid of [
    { model: "Gaia 2", upscale_factor: 3 }, { model: "Proteus Natural", upscale_factor: 1 },
    { grain: 0.015 }, { target_fps: 15 }, { target_fps: 25.5 }, { target_fps: 61 },
    { halo: 1.01 }, { upscale_factor: 4.1 }, { H264_output: "false" }
  ]) {
    assert.equal(parseTopazVideoOptions({ ...defaultTopazVideoOptions, ...invalid }), null);
  }
});

test("Topaz quotes match the published standard 30 fps examples and increase with FPS", () => {
  for (const [width, height, tenSeconds, minute, tenSecondCredits] of [
    [640, 360, 0.1, 0.4, 49], [960, 540, 0.2, 0.8, 98], [1920, 1080, 0.6, 3.1, 294]
  ]) {
    const source = { width, height, duration: 10, fps: 30 };
    const quote = topazVideoQuote(source, defaultTopazVideoOptions);
    assert.ok(quote);
    assert.equal(quote.cost, tenSeconds);
    assert.equal(quote.credits, tenSecondCredits);
    assert.equal(quote.width, width * 2);
    assert.equal(quote.height, height * 2);
    assert.equal(topazVideoQuote({ ...source, duration: 60 }, defaultTopazVideoOptions)?.cost, minute);
  }
  const portrait = { width: 1080, height: 1920, duration: 60, fps: 30 };
  const quote = topazVideoQuote(portrait, defaultTopazVideoOptions)!;
  assert.equal(quote.cost, 3.1);
  assert.ok(topazVideoQuote(portrait, { ...defaultTopazVideoOptions, target_fps: 60 })!.credits > quote.credits);
  assert.equal(topazVideoQuote(portrait, { ...defaultTopazVideoOptions, upscale_factor: 4 }), null);
  assert.equal(topazVideoQuote({ ...portrait, duration: 301 }, defaultTopazVideoOptions), null);
});

test("Topaz resolution presets preserve orientation and stay within the supported scale", () => {
  const source = { width: 960, height: 540, duration: 10, fps: 30 };
  assert.equal(defaultTopazVideoScale(source), 2);
  const options = topazVideoResolutionOptions(source);
  assert.deepEqual(options.map(({ label, width, height }) => [label, width, height]), [
    ["720p", 1280, 720], ["1080p", 1920, 1080], ["1440p", 2560, 1440], ["4K", 3840, 2160]
  ]);
  const portrait = { ...source, width: 540, height: 960 };
  assert.deepEqual(topazVideoResolutionOptions(portrait).at(-1), { label: "4K", scale: 4, width: 2160, height: 3840 });
  for (const width of [1280, 1920]) {
    const hd = { ...source, width, height: 720 };
    assert.deepEqual(topazVideoResolutionOptions(hd)[0], { label: "720p", scale: 1, width, height: 720 });
  }
  assert.deepEqual(topazVideoResolutionOptions({ ...source, width: 1920, height: 720 }).map(({ label }) => label), ["720p", "1080p", "1440p"]);
  assert.equal(topazVideoResolutionOptions({ ...source, width: 1920, height: 1080 })[0].label, "1080p");
  const tiny = { ...source, width: 240, height: 120 };
  assert.deepEqual(topazVideoResolutionOptions(tiny), []);
  assert.equal(defaultTopazVideoScale(tiny), 4);
  const highRes = { ...source, width: 3840, height: 2160 };
  assert.deepEqual(topazVideoResolutionOptions(highRes).map(({ label }) => label), ["4K"]);
  assert.equal(defaultTopazVideoScale(highRes), 1);
});

test("Topaz rejects modified video metadata, expired inspections, and another user's proof", (t) => {
  const originalSecret = process.env.AUTH_SESSION_SECRET;
  const secret = "fixture-inspection-secret";
  process.env.AUTH_SESSION_SECRET = secret;
  t.after(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = originalSecret;
  });
  const key = "00000000-0000-4000-8000-000000000119-128-0123456789abcdef0123456789abcdef.mp4";
  const url = studioMediaUrl(key);
  const metadata = { width: 640, height: 360, duration: 10, fps: 30 };
  function proof(expires: number) {
    const digest = createHmac("sha256", secret).update(JSON.stringify([
      "topaz-video-metadata", "alice", key, expires, 640, 360, 10, 30
    ])).digest("hex");
    return `${expires}.${digest}`;
  }
  const source = { ...metadata, proof: proof(Date.now() + 60_000) };
  assert.deepEqual(verifyTopazVideoSource("alice", url, source), metadata);
  assert.throws(() => verifyTopazVideoSource("alice", url, { ...source, duration: 1 }), { status: 400 });
  assert.throws(() => verifyTopazVideoSource("bob", url, source), { status: 400 });
  assert.throws(() => verifyTopazVideoSource("alice", url, { ...metadata, proof: proof(Date.now() - 3000) }), { status: 400 });
  assert.throws(() => verifyTopazVideoSource("alice", "https://example.invalid/video.mp4", source), { status: 400 });
});
