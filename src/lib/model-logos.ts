// fal modelLab associations and original asset URLs: public/model-logos/sources.json.
// Keep these small assets local so the model picker never waits for fal's image CDN.
const MODEL_LOGO_LABS:Record<string,string> = {
  "heygen-video":"heygen",
  "flux-3-max-video":"fal",
  "minimax-h3-max-video":"fal",
  "minimax-h3-max-turbo-video":"fal",
  "grok-video":"xai",
  "gemini-omni-flash-video":"google",
  "veo-video":"google",
  "seedance-video":"bytedance",
  "seedance-mini-video":"bytedance",
  "happy-horse-video":"alibaba",
  "kling-video":"kling",
  "kling-avatar-standard":"kling",
  "kling-avatar-pro":"kling",
  "chatgpt-image":"openai",
  "gpt-image-2.5-sunburst":"openai",
  "nano-banana-image":"google",
  "nano-banana-edit":"google",
  "nano-banana-pro":"google",
  "nano-banana-pro-edit":"google",
  "nano-banana-lite":"google",
  "nano-banana-2-lite":"google",
  "flux-image":"black-forest-labs",
  "flux-dev":"black-forest-labs",
  "topaz-image":"topaz-labs",
  "bria-background-remove":"bria-ai",
  "minimax-music-2.6":"minimax",
  "elevenlabs-tts":"elevenlabs"
};
export function modelLogoForProvider(provider?:string) {
  const lab=provider ? MODEL_LOGO_LABS[provider] : undefined;
  return lab ? `/model-logos/${lab}.webp` : undefined;
}
