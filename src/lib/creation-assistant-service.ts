import { createHash } from "node:crypto";
import { fetchFal } from "./fal-fetch";
import { consumeRateLimit } from "./request-security";
import { validateEnhancementImage } from "./video-prompt-enhancer";
import { signGenerationMedia } from "./r2-studio-media";
import { enhancementUsage } from "./video-prompt-enhancement";
import { buildAssistantInput, parseAssistantReply } from "./creation-assistant-context";
import { directAssistantReply } from "./creation-assistant-direct";
import type { AssistantRequest, AssistantReply } from "./creation-assistant";

export class AssistantServiceError extends Error {
  constructor(public status: number, public retryAfter = 10) { super("Assistant unavailable"); }
}
const activeSubjects = new Set<string>();
const localLimits = new Map<string, { count: number; expires: number }>();
const replies = new Map<string, { expires: number; reply: AssistantReply }>();
export function creationAssistantModel() {
  // Chat has its own economical default; video prompt enhancement keeps its model.
  return process.env.AI_ASSISTANT_MODEL?.trim() || "google/gemini-3.1-flash-lite";
}
// Local UI development must not require a production database connection.
// Production always uses the existing shared MySQL rate limiter and fails closed.
async function limit(scope: string, subject: string, maximum: number, seconds: number) {
  if (process.env.NODE_ENV !== "development") {
    const result = await consumeRateLimit({ scope, subject, limit: maximum, windowSeconds: seconds });
    if (!result.allowed) throw new AssistantServiceError(429, result.retryAfterSeconds);
    return;
  }
  const now = Date.now(), key = createHash("sha256").update(`${scope}:${subject}:${Math.floor(now / (seconds * 1000))}`).digest("hex");
  for (const [id, entry] of localLimits) if (entry.expires <= now) localLimits.delete(id);
  if (localLimits.size >= 8192 && !localLimits.has(key)) throw new AssistantServiceError(429);
  const entry = localLimits.get(key) || { count: 0, expires: now + seconds * 1000 };
  entry.count++; localLimits.set(key, entry);
  if (entry.count > maximum) throw new AssistantServiceError(429, seconds);
}
export async function replyWithCreationAssistant(input: AssistantRequest, identity: { subject: string; ip: string; authenticated: boolean; userId?: string }): Promise<AssistantReply> {
  if (process.env.AI_ASSISTANT_ENABLED?.trim().toLowerCase() === "false") throw new AssistantServiceError(503);
  const direct = directAssistantReply(input);
  if (direct) {
    console.info(JSON.stringify({ event: "creation_assistant", status: "direct", usage: { cost: 0 } }));
    return direct;
  }
  const key = process.env.FAL_KEY?.replace(/^Key\s+/i, "").trim();
  if (!key) throw new AssistantServiceError(503);
  const model = creationAssistantModel();
  const llmInput = buildAssistantInput(input, model);
  // Unrelated editor changes must not defeat a cached login/billing answer.
  const cacheKey = createHash("sha256").update(JSON.stringify([identity.subject, llmInput])).digest("hex");
  const cached = replies.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.info(JSON.stringify({ event: "creation_assistant", model, status: "cached", usage: { cost: 0 }, elapsedMs: 0 }));
    return cached.reply;
  }
  if (activeSubjects.size >= 4 || activeSubjects.has(identity.subject)) throw new AssistantServiceError(429, 5);
  activeSubjects.add(identity.subject);
  const started = Date.now();
  let status = "failed", usage: Record<string, number> = {};
  const task = (async () => {
    try {
      await limit("creation_assistant_minute", identity.subject, identity.authenticated ? 20 : 8, 60);
      await limit("creation_assistant_day", identity.subject, identity.authenticated ? 200 : 40, 86400);
      await limit("creation_assistant_ip", identity.ip, 30, 60);
      await limit("creation_assistant_global", "all", 3000, 86400);
      const userId = identity.userId;
      if (userId && llmInput.image_urls) {
        llmInput.image_urls = await Promise.all(llmInput.image_urls.map(image => signGenerationMedia(userId, image, "image")));
      }
      for (const image of llmInput.image_urls || []) await validateEnhancementImage(image);
      if (Date.now() - started > 8000) throw new AssistantServiceError(503);
      const endpoint = llmInput.image_urls?.length ? "openrouter/router/vision" : "openrouter/router";
      const response = await fetchFal(`https://fal.run/${endpoint}`, {
        method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(llmInput), attempts: 1, timeoutMs: 24000, fallback: false, signal: AbortSignal.timeout(24000)
      });
      if (!response.ok) throw new AssistantServiceError(503);
      const payload = await response.json();
      usage = enhancementUsage(payload);
      const result = parseAssistantReply(payload, input);
      status = "answered";
      const reply = { ...result, model };
      for (const [id, entry] of replies) if (entry.expires <= Date.now()) replies.delete(id);
      if (replies.size >= 128) replies.delete(replies.keys().next().value!);
      replies.set(cacheKey, { reply, expires: Date.now() + 300000 });
      return reply;
    } finally {
      activeSubjects.delete(identity.subject);
      // Never log conversation text, references, credentials or user identities.
      console.info(JSON.stringify({ event: "creation_assistant", model, status, usage, elapsedMs: Date.now() - started }));
    }
  })();
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AssistantServiceError(503)), 33000); })]).finally(() => clearTimeout(timer));
}
