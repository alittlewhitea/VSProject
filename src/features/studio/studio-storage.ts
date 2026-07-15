export type TaskStatus = "Queued" | "Running" | "Completed" | "Failed";

export type TaskItem = {
  id: string;
  type: "Image" | "Video" | "Audio";
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
  updatedAt?: string | null;
  settings?: Record<string, unknown> | null;
  chargedCredits?: number;
  refundedCredits?: number;
  refundStatus?: "refunded" | "not_refunded" | "not_applicable";
  failureReason?: string | null;
};

export type StudioMode = "image" | "video" | "audio" | "avatar";

export type StudioLoginDraft<
  TImageWorkflow extends string = string,
  TVideoWorkflow extends string = string,
  TAudioWorkflow extends string = string
> = {
  createdAt: string;
  autoSubmit: boolean;
  mode: StudioMode;
  provider: string;
  imageWorkflow: TImageWorkflow;
  videoWorkflow?: TVideoWorkflow;
  audioWorkflow?: TAudioWorkflow;
  ratio: string;
  imageSize: string;
  referenceImagesText: string;
  referenceImageFiles: string[];
  avatarAudioUrl?: string;
  editResolution: string;
  videoResolution: string;
  generateAudio?: boolean;
  voice?: string;
  stability?: number;
  timestamps?: boolean;
  languageCode?: string;
  textNormalization?: string;
  voiceGender?: "all" | "female" | "male";
  lyrics?: string;
  lyricsOptimizer?: boolean;
  isInstrumental?: boolean;
  musicSampleRate?: number;
  musicBitrate?: number;
  musicFormat?: "mp3" | "wav" | "pcm";
  outputFormat: string;
  duration: string;
  prompt: string;
  imageQuality?: "auto" | "low" | "medium" | "high";
  numImages?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  enableSafetyChecker?: boolean;
  acceleration?: string;
  limitGenerations?: boolean;
  seed?: string;
  safetyTolerance?: string;
  systemPrompt?: string;
  enableWebSearch?: boolean;
  thinkingLevel?: string;
};

const SESSION_TASKS_KEY = "nova_session_tasks";
const GENERATION_IDEMPOTENCY_KEY_PREFIX = "nova_generation_idempotency";
const STUDIO_LOGIN_DRAFT_KEY = "nova_studio_login_draft";

export function scopedSessionKey(key: string, userId: string | null) {
  return userId ? `${key}:${userId}` : null;
}

export function sessionTasksKey(userId: string | null) {
  return scopedSessionKey(SESSION_TASKS_KEY, userId);
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function createIdempotencyFingerprint(payload: Record<string, unknown>) {
  return hashString(JSON.stringify(payload));
}

function createRandomIdempotencyKey() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Browser caches are optional and must never break the studio.
  }
}

function truncateCacheValue(value: string | null | undefined, maxLength: number) {
  if (!value) return value ?? null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function compactTaskForCache(task: TaskItem): TaskItem {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    cost: task.cost,
    title: truncateCacheValue(task.title, 120),
    isFavorite: task.isFavorite,
    provider: task.provider,
    prompt: truncateCacheValue(task.prompt, 500) || undefined,
    ratio: task.ratio,
    transport: task.transport,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    mediaUrl: truncateCacheValue(task.mediaUrl, 900),
    chargedCredits: task.chargedCredits,
    refundedCredits: task.refundedCredits,
    refundStatus: task.refundStatus,
    failureReason: truncateCacheValue(task.failureReason, 240)
  };
}

export function writeSessionTasksCache(key: string, tasks: TaskItem[]) {
  const serialized = JSON.stringify(tasks.slice(0, 12).map(compactTaskForCache));
  if (!safeSetLocalStorage(key, serialized)) safeRemoveLocalStorage(key);
}

export function getPersistentIdempotency(userId: string | null, fingerprint: string) {
  if (typeof window === "undefined") {
    return { storageKey: null, idempotencyKey: createRandomIdempotencyKey() };
  }

  const scope = userId || "anonymous";
  const storageKey = `${GENERATION_IDEMPOTENCY_KEY_PREFIX}:${scope}:${fingerprint}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
    return { storageKey, idempotencyKey: existing };
  }

  const idempotencyKey = createRandomIdempotencyKey();
  safeSetLocalStorage(storageKey, idempotencyKey);
  return { storageKey, idempotencyKey };
}

export function clearPersistentIdempotency(storageKey: string | null) {
  if (typeof window !== "undefined" && storageKey) safeRemoveLocalStorage(storageKey);
}

export function readStudioLoginDraft<
  TImageWorkflow extends string,
  TVideoWorkflow extends string,
  TAudioWorkflow extends string
>() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STUDIO_LOGIN_DRAFT_KEY);
    if (!stored) return null;
    const draft = JSON.parse(stored) as StudioLoginDraft<TImageWorkflow, TVideoWorkflow, TAudioWorkflow>;
    if (!draft || typeof draft !== "object" || typeof draft.prompt !== "string") return null;
    return draft;
  } catch {
    return null;
  }
}

export function writeStudioLoginDraft<
  TImageWorkflow extends string,
  TVideoWorkflow extends string,
  TAudioWorkflow extends string
>(draft: StudioLoginDraft<TImageWorkflow, TVideoWorkflow, TAudioWorkflow>) {
  if (typeof window === "undefined") return true;
  return safeSetLocalStorage(STUDIO_LOGIN_DRAFT_KEY, JSON.stringify(draft));
}

export function clearStudioLoginDraft() {
  if (typeof window !== "undefined") safeRemoveLocalStorage(STUDIO_LOGIN_DRAFT_KEY);
}

export function readSessionTasks(userId: string | null): TaskItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = sessionTasksKey(userId);
    if (!key) return [];
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TaskItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 12).map(compactTaskForCache) : [];
  } catch {
    return [];
  }
}

export function mergeTasks(remoteTasks: TaskItem[], sessionTasks: TaskItem[]) {
  const seen = new Set<string>();
  return [...sessionTasks, ...remoteTasks].filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

export function pickMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") return payload.url;

  for (const key of ["images", "videos"] as const) {
    const files = payload[key];
    if (Array.isArray(files) && files[0] && typeof files[0] === "object") {
      const url = (files[0] as Record<string, unknown>).url;
      if (typeof url === "string") return url;
    }
  }

  for (const key of ["image", "video", "audio"] as const) {
    const file = payload[key];
    if (file && typeof file === "object") {
      const url = (file as Record<string, unknown>).url;
      if (typeof url === "string") return url;
    }
  }
  return null;
}
