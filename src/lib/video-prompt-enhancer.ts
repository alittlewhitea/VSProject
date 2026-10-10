import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { fetchFal } from "./fal-fetch";
import { consumeRateLimit } from "./request-security";
import { buildEnhancementInput, parseEnhancementOutput, enhancementUsage, type VideoPromptContext, type EnhancementResult } from "./video-prompt-enhancement";

const cache = new Map<string, { expires: number; result: EnhancementResult }>();
const pending = new Map<string, Promise<EnhancementResult>>();
const activeUsers = new Set<string>();
let active = 0;
export function promptEnhancementEnabled() {
  return process.env.AI_PROMPT_ENHANCEMENT_ENABLED?.trim().toLowerCase() !== "false";
}
function publicAddress(address: string) {
  if (isIP(address) === 6) return /^[23]/.test(address); // Global unicast; reject loopback, mapped, local and multicast.
  const parts = address.split(".").map(Number);
  return parts.length === 4 && ![0, 10, 127].includes(parts[0]) && parts[0] < 224 &&
    !(parts[0] === 169 && parts[1] === 254) && !(parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) &&
    !(parts[0] === 192 && parts[1] === 168) && !(parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}
export async function validateEnhancementImage(url: string) {
  if (url.startsWith("data:")) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
    if (!match || url.length > 8_000_000) throw new Error("Invalid image data");
    const bytes = Buffer.from(match[2], "base64");
    const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
      match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
      bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid) throw new Error("Invalid image content");
    return;
  }
  if (url.length > 4096) throw new Error("Invalid image URL");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) throw new Error("Use a public HTTPS image URL");
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(value => !publicAddress(value.address))) throw new Error("Private image URLs are unsupported");
}

export async function enhanceVideoPrompt(context: VideoPromptContext, userId: string): Promise<EnhancementResult> {
  const llm = process.env.AI_PROMPT_MODEL?.trim() || "google/gemini-3.8-flash";
  const fallback: EnhancementResult = { originalPrompt: context.prompt, enhancedPrompt: context.prompt, model: llm, status: "fallback" };
  if (!promptEnhancementEnabled()) return { ...fallback, status: "disabled" };
  const key = createHash("sha256").update(JSON.stringify([userId, llm, context])).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;
  const existing = pending.get(key);
  if (existing) return existing;
  if (active >= 4 || activeUsers.has(userId)) return fallback;
  active++;
  activeUsers.add(userId);
  const started = Date.now();
  const task = (async () => {
    let result = fallback;
    let usage: Record<string, number> = {};
    try {
      const rate = await consumeRateLimit({ scope: "video_prompt_enhancement", subject: userId, limit: 10, windowSeconds: 60 });
      if (!rate.allowed) return fallback;
      const keyValue = process.env.FAL_KEY?.replace(/^Key\s+/i, "").trim();
      if (!keyValue) return fallback;
      for (const image of context.imageUrls || []) await validateEnhancementImage(image);
      if (Date.now() - started >= 25_000) return fallback;
      const endpoint = context.mode === "image-to-video" ? "openrouter/router/vision" : "openrouter/router";
      const response = await fetchFal(`https://fal.run/${endpoint}`, {
        method: "POST", headers: { Authorization: `Key ${keyValue}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildEnhancementInput(context, llm)), attempts: 1, timeoutMs: 15000, fallback: false,
        signal: AbortSignal.timeout(18000)
      });
      if (!response.ok) throw new Error("Provider unavailable");
      const payload = await response.json();
      usage = enhancementUsage(payload);
      const parsed = parseEnhancementOutput(payload);
      result = { ...fallback, enhancedPrompt: parsed.output, status: "enhanced", usage: parsed.usage };
      return result;
    } catch {
      return fallback;
    } finally {
      // No descriptions, image URLs, account identifiers or credentials in logs.
      console.info(JSON.stringify({ event: "video_prompt_enhancement", request: key.slice(0, 12), model: llm, workflow: context.mode, status: result.status, usage, elapsedMs: Date.now() - started }));
      for (const [entryKey, entry] of cache) if (entry.expires <= Date.now()) cache.delete(entryKey);
      if (cache.size >= 128) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: Date.now() + (result.status === "enhanced" ? 300_000 : 20_000) });
      active--;
      activeUsers.delete(userId);
      pending.delete(key);
    }
  })();
  // Bound the whole operation, including rate-limit DB access and image DNS.
  // Keep the concurrency slot until underlying work ends if the deadline wins.
  let timer: ReturnType<typeof setTimeout>;
  const bounded = Promise.race([task, new Promise<EnhancementResult>(resolve => {
    timer = setTimeout(() => resolve(fallback), 25_000);
  })]).finally(() => clearTimeout(timer));
  pending.set(key, bounded);
  return bounded;
}
