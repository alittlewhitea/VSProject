import { GPT_IMAGE_EXAMPLE_REFERENCES } from "./gpt-image-models";
import { VIDEO_EXAMPLE_SOURCE_IMAGES } from "../features/studio/video-models";

export type AppliedUrlInput = { mode: string; value: string | null };
export function shouldApplyUrlInput(previous: AppliedUrlInput | null, mode: string, value: string | null) {
  return !previous || previous.mode !== mode || previous.value !== value;
}

/** Commas inside CDN transform paths and data URLs belong to the image URL. */
export function parseStudioReferenceImages(value: string) {
  return value.split(/\r?\n|,(?=\s*(?:https?:\/\/|data:image\/))/i).map(url => url.trim()).filter(Boolean);
}

/** Uploading a real image replaces built-in examples, not other user references. */
export function referenceTextWithoutExamples(value: string) {
  return parseStudioReferenceImages(value)
    .filter(url => url && !GPT_IMAGE_EXAMPLE_REFERENCES.includes(url) && !VIDEO_EXAMPLE_SOURCE_IMAGES.includes(url))
    .join("\n");
}
