import { WORKFLOW_META, PROVIDER_META, defaultImageSizeForProvider, type StudioWorkflow } from "../features/studio/studio-workspace-config";
import { VIDEO_MODEL_CONFIGS, videoModelRatios } from "../features/studio/video-models";
import { estimateGenerationCredits, type PricingMode } from "./model-pricing";
import { HEYGEN_REFERENCE_IMAGE_LIMIT, HEYGEN_REFERENCE_VIDEO_LIMIT, HEYGEN_REFERENCE_AUDIO_LIMIT } from "./heygen-reference-video";
import { SEEDANCE_FLASH_IMAGE_LIMIT, SEEDANCE_FLASH_PROVIDER } from "./seedance-flash";
import type { AssistantAction, AssistantRequest } from "./creation-assistant";
import { videoSupportsEndFrame } from "./video-keyframes";
import { isH3DailyFreeRequest } from "./h3-daily-free-policy";
import { isGptImageProvider } from "./gpt-image-models";

type Requirement = { workflow?: StudioWorkflow; explicit: boolean; endFrame: boolean; imageCount: number; duration?: string; resolution?: string; task: "reference" | "editing" | "extension" };
export type AssistantCandidate = {
  workflow: StudioWorkflow; provider: string; label: string; credits: number;
  duration?: string; resolution?: string; ratio?: string; imageSize?: string; task?: string;
  affordable?: boolean; usesDailyFree?: boolean;
};
const imageWorkflows = ["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"];
export function assistantRequirements(request: AssistantRequest): Requirement {
  let workflow: StudioWorkflow | undefined, explicit = false, duration: string | undefined, resolution: string | undefined;
  let task: Requirement["task"] = "reference", imageCount = request.context?.imageCount || 0, endFrame = false;
  // This validates navigation intent for both direct answers and model replies.
  for (const turn of request.messages.filter(turn => turn.role === "user").reverse()) {
    const text = turn.content.normalize("NFKC");
    duration ??= text.match(/\b(\d+)\s*(?:秒|seconds?|secs?|s\b)/i)?.[1];
    resolution ??= text.match(/\b(\d{3,4}p|[124]k)\b/i)?.[1].toLowerCase();
    if (workflow) continue;
    const imageEdit = /多[图圖](?:编辑|編輯)|文生[图圖]|[图圖]生[图圖]|(?:编辑|編輯).{0,6}(?:图片|圖片)|image edit/i.test(text);
    const video = /视频|影片|video|animate|animation/i.test(text) || !imageEdit && request.context?.workflow.endsWith("video");
    const frames = /首尾帧|首尾幀|起始.{0,8}(?:结束|結束)|start.{0,12}end.{0,6}frames?|first.{0,12}last.{0,6}frames?/i.test(text) && !/(?:不要|不是|无需|無需|不需要).{0,3}首尾[帧幀]|首尾[帧幀].{0,4}(?:不行|不要|不需要)/.test(text);
    const countText = text.match(/(\d{1,2}|[两兩三四五六七八九十])\s*[张張].{0,4}(?:图|圖|照片)/)?.[1]
      || text.match(/\b(\d{1,2})\s+(?:reference )?(?:images|photos|pictures)\b/i)?.[1];
    const count = countText ? Number(countText) || ({两:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10} as Record<string,number>)[countText] : 0;
    const multi = count > 1 || /多[图圖]|多[张張幅].{0,8}(?:图|圖|照片)|(?:multiple|multi[- ]?|several)\s*(?:reference\s*)?(?:images?|photos?|pictures?)/i.test(text);
    if (video && frames) { workflow = "image-to-video"; endFrame = true; }
    else if (video && multi && !/(?:不要|不需要|无需|無需).{0,3}多[图圖]/.test(text)) { workflow = "reference-to-video"; imageCount = Math.max(count, 2, imageCount); }
    else if (/视频编辑|编辑视频|影片編輯|video edit/i.test(text)) { workflow = "reference-to-video"; task = "editing"; }
    else if (/(?:延长|延長|extend|extension).{0,12}(?:视频|影片|video)|(?:视频|影片|video).{0,12}(?:延长|延長|extension)/i.test(text)) { workflow = "reference-to-video"; task = "extension"; }
    else if (/参考视频|參考影片|参考.{0,8}生视频|reference(?:[- ]to[- ]| )video/i.test(text)) workflow = "reference-to-video";
    else if (/文生视频|文生影片|text[- ]to[- ]video/i.test(text)) workflow = "text-to-video";
    else if (/图生视频|圖生影片|image[- ]to[- ]video|(?:照片|图片|圖片).{0,10}(?:动起来|動起來|animate)/i.test(text)) workflow = "image-to-video";
    else if (/移除背景|去(?:除|掉)背景|remove.{0,5}background/i.test(text)) workflow = "background-remove";
    else if (/文生图|文生圖|text[- ]to[- ]image/i.test(text)) workflow = "text-to-image";
    else if (imageEdit) workflow = "image-to-image";
    if (workflow) explicit = true;
  }
  return { workflow: workflow || request.context?.workflow as StudioWorkflow | undefined, explicit, endFrame, imageCount, duration: duration ? `${duration}s` : undefined, resolution, task };
}
function resolutionHeight(value: string) { return value === "4k" ? 2160 : value === "2k" ? 1440 : value.endsWith("k") ? 1080 : Number.parseInt(value, 10); }
export function assistantCandidate(workflow: StudioWorkflow, provider: string, request: AssistantRequest): AssistantCandidate | null {
  if (!WORKFLOW_META[workflow]?.providers.includes(provider)) return null;
  const requirement = assistantRequirements(request), config = VIDEO_MODEL_CONFIGS[provider];
  if (workflow === "image-to-video" && requirement.endFrame && !videoSupportsEndFrame(provider)) return null;
  const mode: PricingMode = imageWorkflows.includes(workflow) ? "image" : workflow.startsWith("text-to-a") || workflow === "text-to-music" ? "audio" : "video";
  let duration: string | undefined, resolution: string | undefined, ratio: string | undefined, imageSize: string | undefined, task: string | undefined;
  if (workflow === "reference-to-video") {
    const limit = provider === "heygen-video" ? HEYGEN_REFERENCE_IMAGE_LIMIT : provider === SEEDANCE_FLASH_PROVIDER ? SEEDANCE_FLASH_IMAGE_LIMIT : 0;
    if (requirement.imageCount > limit || requirement.task !== "reference" && provider !== SEEDANCE_FLASH_PROVIDER) return null;
    if ((request.context?.videoCount || 0) > (provider === "heygen-video" ? HEYGEN_REFERENCE_VIDEO_LIMIT : 5) || (request.context?.audioCount || 0) > (provider === "heygen-video" ? HEYGEN_REFERENCE_AUDIO_LIMIT : 5)) return null;
    task = requirement.task;
  }
  if (config && mode === "video") {
    const durations = config.durations.filter(value => /^\d+s$/.test(value)).sort((a,b)=>Number.parseInt(a)-Number.parseInt(b));
    duration = requirement.duration || durations[0] || config.defaultDuration;
    if (!config.durations.includes(duration)) return null;
    const resolutions = [...config.resolutions].sort((a,b)=>resolutionHeight(a)-resolutionHeight(b));
    resolution = requirement.resolution ? resolutions.find(value=>resolutionHeight(value)>=resolutionHeight(requirement.resolution!)) : resolutions[0] || config.defaultResolution;
    if (requirement.resolution && !resolution) return null;
    const ratios = videoModelRatios(provider, workflow as "text-to-video" | "image-to-video" | "reference-to-video", resolution);
    const requestedRatio = request.messages.filter(turn=>turn.role==="user").reverse().map(turn=>turn.content.match(/\b(9:16|16:9|1:1|4:3|3:4|21:9)\b/)?.[1]).find(Boolean);
    ratio = requestedRatio && ratios.includes(requestedRatio) ? requestedRatio : ratios.includes("auto") ? "auto" : ratios.includes("adaptive") ? "adaptive" : ratios.includes("source") ? "source" : ratios.includes("16:9") ? "16:9" : ratios[0];
  } else if (mode === "image") {
    imageSize = provider === "seedream-5.5-image" ? "auto_1K" : defaultImageSizeForProvider(provider);
    resolution = "1K";
  }
  const referenceCount = workflow === "reference-to-video" || workflow === "image-to-image" ? requirement.imageCount : workflow === "image-to-video" || workflow === "avatar-video" ? 1 : 0;
  const usesDailyFree = Boolean(request.account?.h3DailyFreeAvailable && ["text-to-video","image-to-video"].includes(workflow) && isH3DailyFreeRequest({mode,provider,duration,resolution}));
  const credits = usesDailyFree ? 0 : estimateGenerationCredits({ mode, provider, duration: duration || "5s", resolution, imageSize, quality: isGptImageProvider(provider) ? "low" : "high", numImages: 1,
    hasReferences: referenceCount > 0, referenceCount, videoWorkflow: workflow === "reference-to-video" ? workflow : undefined,
    referenceVideoCount: workflow === "reference-to-video" ? request.context?.videoCount : 0, seedanceTask: task,
    promptText: request.context?.prompt || (mode === "audio" ? "x".repeat(1000) : "") });
  return { workflow, provider, label: PROVIDER_META[provider]?.label || provider, credits, duration, resolution, ratio, imageSize,
    task: workflow === "reference-to-video" && provider === SEEDANCE_FLASH_PROVIDER ? task : undefined,
    affordable: request.account ? credits <= request.account.creditBalance : undefined, usesDailyFree };
}
export function assistantBudgetOptions(request: AssistantRequest) {
  const requirement = assistantRequirements(request);
  const workflows: StudioWorkflow[] = requirement.workflow ? [requirement.workflow] : ["text-to-image", "text-to-video", "image-to-video", "reference-to-video"];
  return workflows.flatMap(workflow => WORKFLOW_META[workflow].providers.map(provider=>assistantCandidate(workflow,provider,request)).filter((value): value is AssistantCandidate=>Boolean(value)).sort((a,b)=>a.credits-b.credits).slice(0, requirement.workflow ? 3 : 1));
}
const zhWorkflows: Record<StudioWorkflow, string> = { "text-to-image":"文生图", "image-to-image":"图生图", "enhance-cleanup":"画质增强", "background-remove":"移除背景", "text-to-video":"文生视频", "image-to-video":"图生视频", "reference-to-video":"参考视频", "video-upscale":"视频超分", "avatar-video":"数字人视频", "text-to-audio":"语音生成", "text-to-music":"音乐生成" };
export function assistantCandidateAction(candidate: AssistantCandidate, request: AssistantRequest, reason: string): AssistantAction {
  const workflow = candidate.workflow, mode = imageWorkflows.includes(workflow) ? "image" : workflow === "avatar-video" ? "avatar" : workflow === "text-to-audio" || workflow === "text-to-music" ? "audio" : "video";
  const params = new URLSearchParams({ mode, workflow, provider: candidate.provider, assistant: "preview", source: "assistant" });
  if (candidate.duration) params.set("duration", candidate.duration);
  if (candidate.resolution && mode !== "image") params.set("resolution", candidate.resolution);
  if (candidate.ratio) params.set("ratio", candidate.ratio);
  if (candidate.imageSize) params.set("imageSize", candidate.imageSize);
  if (mode === "image") { params.set("numImages","1"); params.set("quality",isGptImageProvider(candidate.provider) ? "low" : "high"); params.set("imageResolution",candidate.resolution || "1K"); }
  if (candidate.task) params.set("seedanceTask", candidate.task);
  return { label: candidate.label, description: reason, href: `/studio?${params}`, workflow: request.locale.startsWith("zh") ? zhWorkflows[workflow] : WORKFLOW_META[workflow].label,
    credits: candidate.credits, settings: [candidate.duration, candidate.resolution, mode === "audio" && !request.context?.prompt ? "1,000 characters" : undefined, candidate.usesDailyFree ? request.locale.startsWith("zh") ? "今日免费额度，以生成时校验为准" : "Daily allowance; verified again on Generate" : undefined].filter(Boolean).join(" · "), affordable: candidate.affordable };
}
