"use client";

import { useRef } from "react";
import { LandingAssistant, type AssistantWorkspaceContext } from "../../components/landing-assistant";
import { assistantReferenceImages } from "../../lib/assistant-reference-images";
import { parseReferenceMediaUrls } from "../../lib/seedance-flash";
import { WORKFLOW_META } from "./studio-workspace-config";
import type { StudioController } from "./use-studio-controller";
import { VIDEO_MODEL_CONFIGS } from "./video-models";

const chineseWorkflows: Record<string, string> = {
  "text-to-image": "文生图", "image-to-image": "图生图", "enhance-cleanup": "画质增强", "background-remove": "移除背景",
  "text-to-video": "文生视频", "image-to-video": "图生视频", "reference-to-video": "参考生视频", "avatar-video": "数字人视频", "text-to-audio": "语音生成", "text-to-music": "音乐生成"
};

export function StudioAssistantPreview({ model }: { model: StudioController }) {
  const { activeWorkflow, mode, provider, prompt, studioI18n, selectedProviderMeta, providerSettingsLabel } = model;
  const zh = studioI18n.locale === "zh-CN" || studioI18n.locale === "zh-TW";
  const canApplyPrompt = !model.isPromptlessImageWorkflow && !(model.isGeminiTts && model.geminiTts.mode === "dialogue");
  const references = useRef({ images: model.referenceImageUrls, version: 0 });
  if (references.current.images.length !== model.referenceImageUrls.length || references.current.images.some((url, index) => url !== model.referenceImageUrls[index])) {
    references.current = { images: model.referenceImageUrls, version: references.current.version + 1 };
  }
  const workspace: AssistantWorkspaceContext = {
    key: JSON.stringify([activeWorkflow, provider, providerSettingsLabel, model.seedanceOptions.task, model.estCredits, canApplyPrompt, prompt, references.current.version, model.referenceVideoUrl, model.seedanceOptions.audioUrls, model.heygenReferenceOptions.audioUrls]),
    workflow: (zh ? chineseWorkflows[activeWorkflow] : undefined) || WORKFLOW_META[activeWorkflow].label,
    model: selectedProviderMeta.label, settings: providerSettingsLabel, credits: model.estCredits,
    canApplyPrompt, busy: model.isSubmitting || model.videoPromptAI.busy,
    onSelectAction(href) {
      const target = new URL(href, window.location.origin);
      // Native query navigation is a no-op for an identical URL. A fresh click
      // must still restore that card's settings after the user edited the form.
      if (target.pathname+target.search !== window.location.pathname+window.location.search || target.searchParams.get("source")!=="assistant") return;
      const config = VIDEO_MODEL_CONFIGS[provider], duration = target.searchParams.get("duration"), resolution = target.searchParams.get("resolution"), task = target.searchParams.get("seedanceTask");
      if (duration && config?.durations.includes(duration)) model.setDuration(duration);
      if (resolution && config?.resolutions.includes(resolution)) model.setVideoResolution(resolution);
      if (task && ["reference","editing","extension"].includes(task)) model.setSeedanceOptions(current=>({...current,task:task as typeof current.task}));
      if (mode === "image") {
        if (target.searchParams.get("numImages") === "1") model.setNumImages(1);
        if (target.searchParams.get("imageResolution") === "1K") model.setEditResolution("1K");
        const quality = target.searchParams.get("quality");
        if (quality === "low" || quality === "high") model.setImageQuality(quality);
      }
    },
    async getContext(includeImages = true) {
      return {
        workflow: activeWorkflow, provider, prompt,
        duration: mode === "avatar" ? model.avatarDuration : model.duration,
        resolution: mode === "image" ? model.editResolution : model.videoResolution,
        ratio: model.ratio, imageSize: model.imageSize, numImages: model.numImages, quality: model.imageQuality,
        generateAudio: model.generateAudio, seedanceTask: model.seedanceOptions.task,
        imageCount: model.referenceImageUrls.length, videoCount: parseReferenceMediaUrls(model.referenceVideoUrl).length,
        audioCount: parseReferenceMediaUrls(provider === "heygen-video" ? model.heygenReferenceOptions.audioUrls : model.seedanceOptions.audioUrls).length,
        imageUrls: includeImages ? await assistantReferenceImages(model.referenceImageUrls) : [], dialogueMode: model.isGeminiTts && model.geminiTts.mode === "dialogue",
        imageWidth: model.gptImageOptions.width, imageHeight: model.gptImageOptions.height, outputFormat: model.outputFormat,
        imageReasoningEffort: model.gptImageOptions.reasoningEffort, frameCount: model.gptImageOptions.frameCount, svgModel: model.gptImageOptions.svgModel,
        enableWebSearch: model.enableWebSearch, thinkingLevel: model.thinkingLevel
      };
    },
    onApplyPrompt(value) {
      if (model.isSubmitting || model.videoPromptAI.busy || !canApplyPrompt) return;
      if (mode === "video") model.videoPromptAI.edit(value); else model.setPrompt(value);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const editor = document.getElementById("video-studio-prompt") || document.querySelector<HTMLTextAreaElement>(".creative-studio textarea[data-composer-prompt]") || document.querySelector<HTMLTextAreaElement>('.creative-studio textarea[dir="auto"]');
        if (editor instanceof HTMLTextAreaElement) {
          editor.focus({ preventScroll: true }); editor.scrollIntoView({ behavior: "smooth", block: "center" }); editor.setSelectionRange(value.length, value.length);
        }
      }));
    }
  };
  return <LandingAssistant locale={studioI18n.locale} placement="studio" workspace={model.isAppsHome ? undefined : workspace} />;
}
