import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  beginStudioMediaUpload, finishStudioMediaUpload, ownStudioMediaId, signGenerationMedia, StudioMediaError
} from "../src/lib/r2-studio-media";
import { uploadStudioMedia } from "../src/features/studio/upload-studio-media";

test("R2 uploads bind type and size, finalize independent of the upload URL and enforce ownership", async (t) => {
  const config = {
    R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    R2_BUCKET_NAME: "dreamface-media-test",
    R2_ACCESS_KEY_ID: "fixture-access-key",
    R2_SECRET_ACCESS_KEY: "fixture-secret-key"
  };
  const prior = Object.fromEntries(Object.keys(config).map(name => [name, process.env[name]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const stored = new Map<string, { ContentType: string; ContentLength: number; ETag: string }>();
  const missing = () => Object.assign(new Error("Missing object"), { $metadata: { httpStatusCode: 404 } });
  t.mock.method(S3Client.prototype, "send", async (command: HeadObjectCommand | CopyObjectCommand | DeleteObjectCommand) => {
    const key = command.input.Key!;
    if (command instanceof HeadObjectCommand) {
      const value = stored.get(key);
      if (!value) throw missing();
      return value;
    }
    if (command instanceof CopyObjectCommand) {
      const source = command.input.CopySource!.slice(config.R2_BUCKET_NAME.length + 1);
      const value = stored.get(source);
      if (!value) throw missing();
      assert.equal(command.input.CopySourceIfMatch, value.ETag);
      stored.set(key, value);
      return {};
    }
    assert.ok(command instanceof DeleteObjectCommand);
    stored.delete(key);
    return {};
  });

  await assert.rejects(beginStudioMediaUpload("alice", "image", "image/svg+xml", 6), StudioMediaError);
  const upload = await beginStudioMediaUpload("alice", "video", "video/mp4", 42);
  const put = new URL(upload.uploadUrl);
  assert.equal(put.hostname, `${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  assert.equal(put.searchParams.get("X-Amz-Expires"), "900");
  assert.equal(put.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  const owner = createHash("sha256").update("alice").digest("hex");
  const pending = `pending/${owner}/${upload.id}`;
  const etag = '"0123456789abcdef0123456789abcdef"';
  stored.set(pending, { ContentType: upload.contentType, ContentLength: 43, ETag: etag });
  await assert.rejects(finishStudioMediaUpload("alice", upload.id, etag), { status: 400 });
  stored.set(pending, { ContentType: upload.contentType, ContentLength: 42, ETag: etag });
  await assert.rejects(finishStudioMediaUpload("bob", upload.id, etag), { status: 404 });
  const url = await finishStudioMediaUpload("alice", upload.id, etag);
  assert.ok(ownStudioMediaId(url));
  assert.equal(stored.has(pending), false);
  assert.equal(await finishStudioMediaUpload("alice", upload.id, etag), url);
  const signed = new URL(await signGenerationMedia("alice", url, "video"));
  assert.match(signed.pathname, /\/media\//);
  assert.equal(signed.searchParams.get("X-Amz-Expires"), "86400");
  await assert.rejects(async () => signGenerationMedia("alice", url, "audio"), { status: 400 });
  await assert.rejects(async () => signGenerationMedia("bob", url, "video"), { status: 404 });
  const legacy = "https://dreamface.io/api/uploads/generation-inputs/photo.jpg";
  assert.equal(signGenerationMedia("alice", legacy, "image"), legacy);
});

test("the browser sends bytes only to R2 and completes the upload with the returned ETag", async (t) => {
  const endpoint = "https://fixture.r2.cloudflarestorage.com/dreamface-media-test/pending/fixture";
  const file = new Blob(["mock MP3 bytes"], { type: "audio/mpeg" });
  const etag = '"0123456789abcdef0123456789abcdef"';
  const steps: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url === endpoint) {
      assert.equal(init.method, "PUT");
      assert.equal(init.body, file);
      assert.equal(init.credentials, "omit");
      assert.deepEqual(init.headers, { "Content-Type": file.type });
      steps.push("direct PUT");
      return new Response(null, { headers: { ETag: etag } });
    }
    assert.equal(url, "/api/media");
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-session");
    const body = JSON.parse(String(init.body));
    steps.push(body.action);
    if (body.action === "start") {
      assert.deepEqual(body, { action: "start", kind: "audio", type: file.type, size: file.size });
      return Response.json({ id: "fixture", uploadUrl: endpoint, contentType: file.type });
    }
    assert.deepEqual(body, { action: "complete", id: "fixture", etag });
    return Response.json({ url: "https://dreamface.io/api/media/fixture.mp3" });
  });
  assert.equal(await uploadStudioMedia(file, "audio", "fixture-session"), "https://dreamface.io/api/media/fixture.mp3");
  assert.deepEqual(steps, ["start", "direct PUT", "complete"]);
});
