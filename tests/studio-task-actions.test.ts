import test from "node:test";
import assert from "node:assert/strict";
import {
  studioTaskMatchesWorkspaceMode,
  studioTaskNextSteps,
  studioTaskRegenerateHref,
  type StudioTaskRecord
} from "../src/features/studio/studio-task-actions";

const completedImage: StudioTaskRecord = {
  id: "img-1",
  type: "Image",
  status: "Completed",
  cost: 4,
  provider: "nano-banana-pro",
  prompt: "Editorial portrait in soft daylight",
  mediaUrl: "https://cdn.dreamface.test/out/portrait.png",
  settings: { imageWorkflow: "text-to-image", ratio: "3:4" }
};

const completedVideo: StudioTaskRecord = {
  id: "vid-1",
  type: "Video",
  status: "Completed",
  cost: 18,
  provider: "heygen-video",
  prompt: "Slow push-in on a neon street",
  mediaUrl: "https://cdn.dreamface.test/out/street.mp4",
  settings: { videoWorkflow: "text-to-video", duration: "5s", resolution: "768p" }
};

const completedAvatar: StudioTaskRecord = {
  id: "ava-1",
  type: "Video",
  status: "Completed",
  cost: 12,
  provider: "kling-avatar-pro",
  prompt: "Welcome to DreamFace Studio",
  mediaUrl: "https://cdn.dreamface.test/out/avatar.mp4",
  settings: { videoWorkflow: "avatar-video", duration: "5s" }
};

test("studioTaskMatchesWorkspaceMode separates image, video, avatar and audio tasks", () => {
  assert.equal(studioTaskMatchesWorkspaceMode(completedImage, "image"), true);
  assert.equal(studioTaskMatchesWorkspaceMode(completedImage, "video"), false);
  assert.equal(studioTaskMatchesWorkspaceMode(completedVideo, "video"), true);
  assert.equal(studioTaskMatchesWorkspaceMode(completedVideo, "avatar"), false);
  assert.equal(studioTaskMatchesWorkspaceMode(completedAvatar, "avatar"), true);
  assert.equal(studioTaskMatchesWorkspaceMode(completedAvatar, "video"), false);
});

test("studioTaskNextSteps builds cross-mode handoffs for completed images and videos", () => {
  const imageSteps = studioTaskNextSteps(completedImage);
  assert.deepEqual(
    imageSteps.map((step) => step.id),
    ["image-to-video", "avatar-video", "image-to-image", "enhance-cleanup", "background-remove"]
  );
  const avatarStepUrl = new URL(imageSteps[1].href, "https://dreamface.test");
  assert.equal(avatarStepUrl.searchParams.get("mode"), "avatar");
  assert.equal(avatarStepUrl.searchParams.get("workflow"), "avatar-video");
  assert.equal(avatarStepUrl.searchParams.get("reference"), completedImage.mediaUrl);

  const videoSteps = studioTaskNextSteps(completedVideo);
  assert.deepEqual(
    videoSteps.map((step) => step.id),
    ["reference-to-video", "extend-video", "edit-video"]
  );
  const extendUrl = new URL(videoSteps[1].href, "https://dreamface.test");
  assert.equal(extendUrl.searchParams.get("provider"), "seedance-2.5-flash-video");
  assert.equal(extendUrl.searchParams.get("seedanceTask"), "extension");
  assert.equal(extendUrl.searchParams.get("referenceVideo"), completedVideo.mediaUrl);

  assert.deepEqual(studioTaskNextSteps({ ...completedImage, status: "Running" }), []);
  assert.deepEqual(studioTaskNextSteps({ ...completedImage, mediaUrl: "javascript:alert(1)" }), []);
});

test("studioTaskRegenerateHref preserves avatar mode and parameters", () => {
  const href = studioTaskRegenerateHref(completedAvatar);
  const url = new URL(href, "https://dreamface.test");
  assert.equal(url.searchParams.get("mode"), "avatar");
  assert.equal(url.searchParams.get("workflow"), "avatar-video");
  assert.equal(url.searchParams.get("source"), "regenerate");
  assert.equal(url.searchParams.get("provider"), "kling-avatar-pro");
});
