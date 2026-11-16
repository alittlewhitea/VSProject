import { SEEDANCE_FLASH_GUIDE_PATH, SEEDANCE_FLASH_PROVIDER } from "../../../lib/seedance-flash";
import { estimateGenerationCredits } from "../../../lib/model-pricing";

export const PAGE_PATH = SEEDANCE_FLASH_GUIDE_PATH;
export const REVIEWED_AT = "2026-11-12";
export const UPDATED_AT = "2026-11-16";
export const FAL_MODEL_URL = "https://fal.ai/models/bytedance/seedance-2.5/flash/text-to-video";
export const SOURCE_URL = "https://mp.weixin.qq.com/s/lTZS2oV6BuORvK_Shgb-Ag";
export const OFFICIAL_FAMILY_URL = "https://www.volcengine.com/activity/seedance25";
export const DEMO_SOURCE_URL = "https://dreamina.capcut.com/seedance/seedance-2-5-flash";
export const SOCIAL_IMAGE_URL = "https://p16-seeyou-sg.ibyteimg.com/tos-alisg-i-2zwwjm3azk-sg/2fd82ca3cbb44c759bc12fbd2213f29c~tplv-2zwwjm3azk-image.image";
export const PAGE_TITLE = "Seedance 2.5 Flash: Video Examples, Specs & Pricing | DreamFace";
export const PAGE_DESCRIPTION = "Create Seedance 2.5 Flash videos in DreamFace: text, image and multimodal references, 4–30 seconds and 480p/720p. Explore official examples, controls and credit pricing.";
export const SUGGESTED_PROMPT = "Create a 10-second product scene on a wooden table beside a window. A brass telescope rests on a folded navy cloth. Start with a close-up of the metal texture, then slowly pull back to show the complete telescope. Keep its shape and proportions consistent. Warm afternoon light, subtle room ambience, no dialogue, no captions and no added logos.";

export const creditExamples = ["480p", "720p"].map(resolution => ({
  resolution, duration: "5s",
  credits: estimateGenerationCredits({ mode: "video", provider: SEEDANCE_FLASH_PROVIDER, duration: "5s", resolution })
}));

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
  ["Generation workflows", "Text-to-video, image-to-video with optional end frames, and multimodal reference, editing and extension tasks."],
  ["Maximum clip length", "Up to 30 seconds per generated clip"],
  ["Output resolutions", "480p and 720p"],
  ["Image references", "Up to 10 images per request"],
  ["Video references", "Up to 5 video clips per request"],
  ["Audio references", "Up to 5 audio clips per request"],
  ["Generation speed", "Volcengine reports twice the generation speed of Seedance 2.5; actual waiting time depends on the request and platform."],
  ["Announced 720p price", "Approximately CNY 0.99 per output second for text-to-video and image-to-video"],
  ["DreamFace Studio", "Available through fal in Text to Video, Image to Video and Reference Video. Default: 720p, 5 seconds."]
] as const;

export const faqs = [
  ["What is Seedance 2.5 Flash?", "Seedance 2.5 Flash is a faster, lower-cost AI video model in ByteDance's Seedance 2.5 family. Volcengine announced it on November 12, 2026 for frequent creation and batch content production, with clips up to 30 seconds and 480p or 720p output."],
  ["How is Seedance 2.5 Flash different from Seedance 2.5?", "Volcengine positions Flash close to the flagship in overall output quality, with twice the generation speed and a lower announced 720p generation price. The flagship remains the quality-focused option. These are the provider's claims, rather than an independent DreamFace benchmark."],
  ["Does Seedance 2.5 Flash support image-to-video?", "Yes. In DreamFace, upload a start image and optionally an end image. The output follows the source image's aspect ratio. Use Reference Video for up to 10 images, 5 public video URLs and 5 public audio URLs; refer to these in the prompt as @Image1, @Video1 and @Audio1."],
  ["How long can a Seedance 2.5 Flash video be?", "DreamFace exposes durations from 4 to 30 seconds plus automatic duration. The default is 5 seconds at 720p. Automatic duration, automatic reference task selection and video editing are quoted at the 30-second output limit."],
  ["Does Seedance 2.5 Flash generate audio?", "Yes. DreamFace exposes a synchronized-audio toggle. Turning audio on or off does not change the generation price. The Reference Video workflow also accepts public audio URLs; specific voice and language results depend on the supplied prompt and references."],
  ["Does Seedance 2.5 Flash support 1080p or 4K?", "The Flash announcement lists 480p and 720p output. It discusses 1080p and upcoming 4K separately for the flagship Seedance 2.5 workflow. Those flagship capabilities should not be assumed to apply to Flash."],
  ["How much does Seedance 2.5 Flash cost?", `A 5-second text-to-video or image-to-video request currently costs ${creditExamples[0].credits} DreamFace credits at 480p or ${creditExamples[1].credits} credits at 720p. Duration and reference videos affect the quote. Check the Generate button before submitting; Volcengine's announced CNY reference price is separate from DreamFace credit pricing.`],
  ["How are automatic duration and video references priced?", "Automatic duration, automatic reference task selection and video editing are quoted at up to 30 seconds of output. With video references, DreamFace also quotes the combined input-duration limit of 30.2 seconds. These are conservative quotes; successful tasks do not automatically receive a refund based on actual duration. Select a fixed output duration when you want a predictable output-length quote."],
  ["How do I use video and audio references?", "Open Reference Video and select Seedance 2.5 Flash. Upload reference images and enter one public video or audio URL per line. Editing and extension require a reference video. Video and audio inputs must each total no more than 30.2 seconds; the provider validates file size and media properties."],
  ["Can I use Seedance 2.5 Flash on DreamFace now?", "Yes. Select Seedance 2.5 Flash in DreamFace Studio for text-to-video, image-to-video with optional end frames, or image/video/audio reference workflows. Check the Generate button for the credit quote before submitting."],
  ["Where do these demonstration videos come from?", "The three embedded videos are served directly from the CDN links used on Dreamina’s official Seedance 2.5 Flash page. They illustrate product motion, an animated marketing poster and a storyboard shot. They are not DreamFace generations or an independently verified benchmark. The telescope-ad comparison discussed on this page is a separate example from Volcengine’s launch article."],
  ["How should I write prompts for this kind of video?", "Describe the subject, setting, action order, camera movement and sound. Give important product or character details a clear reference. Keep the action sequence achievable within the selected duration, and state the exact words and timing if speech matters. Review the result for continuity, text accuracy and audio timing."]
] as const;
