import Link from "next/link";
import { videoExampleFor, videoModelConfig } from "../studio/video-models";
import { estimateGenerationCredits } from "../../lib/model-pricing";

export const CONTENT_REVIEWED_AT = "2026-11-10";
const providers = ["minimax-h3-max-turbo-video", "grok-video", "flux-3-max-video"];

export function videoEvidence(workflow: "text-to-video" | "image-to-video") {
  return providers.flatMap(provider => {
    const example = videoExampleFor(provider, workflow), config = videoModelConfig(provider);
    if (!example || !config) return [];
    const credits = estimateGenerationCredits({ mode: "video", provider, duration: example.settings.duration, resolution: example.settings.resolution || config.defaultResolution, hasReferences: workflow === "image-to-video", referenceCount: workflow === "image-to-video" ? 1 : 0, generateAudio: example.settings.generateAudio });
    const params = new URLSearchParams({ mode: "video", workflow, provider, duration: example.settings.duration, resolution: example.settings.resolution || config.defaultResolution, ratio: example.settings.ratio, prompt: example.prompts[0] });
    if (workflow === "image-to-video" && example.sourceImageUrl) params.set("reference", example.sourceImageUrl);
    return [{ provider, example, credits, href: `/studio?${params}`, source: `https://fal.ai/models/${provider === "grok-video" ? "xai/grok-imagine-video/v1.5/lite" : provider === "flux-3-max-video" ? "blackforestlabs/flux-3-max" : "minimax/h3-max-turbo"}/${workflow}`, resolution: example.settings.resolution || config.defaultResolution }];
  });
}

export function VideoEvidence({ workflow }: { workflow: "text-to-video" | "image-to-video" }) {
  return <section className="border-t border-[#e8e6f0] py-14" id={`${workflow}-examples`}>
    <p className="text-xs font-semibold uppercase tracking-widest text-[#7554df]">Examples and settings</p>
    <h2 className="mt-3 text-3xl font-bold">{workflow === "image-to-video" ? "See an image become a video" : "See prompts become moving scenes"}</h2>
    <p className="mt-4 max-w-3xl text-sm leading-7 text-[#596579]">These supplier examples already appear in DreamFace Studio. Each uses a different scene, so compare the workflows and settings rather than treating them as a controlled quality ranking. Credit estimates use current DreamFace pricing; they are not historical charges for the example clips.</p>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-3">{videoEvidence(workflow).map(({ provider, example, credits, href, source, resolution }) => <article key={provider} className="min-w-0 overflow-hidden rounded-2xl border border-[#e8e6f0] bg-white">
      {example.sourceImageUrl ? <div className="flex items-center gap-3 border-b border-[#e8e6f0] p-3"><img src={example.sourceImageUrl} alt="Source frame for the supplier video example" loading="lazy" className="h-16 w-20 rounded-lg object-cover" /><span className="text-xs text-[#596579]">Input image</span></div> : null}
      <video src={example.videoUrl} poster={example.posterUrl} controls playsInline preload="none" aria-label={`${example.modelLabel} ${workflow} example`} className="aspect-video w-full bg-[#17122e] object-contain" />
      <div className="p-5"><h3 className="text-lg font-bold">{example.modelLabel}</h3><p className="mt-2 text-sm text-[#596579]">{example.settings.duration} · {resolution} · {example.settings.ratio} · {credits} credits estimated</p>
        <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer font-semibold text-[#6548d0]">View the original prompt</summary><p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-[#596579]">{example.prompts[0]}</p></details>
        <Link href={href} rel="nofollow" data-growth-cta="example" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#7554df] px-4 py-3 text-sm font-bold text-white">Try these settings</Link>
        <a href={source} target="_blank" rel="noopener noreferrer" className="mt-4 block text-xs text-[#596579] underline">Supplier model and source</a>
      </div>
    </article>)}</div>
    <p className="mt-5 text-xs leading-6 text-[#667084]">Settings and pricing reviewed {CONTENT_REVIEWED_AT}. Generation is variable; the same inputs can produce a different result. Check the estimate in Studio before submitting.</p>
  </section>;
}
