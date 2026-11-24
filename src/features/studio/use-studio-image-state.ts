"use client";

import { useEffect, useState } from "react";
import { DEFAULT_GPT_IMAGE_OPTIONS, gptImageQuality, isGptImageProvider, type GptImageOptions, type GptImageQuality } from "../../lib/gpt-image-models";
import { SEEDREAM_55_PROVIDER } from "../../lib/seedream-55";
import type { StudioMode } from "./studio-storage";
import { defaultImageRatioForProvider, defaultImageSizeForProvider, type ImageWorkflow } from "./studio-workspace-config";

type ImageStateOptions = {
  mode: StudioMode;
  provider: string;
  imageWorkflow: ImageWorkflow;
  setRatio: (value: string) => void;
};

export function useStudioImageState({ mode, provider, imageWorkflow, setRatio }: ImageStateOptions) {
  const [imageSize, setImageSize] = useState("default_4_3");
  const [editResolution, setEditResolution] = useState("1K");
  const [outputFormat, setOutputFormat] = useState("png");
  const [imageQuality, setImageQuality] = useState<GptImageQuality>("low");
  const [gptImageOptions, setGptImageOptions] = useState<GptImageOptions>({ ...DEFAULT_GPT_IMAGE_OPTIONS });
  const [numImages, setNumImages] = useState(1);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [numInferenceSteps, setNumInferenceSteps] = useState(4);
  const [acceleration, setAcceleration] = useState("none");
  const [limitGenerations, setLimitGenerations] = useState(true);
  const [safetyTolerance, setSafetyTolerance] = useState("4");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState("");

  // Image workspaces start empty; switching models only sets the supported quality default.
  useEffect(() => {
    if (mode !== "image") return;
    if (isGptImageProvider(provider)) setImageQuality((current) => gptImageQuality(current));
  }, [mode, provider, imageWorkflow]);

  useEffect(() => {
    if (mode !== "image") return;
    if (!isGptImageProvider(provider)) {
      if (!["png", "jpeg", "webp"].includes(outputFormat)) setOutputFormat("png");
      if (numImages > (provider === SEEDREAM_55_PROVIDER ? 6 : 4)) setNumImages(provider === SEEDREAM_55_PROVIDER ? 6 : 4);
      if (provider === SEEDREAM_55_PROVIDER && outputFormat === "webp") setOutputFormat("png");
    } else {
      if (imageWorkflow === "image-to-image" && outputFormat === "svg") setOutputFormat("png");
      if (outputFormat === "svg" && numImages !== 1) setNumImages(1);
    }
  }, [mode, provider, imageWorkflow, outputFormat, numImages]);

  useEffect(() => {
    if (mode !== "image") return;
    const nextImageSize = defaultImageSizeForProvider(provider);
    setImageSize(nextImageSize);
    setRatio(defaultImageRatioForProvider(provider, nextImageSize));
    if (provider === "flux-image") {
      setNumInferenceSteps(4);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "flux-dev") {
      setNumInferenceSteps(28);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "nano-banana-image" || provider === "nano-banana-edit" || provider === "nano-banana-pro" || provider === "nano-banana-2-lite") {
      setEditResolution((current) => (current === "0.5K" ? "1K" : current));
    }
  }, [mode, provider, setRatio]);

  return {
    imageSize,
    setImageSize,
    editResolution,
    setEditResolution,
    outputFormat,
    setOutputFormat,
    imageQuality,
    setImageQuality,
    gptImageOptions,
    setGptImageOptions,
    numImages,
    setNumImages,
    guidanceScale,
    setGuidanceScale,
    numInferenceSteps,
    setNumInferenceSteps,
    acceleration,
    setAcceleration,
    limitGenerations,
    setLimitGenerations,
    safetyTolerance,
    setSafetyTolerance,
    systemPrompt,
    setSystemPrompt,
    enableWebSearch,
    setEnableWebSearch,
    thinkingLevel,
    setThinkingLevel
  };
}
