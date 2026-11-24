export type StudioTaskStatus = "Queued" | "Running" | "Completed" | "Failed";

export type StudioTaskRecord = {
  id: string;
  type: "Image" | "Video" | "Audio";
  status: StudioTaskStatus;
  cost: number;
  title?: string | null;
  provider?: string;
  prompt?: string;
  transport?: "real" | "mock";
  createdAt?: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
  settings?: Record<string, unknown> | null;
  chargedCredits?: number;
  refundedCredits?: number;
  refundStatus?: "refunded" | "not_refunded" | "not_applicable";
  failureReason?: string | null;
};

export type StudioWorkbenchMode = "image" | "video" | "audio" | "avatar";

export type StudioTaskNextStep = {
  id: string;
  labelKey: string;
  href: string;
  icon: "video" | "avatar" | "image" | "sparkles" | "projects";
  primary?: boolean;
};

function isPublicHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function isAvatarTask(task: StudioTaskRecord): boolean {
  if (task.settings?.videoWorkflow === "avatar-video") return true;
  const provider = (task.provider || "").toLowerCase();
  return provider.includes("avatar");
}

export function studioTaskProjectHref(taskId: string): string {
  return `/studio?view=projects&taskId=${encodeURIComponent(taskId)}`;
}

export function studioTaskDownloadHref(taskId: string, index = 0): string {
  return `/api/generate/download?taskId=${encodeURIComponent(taskId)}&name=${encodeURIComponent(taskId)}&index=${index}`;
}

export function studioTaskDisplayTitle(
  task: StudioTaskRecord,
  providerLabel: (provider?: string) => string
): string {
  return (
    task.title ||
    task.prompt?.trim().split(/\s+/).slice(0, 8).join(" ") ||
    `${providerLabel(task.provider)} ${task.type}`
  );
}

export function studioTaskProgress(
  task: StudioTaskRecord,
  fallbackDuration: string,
  now = Date.now()
): number {
  if (task.status === "Completed" || task.status === "Failed") return 100;
  const rawDuration = typeof task.settings?.duration === "string" ? task.settings.duration : fallbackDuration;
  const rawSeconds = Number.parseInt(rawDuration, 10);
  const estimate = task.type === "Image" ? 90 : task.type === "Audio" ? 60 : rawSeconds >= 10 ? 150 : rawSeconds >= 8 ? 125 : 95;
  const startedAt = task.createdAt ? new Date(task.createdAt).getTime() : now;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.min(94, Math.max(task.status === "Running" ? 25 : 8, Math.round((elapsed / estimate) * 100)));
}

export function studioTaskMatchesWorkspaceMode(
  task: StudioTaskRecord,
  mode: StudioWorkbenchMode
): boolean {
  if (mode === "image") return task.type === "Image";
  if (mode === "audio") return task.type === "Audio";
  if (mode === "avatar") return task.type === "Video" && isAvatarTask(task);
  return task.type === "Video" && !isAvatarTask(task);
}

export function studioTaskRegenerateHref(task: StudioTaskRecord): string {
  const settings = task.settings || {};
  const isAvatar = isAvatarTask(task);
  const mode = isAvatar ? "avatar" : task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video";
  const imageWorkflow = typeof settings.imageWorkflow === "string" && ["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"].includes(settings.imageWorkflow)
    ? settings.imageWorkflow
    : "text-to-image";
  const videoWorkflow = typeof settings.videoWorkflow === "string" && ["text-to-video", "image-to-video", "reference-to-video", "video-upscale"].includes(settings.videoWorkflow)
    ? settings.videoWorkflow
    : "text-to-video";
  const audioWorkflow = typeof settings.audioWorkflow === "string" && ["text-to-audio", "text-to-music"].includes(settings.audioWorkflow)
    ? settings.audioWorkflow
    : task.provider === "minimax-music-2.6" ? "text-to-music" : "text-to-audio";
  const workflow = isAvatar ? "avatar-video" : mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : videoWorkflow;
  const params = new URLSearchParams({ mode, workflow, source: "regenerate" });
  if (task.provider) params.set("provider", task.provider);
  if (task.prompt) params.set("prompt", task.prompt);
  if (typeof settings.duration === "string" && settings.duration.trim()) params.set("duration", settings.duration.trim());
  if (typeof settings.ratio === "string" && settings.ratio.trim()) params.set("ratio", settings.ratio.trim());
  if (mode === "image") {
    if (typeof settings.imageSize === "string" && settings.imageSize.trim()) params.set("imageSize", settings.imageSize.trim());
    if (typeof settings.resolution === "string" && settings.resolution.trim()) params.set("imageResolution", settings.resolution.trim());
    if (typeof settings.quality === "string" && settings.quality.trim()) params.set("quality", settings.quality.trim());
    if (typeof settings.numImages === "number" && Number.isInteger(settings.numImages) && settings.numImages >= 1) params.set("numImages", String(settings.numImages));
  } else if (typeof settings.resolution === "string" && settings.resolution.trim()) {
    params.set("resolution", settings.resolution.trim());
  }
  if (typeof settings.seed === "number" && Number.isSafeInteger(settings.seed)) params.set("seed", String(settings.seed));
  if (typeof settings.seedanceTask === "string" && ["reference", "editing", "extension"].includes(settings.seedanceTask)) params.set("seedanceTask", settings.seedanceTask);
  if (Array.isArray(settings.imageUrls)) {
    const publicImages = settings.imageUrls.filter(isPublicHttpUrl).slice(0, 4);
    const joined = publicImages.join("\n");
    if (joined && joined.length <= 1500) params.set("reference", joined);
  }
  if (workflow === "reference-to-video" && Array.isArray(settings.videoUrls)) {
    const publicVideo = settings.videoUrls.find(isPublicHttpUrl);
    if (publicVideo && publicVideo.length <= 1000) params.set("referenceVideo", publicVideo);
  }
  return `/studio?${params.toString()}`;
}

export function studioTaskUseAsReferenceHref(task: StudioTaskRecord, overrideMediaUrl?: string | null): string {
  const mediaUrl = overrideMediaUrl || task.mediaUrl;
  if (task.type === "Video" && mediaUrl) {
    return `/studio?${new URLSearchParams({
      mode: "video",
      workflow: "reference-to-video",
      provider: "heygen-video",
      referenceVideo: mediaUrl,
      ...(task.prompt ? { prompt: task.prompt } : {})
    }).toString()}`;
  }
  const params = new URLSearchParams({
    mode: task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video",
    workflow: task.type === "Image" ? "image-to-image" : "image-to-video"
  });
  if (mediaUrl) params.set("reference", mediaUrl);
  if (task.prompt) params.set("prompt", task.prompt);
  return `/studio?${params.toString()}`;
}

export function studioTaskNextSteps(
  task: StudioTaskRecord,
  overrideMediaUrl?: string | null
): StudioTaskNextStep[] {
  const mediaUrl = (overrideMediaUrl || task.mediaUrl || "").trim();
  if (!mediaUrl || !isPublicHttpUrl(mediaUrl) || task.status !== "Completed") return [];
  const trimmedPrompt = task.prompt?.trim() || "";
  const promptParam: Record<string, string> = trimmedPrompt && trimmedPrompt.length <= 600 ? { prompt: trimmedPrompt } : {};

  if (task.type === "Image") {
    return [
      {
        id: "image-to-video",
        labelKey: "studio.workflow.image-to-video",
        icon: "video",
        primary: true,
        href: `/studio?${new URLSearchParams({ mode: "video", workflow: "image-to-video", reference: mediaUrl, ...promptParam }).toString()}`
      },
      {
        id: "avatar-video",
        labelKey: "studio.workflow.avatar-video",
        icon: "avatar",
        primary: true,
        href: `/studio?${new URLSearchParams({ mode: "avatar", workflow: "avatar-video", reference: mediaUrl }).toString()}`
      },
      {
        id: "image-to-image",
        labelKey: "studio.workflow.image-to-image",
        icon: "image",
        href: `/studio?${new URLSearchParams({ mode: "image", workflow: "image-to-image", reference: mediaUrl, ...promptParam }).toString()}`
      },
      {
        id: "enhance-cleanup",
        labelKey: "studio.workflow.enhance-cleanup",
        icon: "sparkles",
        href: `/studio?${new URLSearchParams({ mode: "image", workflow: "enhance-cleanup", provider: "topaz-image", reference: mediaUrl }).toString()}`
      },
      {
        id: "background-remove",
        labelKey: "studio.workflow.background-remove",
        icon: "sparkles",
        href: `/studio?${new URLSearchParams({ mode: "image", workflow: "background-remove", provider: "bria-background-remove", reference: mediaUrl }).toString()}`
      }
    ];
  }

  if (task.type === "Video") {
    return [
      {
        id: "reference-to-video",
        labelKey: "studio.workflow.reference-to-video",
        icon: "video",
        primary: true,
        href: `/studio?${new URLSearchParams({ mode: "video", workflow: "reference-to-video", provider: "heygen-video", referenceVideo: mediaUrl, ...promptParam }).toString()}`
      },
      {
        id: "extend-video",
        labelKey: "studio.seedance.task.extension",
        icon: "sparkles",
        primary: true,
        href: `/studio?${new URLSearchParams({ mode: "video", workflow: "reference-to-video", provider: "seedance-2.5-flash-video", source: "regenerate", seedanceTask: "extension", referenceVideo: mediaUrl, ...promptParam }).toString()}`
      },
      {
        id: "edit-video",
        labelKey: "studio.seedance.task.editing",
        icon: "video",
        href: `/studio?${new URLSearchParams({ mode: "video", workflow: "reference-to-video", provider: "seedance-2.5-flash-video", source: "regenerate", seedanceTask: "editing", referenceVideo: mediaUrl, ...promptParam }).toString()}`
      }
    ];
  }

  return [];
}
