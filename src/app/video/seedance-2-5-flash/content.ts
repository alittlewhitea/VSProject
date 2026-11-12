export const PAGE_PATH = "/video/seedance-2-5-flash";
export const REVIEWED_AT = "2026-11-12";
export const SOURCE_URL = "https://mp.weixin.qq.com/s/lTZS2oV6BuORvK_Shgb-Ag";
export const OFFICIAL_FAMILY_URL = "https://www.volcengine.com/activity/seedance25";
export const DEMO_SOURCE_URL = "https://dreamina.capcut.com/seedance/seedance-2-5-flash";
export const SOCIAL_IMAGE_URL = "https://p16-seeyou-sg.ibyteimg.com/tos-alisg-i-2zwwjm3azk-sg/2fd82ca3cbb44c759bc12fbd2213f29c~tplv-2zwwjm3azk-image.image";
export const PAGE_TITLE = "Seedance 2.5 Flash: Video Examples, Specs & Pricing | DreamFace";
export const PAGE_DESCRIPTION = "Explore Seedance 2.5 Flash: up to 30-second AI videos, 480p/720p output and multimodal references. Watch official examples and compare Flash with Seedance 2.5.";

export const examples = [
  {
    id: "product-demo",
    name: "Product motion study",
    video: "https://p16-seeyou-sg.ibyteimg.com/tos-alisg-i-2zwwjm3azk-sg/69837a42cef3434c96e0bd45b8ee73de~tplv-2zwwjm3azk-image.image",
    description: "A product-motion example presented on Dreamina’s Seedance 2.5 Flash page, exploring an earbud case, a restrained camera move and studio lighting."
  },
  {
    id: "marketing-demo",
    name: "An animated marketing poster",
    video: "https://p16-seeyou-sg.ibyteimg.com/tos-alisg-i-2zwwjm3azk-sg/76b9ae3f802d4a2aab8180653120cfd6~tplv-2zwwjm3azk-image.image",
    description: "A marketing-poster example presented on Dreamina’s Seedance 2.5 Flash page, using a lemonade product scene to explore motion and graphic composition."
  },
  {
    id: "storyboard-demo",
    name: "A cinematic storyboard test",
    video: "https://p16-seeyou-sg.ibyteimg.com/tos-alisg-i-2zwwjm3azk-sg/f258430b6a1e4adc803ed33f1caa5d45~tplv-2zwwjm3azk-image.image",
    description: "A storyboard-shot example presented on Dreamina’s Seedance 2.5 Flash page, exploring a character, camera movement and atmosphere in a neon-lit rainy alley."
  }
] as const;

export const specs = [
  ["Model family", "ByteDance Seedance 2.5"],
  ["Generation workflows", "Text-to-video and image-to-video; multimodal references and video editing are described in the announcement."],
  ["Maximum clip length", "Up to 30 seconds per generated clip"],
  ["Output resolutions", "480p and 720p"],
  ["Image references", "Up to 10 images per request"],
  ["Video references", "Up to 5 video clips per request"],
  ["Audio references", "Up to 5 audio clips per request"],
  ["Generation speed", "Volcengine reports twice the generation speed of Seedance 2.5; actual waiting time depends on the request and platform."],
  ["Announced 720p price", "Approximately CNY 0.99 per output second for text-to-video and image-to-video"],
  ["API rollout", "Announced for November 15, 2026 on Volcengine Ark; this is a planned rollout, not a confirmed DreamFace launch."]
] as const;

export const faqs = [
  ["What is Seedance 2.5 Flash?", "Seedance 2.5 Flash is a faster, lower-cost AI video model in ByteDance's Seedance 2.5 family. Volcengine announced it on November 12, 2026 for frequent creation and batch content production, with clips up to 30 seconds and 480p or 720p output."],
  ["How is Seedance 2.5 Flash different from Seedance 2.5?", "Volcengine positions Flash close to the flagship in overall output quality, with twice the generation speed and a lower announced 720p generation price. The flagship remains the quality-focused option. These are the provider's claims, rather than an independent DreamFace benchmark."],
  ["Does Seedance 2.5 Flash support image-to-video?", "Yes. The announcement covers both text-to-video and image-to-video, as well as multimodal references. It lists maximum inputs of 10 images, 5 videos and 5 audio clips per request. Exact controls and permitted input combinations depend on the platform's implementation."],
  ["How long can a Seedance 2.5 Flash video be?", "The announced maximum is 30 seconds for a single generated clip. This is a maximum capability, not a guarantee that every platform will expose every duration."],
  ["Does Seedance 2.5 Flash generate audio?", "The official examples include sound, music and voice-over, and the announcement discusses audio performance and audio references. It does not specify every language, voice control or speech limit, so those details should be checked in the platform or API documentation."],
  ["Does Seedance 2.5 Flash support 1080p or 4K?", "The Flash announcement lists 480p and 720p output. It discusses 1080p and upcoming 4K separately for the flagship Seedance 2.5 workflow. Those flagship capabilities should not be assumed to apply to Flash."],
  ["How much does Seedance 2.5 Flash cost?", "Volcengine announced approximately CNY 0.99 per output second for 720p text-to-video and image-to-video, about 34% less than Seedance 2.5 for that comparison. At that reference rate, a 10-second clip is approximately CNY 9.90. This is the provider's announced price, not a DreamFace credit quote or a promise of future rates."],
  ["When will the Seedance 2.5 Flash API be available?", "The November 12 announcement schedules API availability on Volcengine Ark for November 15, 2026. It also names a progressive rollout to Jimeng, LibTV, Updream, Creao AI and TapNow. Access can vary by platform and account; the scheduled date is not proof that the API is already live."],
  ["Can I use Seedance 2.5 Flash on DreamFace now?", "Seedance 2.5 Flash is not currently connected to DreamFace Studio. This page is an English model guide with official demonstration videos. The Seedance 2.0 workspace and other available generators are separate options, identified by their actual model names."],
  ["Where do these demonstration videos come from?", "The three embedded videos are served directly from the CDN links used on Dreamina’s official Seedance 2.5 Flash page. They illustrate product motion, an animated marketing poster and a storyboard shot. They are not DreamFace generations or an independently verified benchmark. The telescope-ad comparison discussed on this page is a separate example from Volcengine’s launch article."],
  ["How should I write prompts for this kind of video?", "Describe the subject, setting, action order, camera movement and sound. Give important product or character details a clear reference. Keep the action sequence achievable within the selected duration, and state the exact words and timing if speech matters. Review the result for continuity, text accuracy and audio timing."]
] as const;
