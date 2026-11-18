import { estimateGenerationCredits } from "./model-pricing";
import type { AssistantContext } from "./creation-assistant";

export function assistantCanApply(context?: AssistantContext) {
  return Boolean(context && !["enhance-cleanup", "background-remove"].includes(context.workflow) && !context.dialogueMode);
}
export function assistantQuote(context: AssistantContext) {
  const workflow = context.workflow;
  return estimateGenerationCredits({ mode: ["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"].includes(workflow) ? "image" : workflow === "text-to-audio" || workflow === "text-to-music" ? "audio" : "video",
    provider: context.provider, duration: context.duration, resolution: context.resolution, imageSize: context.imageSize, quality: context.quality,
    numImages: context.numImages, generateAudio: context.generateAudio, promptText: context.prompt,
    seedanceTask: workflow === "reference-to-video" ? context.seedanceTask : undefined,
    imageWidth: context.imageWidth, imageHeight: context.imageHeight, outputFormat: context.outputFormat, imageReasoningEffort: context.imageReasoningEffort,
    frameCount: context.frameCount, svgModel: context.svgModel, enableWebSearch: context.enableWebSearch, thinkingLevel: context.thinkingLevel,
    hasReferences: Boolean(context.imageCount), referenceCount: context.imageCount, referenceVideoCount: context.videoCount,
    videoWorkflow: workflow === "reference-to-video" ? "reference-to-video" : undefined });
}
