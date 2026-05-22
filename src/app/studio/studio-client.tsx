"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";

type TaskStatus = "Queued" | "Running" | "Completed" | "Failed";
type TaskItem = {
  id: string;
  type: "Image" | "Video";
  status: TaskStatus;
  cost: number;
  title?: string | null;
  isFavorite?: boolean;
  provider?: string;
  prompt?: string;
  ratio?: string;
  transport?: "real" | "mock";
  createdAt?: string;
  statusUrl?: string | null;
  responseUrl?: string | null;
  mediaUrl?: string | null;
};

const SESSION_TASKS_KEY = "nova_session_tasks";
const SESSION_CREDIT_BALANCE_KEY = "nova_session_credit_balance";
const GPT_IMAGE2_DEFAULT_PROMPT = `Create a high-end hero infographic announcing "GPT Image 2 is here".
Design it like a futuristic periodic table mixed with a clean anatomical diagram: a precise grid of 16-24 mini image panels, each showcasing a different visual style such as oil painting, anime, blueprint, isometric 3D, photorealism, watercolor, pixel art, clay render, cinematic lighting, product photography, fashion editorial, UI mockup, technical diagram, and surreal concept art.

The image should feel electric, colorful, premium, and extremely polished.
Use a clean modern layout, sharp typography, subtle labels, thin lines, glowing accents, and a strong visual hierarchy.
The infographic itself should demonstrate the power of an advanced image model: beautiful composition, perfect grids, consistent spacing, readable text, and diverse styles in one coherent design.

No date. No extra caption. Just a powerful visual announcement that speaks for itself.`;
const GPT_IMAGE2_PREVIEW_URL = "https://v3b.fal.media/files/b/0a981c3d/hdg8iaY8yShEwChTPjFah_OZUgg7Z4.jpg";
const FLUX_DEFAULT_PROMPT =
  "portrait | wide angle shot of eyes off to one side of frame, lucid dream-like woman, looking off in distance ::8 style | daydreampunk with glowing skin and eyes, styled in headdress, beautiful, she is dripping in neon lights, very colorful blue, green, purple, bioluminescent, glowing ::8 background | forest, vivid neon wonderland, particles, blue, green, purple ::7 parameters | rule of thirds, golden ratio, assymetric composition, hyper- maximalist, octane render, photorealism, cinematic realism, unreal engine, 8k ::7 --ar 16:9 --s 1000";
const FLUX_PREVIEW_URL = "https://fal.media/files/tiger/m0K3P3JUR_Brcf7mxk3tl.png";
const NANO_BANANA_EDIT_DEFAULT_PROMPT = "make a photo of the man driving the car down the california coastline";
const NANO_BANANA_EDIT_PREVIEW_URL = "https://storage.googleapis.com/falserverless/example_outputs/nano-banana-2-edit-output.png";
const NANO_BANANA_EDIT_REFERENCE_URLS = [
  "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png",
  "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input-2.png"
];
const NANO_BANANA_EDIT_REFERENCE_TEXT = NANO_BANANA_EDIT_REFERENCE_URLS.join("\n");
const GROK_VIDEO_DEFAULT_PROMPT =
  "Anime schoolgirl bursting out of house door, cherry blossoms blowing, morning light, speed lines indicating rush, chibi-ready expressions, classic shojo aesthetic, vibrant colors";
const GROK_VIDEO_PREVIEW_URL = "https://v3b.fal.media/files/b/0a8b90e4/RUAbFYlssdqnbjNLmE8qP_IX7BNYGP.mp4";

const IMAGE_SIZE_PRESETS = [
  { value: "default_4_3", label: "Default 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "square_hd", label: "Square HD", dimensions: "1024 x 1024", width: 1024, height: 1024 },
  { value: "square", label: "Square", dimensions: "512 x 512", width: 512, height: 512 },
  { value: "portrait_4_3", label: "Portrait 3:4", dimensions: "768 x 1024", width: 768, height: 1024 },
  { value: "portrait_16_9", label: "Portrait 9:16", dimensions: "576 x 1024", width: 576, height: 1024 },
  { value: "landscape_4_3", label: "Landscape 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "landscape_16_9", label: "Landscape 16:9", dimensions: "1024 x 576", width: 1024, height: 576 }
];

const DEFAULT_VIDEO_RATIO_OPTIONS = ["16:9", "9:16", "1:1"];
const GROK_VIDEO_RATIO_OPTIONS = ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"];
const GROK_VIDEO_RESOLUTION_OPTIONS = ["720p", "480p"];

const PROMPT_PRESETS = [
  "Anime key visual of a young cyberpunk courier standing on a rainy neon street, reflective puddles, glowing shop signs, dramatic rim light, cinematic composition, highly detailed",
  "Anime fantasy academy courtyard at sunset, two students in elegant uniforms, floating magical books, warm golden light, soft clouds, detailed background, polished illustration",
  "Epic mountain landscape at sunrise, layered mist in the valley, pine forest foreground, warm orange sky, ultra wide cinematic view, realistic photography style",
  "Quiet Japanese garden after rain, stone path, koi pond, red maple leaves, soft diffused light, peaceful atmosphere, high detail, natural color palette",
  "Editorial portrait of a confident creative director in a modern studio, tasteful wardrobe, soft window light, shallow depth of field, premium magazine photography",
  "Full body character portrait of a futuristic explorer, practical sci-fi suit, desert planet background, strong silhouette, cinematic lighting, concept art quality",
  "Modern glass architecture museum beside a calm river, clean geometric facade, late afternoon sun, people for scale, architectural visualization, realistic detail",
  "Brutalist concrete library interior with dramatic skylight, long shadows, warm reading lamps, minimalist furniture, atmospheric architectural photography",
  "Majestic white tiger walking through a snowy pine forest, visible breath, soft falling snow, realistic fur detail, cinematic wildlife photography",
  "Small orange cat astronaut floating inside a cozy spaceship cabin, Earth visible through the window, playful but realistic lighting, charming detailed scene"
];

function readSessionTasks(): TaskItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(SESSION_TASKS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TaskItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeTasks(remoteTasks: TaskItem[], sessionTasks: TaskItem[]) {
  const seen = new Set<string>();
  return [...sessionTasks, ...remoteTasks].filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

function pickMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") {
    return payload.url;
  }

  const images = payload.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).url === "string") {
      return (first as Record<string, string>).url;
    }
  }

  const video = payload.video;
  if (video && typeof video === "object" && typeof (video as Record<string, unknown>).url === "string") {
    return (video as Record<string, string>).url;
  }

  const videos = payload.videos;
  if (Array.isArray(videos) && videos.length > 0) {
    const first = videos[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).url === "string") {
      return (first as Record<string, string>).url;
    }
  }

  return null;
}

function estimateTaskSeconds(type: "image" | "video", provider: string | undefined, duration: string) {
  if (type === "image") {
    if (provider === "flux-image") return 120;
    if (provider === "recraft-image") return 75;
    return 90;
  }
  if (duration === "10s") return 150;
  if (duration === "8s") return 125;
  return 95;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function getImageSizePreset(value: string) {
  return IMAGE_SIZE_PRESETS.find((preset) => preset.value === value) || IMAGE_SIZE_PRESETS[0];
}

function ratioFromImageSize(value: string) {
  const preset = getImageSizePreset(value);
  const ratio = preset.width / preset.height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  if (ratio > 1.5) return "16:9";
  if (ratio > 1.2) return "4:3";
  if (ratio < 0.7) return "9:16";
  return "3:4";
}

function defaultPromptForProvider(provider: string) {
  if (provider === "chatgpt-image") return GPT_IMAGE2_DEFAULT_PROMPT;
  if (provider === "flux-image") return FLUX_DEFAULT_PROMPT;
  if (provider === "nano-banana-edit") return NANO_BANANA_EDIT_DEFAULT_PROMPT;
  if (provider === "grok-video") return GROK_VIDEO_DEFAULT_PROMPT;
  return "";
}

function defaultPreviewForProvider(provider: string) {
  if (provider === "chatgpt-image") return GPT_IMAGE2_PREVIEW_URL;
  if (provider === "flux-image") return FLUX_PREVIEW_URL;
  if (provider === "nano-banana-edit") return NANO_BANANA_EDIT_PREVIEW_URL;
  if (provider === "grok-video") return GROK_VIDEO_PREVIEW_URL;
  return null;
}

function defaultImageSizeForProvider(provider: string) {
  if (provider === "flux-image") return "landscape_16_9";
  if (provider === "nano-banana-edit") return "default_4_3";
  return "default_4_3";
}

function isProviderAllowedForMode(provider: string | null, mode: "image" | "video") {
  if (!provider) return false;
  return mode === "image"
    ? ["chatgpt-image", "flux-image", "nano-banana-edit", "recraft-image"].includes(provider)
    : ["seedance-video", "kling-video", "veo-video", "grok-video"].includes(provider);
}

function taskProgress(task: Pick<TaskItem, "status" | "createdAt" | "type" | "provider">, duration: string) {
  if (task.status === "Completed") return 100;
  if (task.status === "Failed") return 100;
  const estimate = estimateTaskSeconds(task.type === "Image" ? "image" : "video", task.provider, duration);
  const startedAt = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const base = task.status === "Running" ? 25 : 8;
  return Math.min(94, Math.max(base, Math.round((elapsed / estimate) * 100)));
}

function StudioContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const mode = sp.get("mode") === "image" ? "image" : "video";
  const providerFromUrl = sp.get("provider");
  const initialProvider = (isProviderAllowedForMode(providerFromUrl, mode)
    ? providerFromUrl
    : mode === "image"
      ? "chatgpt-image"
      : "seedance-video") as string;
  const initialImageWorkflow = sp.get("workflow") === "image-to-image" ? "image-to-image" : "text-to-image";
  const [prompt, setPrompt] = useState(() => defaultPromptForProvider(initialProvider));
  const [provider, setProvider] = useState(initialProvider);
  const [imageWorkflow, setImageWorkflow] = useState<"text-to-image" | "image-to-image">(initialImageWorkflow);
  const [ratio, setRatio] = useState(mode === "image" ? "1:1" : "16:9");
  const [imageSize, setImageSize] = useState("default_4_3");
  const [referenceImagesText, setReferenceImagesText] = useState(() =>
    mode === "image" && initialImageWorkflow === "image-to-image" && initialProvider === "nano-banana-edit"
      ? NANO_BANANA_EDIT_REFERENCE_TEXT
      : ""
  );
  const [referenceImageFiles, setReferenceImageFiles] = useState<string[]>([]);
  const [editResolution, setEditResolution] = useState("1K");
  const [videoResolution, setVideoResolution] = useState("720p");
  const [outputFormat, setOutputFormat] = useState("png");
  const [duration, setDuration] = useState(mode === "image" ? "single" : "6s");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "idle">("idle");
  const [taskHistoryNote, setTaskHistoryNote] = useState("");
  const [previewModal, setPreviewModal] = useState<{ url: string; type: "Image" | "Video" } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditNote, setCreditNote] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      setAccessToken(token);
      if (typeof window !== "undefined") {
        if (token) {
          window.localStorage.setItem("nova_access_token", token);
        } else {
          window.localStorage.removeItem("nova_access_token");
        }
      }
      if (!token) setCreditNote("Sign in to generate and see your credit balance.");
      setAuthReady(true);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token || null;
      setAccessToken(token);
      if (typeof window !== "undefined") {
        if (token) {
          window.localStorage.setItem("nova_access_token", token);
        } else {
          window.localStorage.removeItem("nova_access_token");
        }
      }
      setAuthReady(true);
    });
    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const workflowParam = sp.get("workflow") === "image-to-image" ? "image-to-image" : "text-to-image";
    const providerParam = sp.get("provider");
    setImageWorkflow(mode === "image" ? workflowParam : "text-to-image");
    const nextProvider = (isProviderAllowedForMode(providerParam, mode)
      ? providerParam
      : mode === "image" && workflowParam === "image-to-image"
        ? "nano-banana-edit"
        : mode === "image"
        ? "chatgpt-image"
        : "seedance-video") as string;
    setProvider(nextProvider);
    const nextImageSize = mode === "image" ? defaultImageSizeForProvider(nextProvider) : "default_4_3";
    setRatio(mode === "image" ? ratioFromImageSize(nextImageSize) : "16:9");
    setImageSize(nextImageSize);
    setDuration(mode === "image" ? "single" : "6s");
    setStatusText("");
    setStatusTone("idle");
  }, [mode, sp]);

  useEffect(() => {
    if (mode !== "image") return;
    const nextImageSize = defaultImageSizeForProvider(provider);
    setImageSize(nextImageSize);
    setRatio(ratioFromImageSize(nextImageSize));
  }, [mode, provider]);

  useEffect(() => {
    const promptParam = sp.get("prompt");
    if (promptParam) {
      setPrompt(promptParam);
    }

    const providerParam = sp.get("provider");
    if (isProviderAllowedForMode(providerParam, mode)) {
      setProvider(providerParam as string);
    }

    const ratioParam = sp.get("ratio");
    if (ratioParam && [...GROK_VIDEO_RATIO_OPTIONS, "1:1", "4:3", "3:4", "16:9", "9:16"].includes(ratioParam)) {
      setRatio(ratioParam);
    }

    const imageSizeParam = sp.get("imageSize");
    if (imageSizeParam && IMAGE_SIZE_PRESETS.some((preset) => preset.value === imageSizeParam)) {
      setImageSize(imageSizeParam);
      setRatio(ratioFromImageSize(imageSizeParam));
    }

    const durationParam = sp.get("duration");
    if (durationParam && (mode === "image" ? durationParam === "single" : ["6s", "8s", "10s"].includes(durationParam))) {
      setDuration(durationParam);
    }

    const resolutionParam = sp.get("resolution");
    if (resolutionParam && GROK_VIDEO_RESOLUTION_OPTIONS.includes(resolutionParam)) {
      setVideoResolution(resolutionParam);
    }
  }, [mode, sp]);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const response = await fetch("/api/tasks", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!response.ok) {
          throw new Error("Task history could not be loaded.");
        }
        const payload = (await response.json()) as {
          tasks: Array<{
            id: string;
            mode: "image" | "video";
            provider?: string;
            prompt?: string;
            status: "queued" | "running" | "completed" | "failed";
            estimated_credits: number;
            transport?: "real" | "mock";
            created_at?: string;
            status_url?: string | null;
            response_url?: string | null;
            output_url?: string | null;
            raw_result?: unknown;
            title?: string | null;
            is_favorite?: boolean;
          }>;
          storageWarning?: string;
        };
        const remoteTasks: TaskItem[] = payload.tasks.map((t) => ({
          id: t.id,
          type: t.mode === "image" ? "Image" : "Video",
          status:
            t.status === "queued"
              ? "Queued"
              : t.status === "running"
                ? "Running"
                : t.status === "completed"
                  ? "Completed"
                  : "Failed",
          cost: t.estimated_credits,
          title: t.title || null,
          isFavorite: Boolean(t.is_favorite),
          provider: t.provider,
          prompt: t.prompt,
          transport: t.transport,
          createdAt: t.created_at,
          statusUrl: t.status_url || null,
          responseUrl: t.response_url || null,
          mediaUrl: t.output_url || pickMediaUrl(t.raw_result) || null
        }));
        const sessionTasks = readSessionTasks();
        setTasks(mergeTasks(remoteTasks, sessionTasks));
        setTaskHistoryNote(payload.storageWarning || (sessionTasks.length ? "Showing saved tasks from this browser session." : ""));
      } catch (error) {
        const sessionTasks = readSessionTasks();
        setTasks(sessionTasks);
        setTaskHistoryNote(
          sessionTasks.length
            ? "Task history is temporarily unavailable. Showing saved tasks from this browser session."
            : error instanceof Error
              ? error.message
              : "Task history is temporarily unavailable."
        );
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let hasCachedBalance = false;
    if (typeof window !== "undefined") {
      const cachedBalance = window.localStorage.getItem(SESSION_CREDIT_BALANCE_KEY);
      if (cachedBalance && Number.isFinite(Number(cachedBalance))) {
        hasCachedBalance = true;
        setCreditBalance(Number(cachedBalance));
        setCreditNote("Showing browser-saved credit balance while cloud balance refreshes.");
      }
    }

    (async () => {
      try {
        const response = await fetch("/api/credits", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const payload = (await response.json()) as {
          balance?: number | null;
          signupBonusCredits?: number;
          storageWarning?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Unable to load credits.");
        if (typeof payload.balance === "number") {
          setCreditBalance(payload.balance);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SESSION_CREDIT_BALANCE_KEY, String(payload.balance));
          }
        }
        if (payload.storageWarning) {
          setCreditNote(
            hasCachedBalance
              ? "Cloud credit balance is temporarily unavailable. Showing browser-saved balance."
              : payload.storageWarning
          );
        } else {
          setCreditNote(
            typeof payload.signupBonusCredits === "number"
              ? `New accounts receive ${payload.signupBonusCredits} free credits.`
              : ""
          );
        }
      } catch (error) {
        setCreditNote(
          !hasCachedBalance
            ? error instanceof Error
              ? error.message
              : "Credit balance is temporarily unavailable."
            : "Cloud credit balance is temporarily unavailable. Showing browser-saved balance."
        );
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (typeof window === "undefined" || tasks.length === 0) {
      return;
    }

    window.localStorage.setItem(SESSION_TASKS_KEY, JSON.stringify(tasks.slice(0, 30)));
  }, [tasks]);

  const options = useMemo(
    () =>
      mode === "image"
        ? imageWorkflow === "image-to-image"
          ? [
              { value: "nano-banana-edit", label: "Nano Banana 2 Edit (fal)" }
            ]
          : [
              { value: "chatgpt-image", label: "OpenAI GPT-Image-2 (fal)" },
              { value: "flux-image", label: "FLUX Schnell (fast draft)" },
              { value: "recraft-image", label: "Recraft (fal)" }
            ]
        : [
            { value: "seedance-video", label: "Seedance 2.0 Text-to-Video (fal)" },
            { value: "kling-video", label: "Kling (fal)" },
            { value: "veo-video", label: "Veo (fal)" },
            { value: "grok-video", label: "Grok Imagine Video Text-to-Video (fal)" }
          ],
    [mode, imageWorkflow]
  );

  const estCredits = mode === "image" ? 12 : duration === "10s" ? 68 : duration === "8s" ? 56 : 42;
  const estimatedSeconds = estimateTaskSeconds(mode, provider, duration);
  const isPromptValid = prompt.trim().length >= 8;
  const currentTaskType: TaskItem["type"] = mode === "image" ? "Image" : "Video";
  const latestPreviewTask =
    tasks.find(
      (task) =>
        task.mediaUrl &&
        task.status === "Completed" &&
        task.type === currentTaskType &&
        task.provider === provider
    ) ||
    tasks.find((task) => task.mediaUrl && task.type === currentTaskType && task.provider === provider) ||
    tasks.find((task) => task.mediaUrl && task.status === "Completed" && task.type === currentTaskType) ||
    tasks.find((task) => task.mediaUrl && task.type === currentTaskType) ||
    null;
  const activeTasks = tasks.filter((task) => task.status === "Queued" || task.status === "Running");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const failedTasks = tasks.filter((task) => task.status === "Failed");
  const latestActiveTask = activeTasks[0] || null;
  const latestActiveProgress = latestActiveTask ? taskProgress(latestActiveTask, duration) : 0;
  const selectedImageSize = getImageSizePreset(imageSize);
  const videoPreviewRatio = ratio.includes(":") ? ratio.replace(":", " / ") : "16 / 9";
  const previewAspectRatio = mode === "image" ? `${selectedImageSize.width} / ${selectedImageSize.height}` : videoPreviewRatio;
  const modelPreviewUrl = defaultPreviewForProvider(provider);
  const isModelPreviewVideo = provider === "grok-video";
  const providerNote =
    provider === "flux-image"
      ? "FLUX Schnell is best for fast visual drafts. Use OpenAI GPT-Image-2 for exact text, counting, or strict layout instructions."
      : provider === "chatgpt-image"
        ? "GPT Image 2 supports preset output sizes. The preview frame updates to match the selected canvas."
        : provider === "grok-video"
          ? "Grok Imagine Video supports prompt, duration, aspect ratio, and 480p/720p output resolution."
          : "Use clear subject, style, composition, and constraints for better instruction following.";
  const videoRatioOptions = provider === "grok-video" ? GROK_VIDEO_RATIO_OPTIONS : DEFAULT_VIDEO_RATIO_OPTIONS;
  const referenceImageUrls = [
    ...referenceImagesText
      .split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean),
    ...referenceImageFiles
  ].slice(0, 14);

  async function handleReferenceFiles(files: FileList | null) {
    if (!files?.length) return;
    const nextFiles = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, 4)
        .map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Image file could not be read."));
              reader.readAsDataURL(file);
            })
        )
    );
    setReferenceImageFiles((prev) => [...prev, ...nextFiles].slice(0, 4));
  }

  async function handleGenerate() {
    if (!isPromptValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatusTone("idle");
    setStatusText("Submitting task...");

    const taskType: TaskItem["type"] = mode === "image" ? "Image" : "Video";
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getSession();
      const liveToken =
        data.session?.access_token ||
        accessToken ||
        (typeof window !== "undefined" ? window.localStorage.getItem("nova_access_token") : null);
      if (!liveToken) {
        const next = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/studio?mode=image&workflow=text-to-image";
        router.push(`/auth?next=${encodeURIComponent(next)}`);
        throw new Error("Session expired. Please sign in again.");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${liveToken}`
        },
        body: JSON.stringify({
          mode,
          imageWorkflow,
          provider,
          ratio,
          duration,
          prompt,
          imageSize: mode === "image" ? imageSize : undefined,
          imageUrls: mode === "image" && imageWorkflow === "image-to-image" ? referenceImageUrls : undefined,
          resolution:
            mode === "image" && imageWorkflow === "image-to-image"
              ? editResolution
              : mode === "video" && provider === "grok-video"
                ? videoResolution
                : undefined,
          outputFormat: mode === "image" && imageWorkflow === "image-to-image" ? outputFormat : undefined,
          idempotencyKey:
            typeof window !== "undefined" && window.crypto?.randomUUID
              ? window.crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2)}`
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error || "Generation request failed.");
      }

      const payload = (await response.json()) as {
        taskId: string;
        status: "queued";
        transport: "real" | "mock";
        statusUrl?: string | null;
        responseUrl?: string | null;
        storageWarning?: string;
        provider?: string;
        mode?: "image" | "video";
        estimatedCredits?: number;
        balance?: number;
      };
      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SESSION_CREDIT_BALANCE_KEY, String(payload.balance));
        }
      }

      const queuedTask: TaskItem = {
        id: payload.taskId,
        type: taskType,
        status: "Queued",
        cost: estCredits,
        provider,
        prompt: prompt.trim(),
        ratio,
        transport: payload.transport,
        createdAt: new Date().toISOString(),
        statusUrl: payload.statusUrl || null,
        responseUrl: payload.responseUrl || null
      };
      setTasks((prev) => [queuedTask, ...prev]);
      if (payload.storageWarning) {
        setTaskHistoryNote("This task is running, but task history could not be saved yet. It will remain visible in this browser session.");
      }

      if (payload.transport === "mock") {
        const updateMockStatus = async (mockStatus: "completed" | "failed") => {
          const response = await fetch(
            `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&mockStatus=${mockStatus}`,
            {
              headers: {
                Authorization: `Bearer ${liveToken}`
              }
            }
          );
          const statusPayload = (await response.json().catch(() => null)) as { balance?: number | null } | null;
          if (typeof statusPayload?.balance === "number") {
            setCreditBalance(statusPayload.balance);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(SESSION_CREDIT_BALANCE_KEY, String(statusPayload.balance));
            }
          }
        };

        await new Promise((resolve) => setTimeout(resolve, 900));
        setTasks((prev) =>
          prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
        );
        setStatusText("Task queued via local mock bridge. Set FAL_KEY and FAL model env vars for live provider.");

        await new Promise((resolve) => setTimeout(resolve, 1200));
        const shouldFail = prompt.toLowerCase().includes("fail");
        if (shouldFail) {
          await updateMockStatus("failed").catch(() => null);
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Failed", cost: 0 } : task))
          );
          setStatusTone("error");
          setStatusText("Generation failed. Try a clearer prompt or another provider.");
        } else {
          await updateMockStatus("completed").catch(() => null);
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task))
          );
          setStatusTone("ok");
          setStatusText("Generation completed. Your result is now in Recent Tasks.");
        }
      } else {
        setStatusText("Task queued via fal.ai live API. Waiting for provider...");
        let finalStatus: "COMPLETED" | "FAILED" | "CANCELED" | "ERROR" | null = null;

        for (let i = 0; i < 40; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1800));
          const statusRes = await fetch(
            `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&statusUrl=${encodeURIComponent(
              payload.statusUrl || ""
            )}&responseUrl=${encodeURIComponent(payload.responseUrl || "")}`,
            {
              headers: {
                Authorization: `Bearer ${liveToken}`
              }
            }
          );

          if (!statusRes.ok) {
            continue;
          }

          const statusPayload = (await statusRes.json()) as { status?: string; result?: unknown };
          const rawStatus = (statusPayload.status || "").toUpperCase();
          if (rawStatus === "IN_QUEUE") {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Queued" } : task))
            );
            setStatusText("Task is in queue on fal.ai...");
          } else if (rawStatus === "IN_PROGRESS") {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
            );
            setStatusText("Task is running on fal.ai...");
          } else if (["COMPLETED", "FAILED", "CANCELED", "ERROR"].includes(rawStatus)) {
            if (rawStatus === "COMPLETED") {
              const mediaUrl = pickMediaUrl(statusPayload.result);
              setTasks((prev) =>
                prev.map((task) => (task.id === payload.taskId ? { ...task, mediaUrl } : task))
              );
            }
            finalStatus = rawStatus as "COMPLETED" | "FAILED" | "CANCELED" | "ERROR";
            break;
          }
        }

        if (finalStatus === "COMPLETED") {
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task))
          );
          setStatusTone("ok");
          setStatusText("Generation completed via fal.ai. Your result is now in Recent Tasks.");
        } else {
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Failed", cost: 0 } : task))
          );
          setStatusTone("error");
          setStatusText("fal.ai task did not complete successfully. Please retry with another prompt/provider.");
        }
      }
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? error.message : "Unable to submit generation task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTopUp(amount: number) {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ amount })
      });
      const payload = (await response.json()) as { balance?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to add credits.");
      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SESSION_CREDIT_BALANCE_KEY, String(payload.balance));
        }
      }
      setCreditNote(`${amount} credits added. Payment integration can replace this dev top-up later.`);
    } catch (error) {
      setCreditNote(error instanceof Error ? error.message : "Unable to add credits.");
    }
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />
        {!authReady ? (
          <section className="rounded-2xl border border-black/10 bg-white/90 p-6 text-sm text-[#4f5a6d]">
            Checking your session...
          </section>
        ) : null}

        <section className="sticky top-3 z-40 mb-4 rounded-3xl border-2 border-[#1d1d1f]/15 bg-gradient-to-r from-[#eef4ff]/95 via-white/95 to-[#eefaf8]/95 p-4 shadow-[0_14px_32px_rgba(18,22,33,0.14)] backdrop-blur md:mb-5 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f5f77]">Studio Mode Switch</p>
              <p className="mt-1 text-sm font-medium text-[#415067]">Choose generation type before creating tasks.</p>
            </div>
            <div className="inline-flex rounded-2xl border border-black/10 bg-white p-1.5">
              <Link
                href="/studio?mode=image&workflow=text-to-image"
                className={`rounded-xl px-6 py-2.5 text-base font-semibold transition ${
                  mode === "image"
                    ? "bg-[#1c6be1] text-white shadow-[0_8px_18px_rgba(28,107,225,0.35)]"
                    : "text-[#4c5a70] hover:bg-[#f1f6ff]"
                }`}
              >
                Image Studio
              </Link>
              <Link
                href="/studio?mode=video&workflow=text-to-video"
                className={`rounded-xl px-6 py-2.5 text-base font-semibold transition ${
                  mode === "video"
                    ? "bg-[#0c7a71] text-white shadow-[0_8px_18px_rgba(12,122,113,0.35)]"
                    : "text-[#4c5a70] hover:bg-[#eefaf8]"
                }`}
              >
                Video Studio
              </Link>
            </div>
          </div>
        </section>

        <section className="hero-sheen relative overflow-hidden rounded-[2rem] border border-black/5 bg-gradient-to-b from-white to-[#f7f9fd] p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-9">
          <div className="orb left-5 top-5 h-14 w-14 bg-[#bad8ff]" />
          <div className="orb bottom-5 right-6 h-16 w-16 bg-[#d9cbff]" />
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Studio</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                {mode === "image" ? "Image Generation Workspace" : "Video Generation Workspace"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374] sm:text-base">
                Switch providers without changing workflow. Tune quality, cost, and delivery speed in one consistent interface.
              </p>
            </div>
            <div className="glass rounded-2xl px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[#637084]">Available credits</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {creditBalance === null ? "--" : creditBalance.toLocaleString()}
              </p>
              {creditNote ? <p className="mt-1 max-w-[220px] text-xs leading-5 text-[#667084]">{creditNote}</p> : null}
              <div className="mt-3 flex justify-end">
                <Link href="/billing" className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#1d1d1f]">
                  Top up
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="card tone-blue rounded-3xl p-6 md:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Create Task</h2>
              <p className="chip rounded-full px-3 py-1 text-xs text-[#4f596b]">Estimated {estCredits} credits</p>
            </div>

            {mode === "image" ? (
              <div className="mb-5 rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#637084]">Image Workflow</p>
                    <p className="mt-1 text-xs text-[#667084]">Choose text-only generation or edit from reference images.</p>
                  </div>
                  <span className="hidden rounded-full bg-[#f3f7ff] px-3 py-1 text-xs font-semibold text-[#40526f] sm:inline-flex">
                    {imageWorkflow === "image-to-image" ? "Reference required" : "Prompt only"}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "text-to-image", label: "Text to Image", note: "Create from prompt" },
                  { value: "image-to-image", label: "Image to Image", note: "Edit uploaded or linked images" }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      const workflow = item.value as "text-to-image" | "image-to-image";
                      setImageWorkflow(workflow);
                      const nextProvider = workflow === "image-to-image" ? "nano-banana-edit" : "chatgpt-image";
                      setProvider(nextProvider);
                      const nextDefaultPrompt = defaultPromptForProvider(nextProvider);
                      if (nextDefaultPrompt) setPrompt(nextDefaultPrompt);
                      setReferenceImagesText(workflow === "image-to-image" ? NANO_BANANA_EDIT_REFERENCE_TEXT : "");
                      const nextImageSize = defaultImageSizeForProvider(nextProvider);
                      setImageSize(nextImageSize);
                      setRatio(ratioFromImageSize(nextImageSize));
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "image");
                      params.set("workflow", workflow);
                      params.set("provider", nextProvider);
                      params.set("imageSize", nextImageSize);
                      params.set("ratio", ratioFromImageSize(nextImageSize));
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      imageWorkflow === item.value
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-[0_10px_24px_rgba(29,29,31,0.2)]"
                        : "border-black/10 bg-white text-[#4c5a70] hover:bg-[#f1f6ff]"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={`mt-1 block text-xs ${imageWorkflow === item.value ? "text-white/70" : "text-[#6b7485]"}`}>
                      {item.note}
                    </span>
                  </button>
                ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#5f6779]">Provider API</span>
                <select
                  value={provider}
                  onChange={(e) => {
                    const nextProvider = e.target.value;
                    setProvider(nextProvider);
                    const nextDefaultPrompt = defaultPromptForProvider(nextProvider);
                    if (nextDefaultPrompt) {
                      setPrompt(nextDefaultPrompt);
                    }
                    if (mode === "image") {
                      const nextImageSize = defaultImageSizeForProvider(nextProvider);
                      setImageSize(nextImageSize);
                      setRatio(ratioFromImageSize(nextImageSize));
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "image");
                      params.set("provider", nextProvider);
                      params.set("imageSize", nextImageSize);
                      params.set("ratio", ratioFromImageSize(nextImageSize));
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    } else {
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "video");
                      params.set("provider", nextProvider);
                      if (nextProvider === "grok-video") {
                        params.set("resolution", videoResolution);
                      } else {
                        params.delete("resolution");
                      }
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }
                  }}
                  className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-[#5f6779]">{mode === "image" ? "Output Size" : "Aspect Ratio"}</span>
                {mode === "image" ? (
                  <select
                    value={imageSize}
                    onChange={(e) => {
                      setImageSize(e.target.value);
                      setRatio(ratioFromImageSize(e.target.value));
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "image");
                      params.set("provider", provider);
                      params.set("imageSize", e.target.value);
                      params.set("ratio", ratioFromImageSize(e.target.value));
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {IMAGE_SIZE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {videoRatioOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#5f6779]">{imageWorkflow === "image-to-image" ? "Resolution" : "Duration"}</span>
                {mode === "image" && imageWorkflow === "image-to-image" ? (
                  <select
                    value={editResolution}
                    onChange={(e) => setEditResolution(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    <option value="0.5K">0.5K</option>
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                ) : (
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {mode === "image" ? (
                      <option value="single">Single Output</option>
                    ) : (
                      <>
                        <option value="6s">6 seconds</option>
                        <option value="8s">8 seconds</option>
                        <option value="10s">10 seconds</option>
                      </>
                    )}
                  </select>
                )}
              </label>
              {mode === "image" && imageWorkflow === "image-to-image" ? (
                <label className="block">
                  <span className="text-sm text-[#5f6779]">Output Format</span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WEBP</option>
                  </select>
                </label>
              ) : mode === "video" && provider === "grok-video" ? (
                <label className="block">
                  <span className="text-sm text-[#5f6779]">Resolution</span>
                  <select
                    value={videoResolution}
                    onChange={(e) => {
                      setVideoResolution(e.target.value);
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "video");
                      params.set("provider", provider);
                      params.set("resolution", e.target.value);
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {GROK_VIDEO_RESOLUTION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="tone-mint rounded-xl border border-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Routing note</p>
                  <p className="mt-2 text-sm leading-6 text-[#475162]">Smart fallback is enabled. If provider queue spikes, tasks reroute to your backup policy.</p>
                </div>
              )}
            </div>

            {mode === "image" && imageWorkflow === "image-to-image" ? (
              <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">Reference Images</p>
                    <p className="mt-1 text-xs text-[#667084]">Paste image URLs or upload local images. Up to 14 references.</p>
                  </div>
                  <span className="rounded-full bg-[#f3f7ff] px-3 py-1 text-xs font-semibold text-[#395172]">
                    {referenceImageUrls.length} selected
                  </span>
                </div>
                <div className="mt-3 rounded-2xl border border-dashed border-[#9ab2d6]/70 bg-[#f4f8ff] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#52647f]">Image URLs</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#667084]">
                      one URL per line
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={referenceImagesText}
                    onChange={(e) => setReferenceImagesText(e.target.value)}
                    className="motion-smooth w-full resize-none rounded-xl border border-[#cdd9ed] bg-white/85 p-3 font-mono text-xs leading-5 text-[#1d1d1f] placeholder:text-[#9ca3b7] outline-none focus:border-[#4c82d9]"
                    placeholder={"https://example.com/reference-1.jpg\nhttps://example.com/reference-2.png"}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f] shadow-sm">
                    Upload images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleReferenceFiles(e.target.files).catch(() => setStatusText("Image file could not be read."))}
                    />
                  </label>
                  {referenceImageUrls.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceImagesText("");
                        setReferenceImageFiles([]);
                      }}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#6e6e73]"
                    >
                      Clear references
                    </button>
                  ) : null}
                </div>
                {referenceImageUrls.length ? (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {referenceImageUrls.slice(0, 8).map((url, index) => (
                      <div key={`${url.slice(0, 32)}-${index}`} className="aspect-square overflow-hidden rounded-xl bg-[#eef1f7]">
                        <img src={url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <label className="mt-4 block">
              <span className="text-sm text-[#5f6779]">Prompt</span>
              <textarea
                rows={7}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/95 p-4 text-[#1d1d1f] placeholder:text-[#9ca3b7] outline-none focus:border-[#77a8e8]"
                placeholder="Describe what you want to generate..."
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <AppButton variant="primary" onClick={handleGenerate} disabled={!isPromptValid || isSubmitting}>
                {isSubmitting ? "Generating..." : accessToken ? "Generate Now" : "Sign in to Generate"}
              </AppButton>
              <AppButton
                variant="secondary"
                onClick={() => {
                  const preset = PROMPT_PRESETS[Math.floor(Math.random() * PROMPT_PRESETS.length)];
                  setPrompt(preset);
                }}
                disabled={isSubmitting}
              >
                Random Prompt
              </AppButton>
            </div>
            <p className="mt-3 text-sm text-[#647185]">
              {isPromptValid ? "Prompt looks good. Ready to generate." : "Use at least 8 characters in your prompt."}
            </p>
            <p className="mt-2 text-xs text-[#6c7789]">{providerNote}</p>
            {statusText ? (
              <p
                className={`mt-2 text-sm ${
                  statusTone === "ok"
                    ? "text-[#197a46]"
                    : statusTone === "error"
                      ? "text-[#b03439]"
                      : "text-[#4f5a6d]"
                }`}
              >
                {statusText}
              </p>
            ) : null}
          </article>

          <div className="grid gap-5">
            <article className="card rounded-3xl p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">Current Preview</h3>
                  <p className="mt-1 text-xs text-[#667084]">
                    {mode === "image"
                      ? `${selectedImageSize.label} · ${selectedImageSize.dimensions}`
                      : `${ratio} preview frame`}
                  </p>
                </div>
                {latestPreviewTask?.mediaUrl ? (
                  <a
                    href={`/api/generate/download?url=${encodeURIComponent(latestPreviewTask.mediaUrl || "")}&name=${encodeURIComponent(latestPreviewTask.id)}`}
                    className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[#2e3b52] hover:bg-[#f3f7ff]"
                  >
                    Download
                  </a>
                ) : null}
              </div>
              {latestPreviewTask ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-[#677388]">{latestPreviewTask.id}</p>
                  </div>
                  {latestPreviewTask.type === "Video" ? (
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ url: latestPreviewTask.mediaUrl || "", type: "Video" })}
                      className="block w-full overflow-hidden rounded-lg bg-[#f4f6fb] text-left"
                      style={{ aspectRatio: previewAspectRatio }}
                    >
                      <video src={latestPreviewTask.mediaUrl || undefined} controls className="h-full w-full object-contain" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ url: latestPreviewTask.mediaUrl || "", type: "Image" })}
                      className="block w-full overflow-hidden rounded-lg bg-[#f4f6fb]"
                      style={{ aspectRatio: previewAspectRatio }}
                    >
                      <img src={latestPreviewTask.mediaUrl || ""} alt={latestPreviewTask.id} className="h-full w-full object-contain" />
                    </button>
                  )}
                </div>
              ) : modelPreviewUrl ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
                  <div
                    className="relative overflow-hidden rounded-lg border border-black/10 bg-[#f6f7fb]"
                    style={{ aspectRatio: previewAspectRatio }}
                  >
                    {isModelPreviewVideo ? (
                      <video
                        src={modelPreviewUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls
                        className="h-full w-full object-cover opacity-95"
                      />
                    ) : (
                      <img
                        src={modelPreviewUrl}
                        alt={`${provider} example preview`}
                        className="h-full w-full object-cover opacity-95"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 text-white">
                      <p className="text-sm font-semibold">
                        {provider === "flux-image"
                          ? "FLUX Schnell sample"
                          : provider === "nano-banana-edit"
                            ? "Nano Banana 2 Edit sample"
                            : provider === "grok-video"
                              ? "Grok Imagine Video sample"
                            : "GPT Image 2 sample"}
                      </p>
                      <p className="mt-1 text-xs text-white/75">
                        {mode === "image" ? "The canvas matches your selected output size." : "The frame matches your selected aspect ratio."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
                  <div
                    className="grid place-items-center rounded-lg border border-dashed border-black/15 bg-[#f6f7fb]"
                    style={{ aspectRatio: previewAspectRatio }}
                  >
                    <p className="text-sm text-[#667084]">No preview yet. Generate your first task to see output here.</p>
                  </div>
                </div>
              )}
            </article>

            <article className="card tone-violet rounded-3xl p-6">
              <h3 className="text-xl font-semibold tracking-tight">Wait Estimate</h3>
              <p className="mt-3 text-sm leading-7 text-[#576173]">
                This setup usually takes about <span className="font-semibold text-[#1d1d1f]">{formatDuration(estimatedSeconds)}</span>.
                Tasks keep running after you leave this page.
              </p>
              <div className="mt-4 rounded-xl border border-black/10 bg-white/90 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-[#667084]">
                  <span>{latestActiveTask ? `${latestActiveTask.status} task` : "Ready to submit"}</span>
                  <span>{latestActiveTask ? `${latestActiveProgress}%` : formatDuration(estimatedSeconds)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e6ebf4]">
                  <div
                    className="h-full rounded-full bg-[#8b6fe8] transition-all duration-500"
                    style={{ width: `${latestActiveTask ? latestActiveProgress : 0}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-[#667084]">
                  Progress is an estimate based on provider status and elapsed time. Finished results sync back into Creations.
                </p>
              </div>
            </article>

            <article className="card tone-peach rounded-3xl p-6">
              <h3 className="text-xl font-semibold tracking-tight">Cost Preview</h3>
              <p className="mt-3 text-sm leading-7 text-[#535d6e]">
                Current provider and settings estimate <span className="font-semibold text-[#1d1d1f]">{estCredits} credits</span> for this generation.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Active", value: activeTasks.length },
                  { label: "Done", value: completedTasks.length },
                  { label: "Failed", value: failedTasks.length }
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-black/10 bg-white/90 p-3 text-center">
                    <p className="text-xs text-[#667084]">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="card rounded-3xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-semibold tracking-tight">Recent Tasks</h3>
              <AppButton href="/creations" variant="secondary" size="md">View all</AppButton>
            </div>
            {taskHistoryNote ? (
              <p className="mb-3 rounded-xl border border-[#d8b85d]/30 bg-[#fff8df] px-4 py-3 text-sm text-[#705d1d]">
                {taskHistoryNote}
              </p>
            ) : null}
            <div className="space-y-3">
              {tasks.length ? tasks.map((x) => (
                <div key={x.id} className="motion-smooth flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 hover:shadow-[0_10px_20px_rgba(18,22,33,0.07)]">
                  <div>
                    <p className="text-sm font-semibold">{x.id}</p>
                    <p className="text-xs text-[#677388]">{x.type} generation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{x.status}</p>
                    <p className="text-xs text-[#677388]">{x.cost} credits</p>
                  </div>
                </div>
              )) : (
                <p className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
                  No recent tasks yet.
                </p>
              )}
            </div>
            {tasks.some((task) => task.mediaUrl) ? (
              <div className="mt-5 grid gap-3">
                <p className="text-sm font-semibold text-[#4f596b]">Latest Outputs</p>
                {tasks
                  .filter((task) => task.mediaUrl)
                  .slice(0, 3)
                  .map((task) => (
                    <div key={`${task.id}-media`} className="rounded-xl border border-black/10 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-[#677388]">{task.id}</p>
                        <a
                          href={`/api/generate/download?url=${encodeURIComponent(task.mediaUrl || "")}&name=${encodeURIComponent(task.id)}`}
                          className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[#2e3b52] hover:bg-[#f3f7ff]"
                        >
                          Download
                        </a>
                      </div>
                      {task.type === "Video" ? (
                        <button
                          type="button"
                          onClick={() => setPreviewModal({ url: task.mediaUrl || "", type: "Video" })}
                          className="block w-full text-left"
                        >
                          <video src={task.mediaUrl || undefined} controls className="w-full rounded-lg" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreviewModal({ url: task.mediaUrl || "", type: "Image" })}
                          className="block w-full"
                        >
                          <img src={task.mediaUrl || ""} alt={task.id} className="w-full rounded-lg object-cover" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            ) : null}
          </article>

          <article className="card tone-pink rounded-3xl p-6">
            <h3 className="text-2xl font-semibold tracking-tight">Background Tasks</h3>
            <p className="mt-2 text-sm leading-7 text-[#576173]">
              Submitted jobs are stored in your account and keep running through the provider queue. You can close the page and check Creations later.
            </p>
            <div className="mt-4 grid gap-3">
              {activeTasks.slice(0, 4).map((task) => {
                const progress = taskProgress(task, duration);
                return (
                  <div key={`${task.id}-progress`} className="rounded-xl border border-black/10 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{task.id}</p>
                      <p className="shrink-0 text-xs text-[#667388]">{progress}%</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece7f8]">
                      <div className="h-full rounded-full bg-[#d36c9d] transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[#667388]">{task.status} / {task.cost} credits</p>
                  </div>
                );
              })}
              {!activeTasks.length ? (
                <div className="rounded-xl border border-black/10 bg-white/90 p-4 text-sm text-[#667084]">
                  No background tasks right now.
                </div>
              ) : null}
            </div>
          </article>
        </section>

        {previewModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setPreviewModal(null)}>
            <div className="max-h-[92vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-sm font-semibold text-white"
                >
                  Close
                </button>
              </div>
              {previewModal.type === "Video" ? (
                <video src={previewModal.url} controls autoPlay className="max-h-[85vh] w-full rounded-xl bg-black object-contain" />
              ) : (
                <img src={previewModal.url} alt="Preview" className="max-h-[85vh] w-full rounded-xl bg-black object-contain" />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function StudioPageClient() {
  return (
    <Suspense fallback={null}>
      <StudioContent />
    </Suspense>
  );
}
