import { GPT_IMAGE_EXAMPLE_REFERENCES } from "./gpt-image-models";
import { VIDEO_EXAMPLE_SOURCE_IMAGES } from "../features/studio/video-models";

export type AppliedUrlInput = { mode: string; value: string | null };
export function shouldApplyUrlInput(previous: AppliedUrlInput | null, mode: string, value: string | null) {
  return !previous || previous.mode !== mode || previous.value !== value;
}

/** Uploading a real image replaces built-in examples, not other user references. */
export function referenceTextWithoutExamples(value: string) {
  return value.split(/\r?\n|,/).map(url => url.trim())
    .filter(url => url && !GPT_IMAGE_EXAMPLE_REFERENCES.includes(url) && !VIDEO_EXAMPLE_SOURCE_IMAGES.includes(url))
    .join("\n");
}
