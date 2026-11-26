import { locales } from "../i18n/routing";
import {
  CHEAPEST_CREDIT_USAGE_REFERENCE,
  CREDIT_PACKS,
  cheapestCreditUsageCapacity,
  formatUsd
} from "./billing";
import { LEGAL_DOCUMENTS } from "./legal";
import { MODEL_PRICING_ROWS, type ModelPricingRow } from "./model-pricing";
import { isRetiredProvider } from "./retired-providers";
import { absoluteUrl, siteUrl } from "./site-url";

function activeLowestRowsByMode(mode: ModelPricingRow["mode"]) {
  const seen = new Set<string>();
  const rows: ModelPricingRow[] = [];
  for (const row of MODEL_PRICING_ROWS) {
    if (row.mode !== mode || isRetiredProvider(row.provider)) continue;
    const key = `${row.provider}:${row.workflow}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows.sort((a, b) => a.typicalCredits - b.typicalCredits);
}

function formatModelLine(row: ModelPricingRow) {
  const details = [row.workflow];
  if (row.referenceResolution) details.push(row.referenceResolution);
  if (row.referenceDuration) details.push(row.referenceDuration);
  const creditsLabel = row.typicalCredits === 0 ? "0 credits (limited promo)" : `${row.typicalCredits} credits`;
  return `- **${row.label}** (${details.join(" · ")}): ~${creditsLabel}`;
}

export function buildLlmsTxt(baseUrl = siteUrl()): string {
  const starter = CREDIT_PACKS.find((pack) => pack.id === "starter") ?? CREDIT_PACKS[0];
  const ref = CHEAPEST_CREDIT_USAGE_REFERENCE;

  const packLines = CREDIT_PACKS.map((pack) => {
    const capacity = cheapestCreditUsageCapacity(pack.credits);
    const discount = starter
      ? Math.max(0, Math.floor((1 - (pack.amountCents / pack.credits) / (starter.amountCents / starter.credits)) * 100))
      : 0;
    const multiple = starter ? Math.max(1, Math.round(pack.amountCents / starter.amountCents)) : 1;
    const bonus = starter && pack.id !== "starter" ? Math.max(0, pack.credits - multiple * starter.credits) : 0;
    const tagParts: string[] = [];
    if (pack.id === "creator") tagParts.push("Most Popular");
    if (pack.id === "pro-topup") tagParts.push("Best Value");
    if (discount > 0) tagParts.push(`${discount}% off vs Starter`);
    if (bonus > 0) tagParts.push(`+${bonus.toLocaleString("en-US")} bonus credits`);
    const tagText = tagParts.length ? ` (${tagParts.join(" · ")})` : "";
    return `- **${pack.name}** — ${formatUsd(pack.amountCents)} USD for ${pack.credits.toLocaleString("en-US")} credits${tagText}: up to ${capacity.images.toLocaleString("en-US")} images, ${capacity.videos.toLocaleString("en-US")} videos (${ref.video.seconds}s ${ref.video.resolution}), ${capacity.avatars.toLocaleString("en-US")} avatar clips, or ${capacity.voiceovers.toLocaleString("en-US")} voiceovers (${ref.audio.characters.toLocaleString("en-US")} chars).`;
  });

  const videoModels = activeLowestRowsByMode("video").slice(0, 10).map(formatModelLine);
  const imageModels = activeLowestRowsByMode("image").slice(0, 10).map(formatModelLine);
  const audioModels = activeLowestRowsByMode("audio").slice(0, 6).map(formatModelLine);

  const lines: string[] = [
    "# DreamFace",
    "",
    "> DreamFace is an all-in-one pay-as-you-go AI creative studio for AI video generation, AI image creation and editing, talking AI avatars, voice synthesis, and AI music. One shared credit balance works across every tool with one-time credit packs, no subscription, no automatic renewal, non-expiring purchased credits, and automatic credit refunds on failed generations.",
    "",
    "## Pay-as-You-Go Credit Packs",
    "",
    `Entitlement benchmarks use our most affordable active models: ${ref.image.model} (${ref.image.credits} cr/image), ${ref.video.model} (${ref.video.seconds}s ${ref.video.resolution}, ${ref.video.credits} cr/video & avatar clip), and ${ref.audio.model} (${ref.audio.credits} cr per ${ref.audio.characters.toLocaleString("en-US")} characters standard rate).`,
    "",
    ...packLines,
    "",
    `- [Pricing & Credit Packs](${absoluteUrl(baseUrl, "/en/price")}): Full pay-as-you-go pack comparison, interactive output estimator, and live model credit guide.`,
    "",
    "## Core Studio & Feature Pages",
    "",
    `- [DreamFace Creative Studio](${absoluteUrl(baseUrl, "/studio")}): Unified browser workspace for Video, Image, Avatar, and Audio generation.`,
    `- [AI Text to Video](${absoluteUrl(baseUrl, "/video/text-to-video")}): Generate videos with native audio from text prompts.`,
    `- [AI Image to Video](${absoluteUrl(baseUrl, "/video/image-to-video")}): Animate still images and start/end keyframes into video.`,
    `- [AI Avatar Generator](${absoluteUrl(baseUrl, "/avatar/ai-avatar-generator")}): Create talking presenter and avatar videos from portraits and voice audio.`,
    `- [AI Text to Image](${absoluteUrl(baseUrl, "/image/text-to-image")}): Generate, edit, upscale, and remove backgrounds from images.`,
    `- [Video Model Examples](${absoluteUrl(baseUrl, "/video/examples")}): Curated output showcase across active video models.`,
    `- [Seedance 2.5 Flash](${absoluteUrl(baseUrl, "/video/seedance-2-5-flash")}): Fast multimodal text/image/reference-to-video with native audio.`,
    `- [Seedance 2.0](${absoluteUrl(baseUrl, "/video/seedance-2")}): Cinematic motion video generation up to 4K.`,
    `- [Gemini Omni Flash 1.2](${absoluteUrl(baseUrl, "/video/gemini-omni")}): Synchronized native-audio video generation from 360p to 4K.`,
    `- [Community Gallery](${absoluteUrl(baseUrl, "/gallery")}): Public gallery of AI images and prompts.`,
    `- [About DreamFace](${absoluteUrl(baseUrl, "/about")}): Product overview and platform background.`,
    "",
    "## Active Models & Typical Credit Costs",
    "",
    "### Video & Avatar Models",
    ...videoModels,
    "",
    "### Image Models",
    ...imageModels,
    "",
    "### Voice & Music Models",
    ...audioModels,
    "",
    "## Comparisons",
    "",
    `- [Compare Overview](${absoluteUrl(baseUrl, "/compare")}): Side-by-side comparison hub for DreamFace vs major AI creative platforms.`,
    `- [DreamFace vs HeyGen](${absoluteUrl(baseUrl, "/compare/dreamface-vs-heygen")}): Pay-as-you-go credits and multi-model studio compared with HeyGen.`,
    `- [DreamFace vs Runway](${absoluteUrl(baseUrl, "/compare/dreamface-vs-runway")}): Video, image, avatar, and pricing comparison with Runway.`,
    `- [DreamFace vs Kling AI](${absoluteUrl(baseUrl, "/compare/dreamface-vs-kling-ai")}): Multi-model access and pay-as-you-go credit pricing vs Kling AI.`,
    `- [DreamFace vs Higgsfield](${absoluteUrl(baseUrl, "/compare/dreamface-vs-higgsfield")}): Creative workflows and one-time credit packs vs Higgsfield.`,
    `- [DreamFace vs Pika](${absoluteUrl(baseUrl, "/compare/dreamface-vs-pika")}): AI video capabilities and credit flexibility vs Pika.`,
    `- [DreamFace vs Artlist](${absoluteUrl(baseUrl, "/compare/dreamface-vs-artlist")}): All-in-one AI studio without annual subscriptions vs Artlist.`,
    "",
    "## Optional",
    "",
    `- [Sitemap](${absoluteUrl(baseUrl, "/sitemap.xml")}): Complete XML index of public pages across all ${locales.length} supported locales (${locales.join(", ")}).`,
    `- [Site Search for Agents](${absoluteUrl(baseUrl, "/.well-known/search")}): Cloudflare Search for Agents endpoint for querying public DreamFace pages in Markdown.`,
    ...LEGAL_DOCUMENTS.map(
      (doc) => `- [${doc.title}](${absoluteUrl(baseUrl, `/legal/${doc.slug}`)}): ${doc.summary}`
    )
  ];

  return `${lines.join("\n")}\n`;
}
