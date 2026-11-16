import { test } from "node:test";
import assert from "node:assert/strict";
import { heygenReferenceImageBytes, heygenReferenceMediaUrls, heygenReferenceUploadIssue, heygenReferenceValidationKey, validateHeygenReferences, HEYGEN_REFERENCE_IMAGE_BYTES, HEYGEN_REFERENCE_UPLOAD_BYTES } from "../src/lib/heygen-reference-video";

const image = "https://cdn.example.test/subject.png";
const video = "https://cdn.example.test/scene.mp4?token=a,b&v=2";
const audio = "https://cdn.example.test/sound.wav";

test("HeyGen references are optional and retain signed URL punctuation and order", () => {
  assert.equal(validateHeygenReferences(undefined, undefined, undefined), null);
  assert.equal(validateHeygenReferences([], [], []), null);
  assert.equal(validateHeygenReferences([], [image]), null);
  assert.equal(validateHeygenReferences([], [], [audio]), null);
  assert.deepEqual(heygenReferenceMediaUrls(` \n ${video}\r\n\nhttps://cdn.example.test/second.mp4 `), [video, "https://cdn.example.test/second.mp4"]);
});

test("HeyGen media limits are 9 images, 3 videos and 3 audio references", () => {
  assert.equal(validateHeygenReferences(Array(3).fill(video), Array(9).fill(image), Array(3).fill(audio)), null);
  assert.equal(heygenReferenceValidationKey([], Array(10).fill(image)), "studio.heygen.reference.error.images");
  assert.equal(heygenReferenceValidationKey(Array(4).fill(video), []), "studio.heygen.reference.error.videos");
  assert.equal(heygenReferenceValidationKey([], [], Array(4).fill(audio)), "studio.heygen.reference.error.audio");
  assert.ok(validateHeygenReferences(null, []));
  assert.ok(validateHeygenReferences([], [], "not-an-array"));
});

test("reference media rejects unsafe URLs and unsupported upload formats", () => {
  for (const url of ["http://127.0.0.1/file", "https://192.168.1.1/file", "https://user:secret@cdn.example.test/file", "javascript:alert(1)"]) {
    assert.ok(validateHeygenReferences([url], []));
    assert.ok(validateHeygenReferences([], [], [url]));
  }
  assert.ok(validateHeygenReferences([], ["data:image/gif;base64,aGVsbG8="]));
  assert.ok(validateHeygenReferences([], ["data:image/png;base64,=A==="]));
  assert.equal(validateHeygenReferences([], ["data:image/png;base64,aGVsbG8="]), null);
  assert.equal(heygenReferenceImageBytes("DATA:IMAGE/PNG;BASE64,aGVsbG8="), 5);
});

test("platform upload budgets include images already present without reading new files", () => {
  const file = (size: number, type = "image/png") => ({ size, type });
  assert.equal(heygenReferenceUploadIssue(Array(9).fill(file(1000)), []), null);
  assert.equal(heygenReferenceUploadIssue([file(1000)], Array(9).fill(image)), "images");
  assert.equal(heygenReferenceUploadIssue([file(1000, "image/gif")], []), "images");
  assert.equal(heygenReferenceUploadIssue([file(HEYGEN_REFERENCE_IMAGE_BYTES)], []), null);
  assert.equal(heygenReferenceUploadIssue([file(HEYGEN_REFERENCE_IMAGE_BYTES + 1)], []), "upload");
  assert.equal(heygenReferenceUploadIssue([file(HEYGEN_REFERENCE_UPLOAD_BYTES / 2), file(HEYGEN_REFERENCE_UPLOAD_BYTES / 2)], []), null);
  assert.equal(heygenReferenceUploadIssue([file(HEYGEN_REFERENCE_UPLOAD_BYTES / 2), file(HEYGEN_REFERENCE_UPLOAD_BYTES / 2 + 1)], []), "upload");
  assert.equal(heygenReferenceUploadIssue([file(HEYGEN_REFERENCE_UPLOAD_BYTES / 2), file(HEYGEN_REFERENCE_UPLOAD_BYTES / 2 - 4)], ["data:image/png;base64,aGVsbG8="]), "upload");
});
