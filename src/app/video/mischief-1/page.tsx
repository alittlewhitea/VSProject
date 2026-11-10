import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "../../../components/top-nav";
import { SiteFooter } from "../../../components/site-footer";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { estimateGenerationCredits } from "../../../lib/model-pricing";
import { MISCHIEF_PROVIDER, mischiefCostUsd } from "../../../lib/mischief";

const path = "/video/mischief-1";
const reviewedAt = "2026-11-10";
const title = "TBC mischief 1 Image-to-Video Generator | DreamFace";
const description = "Animate a starting image with TBC mischief 1. Explore 3- or 5-second landscape clips at 480p or 720p, with current credit estimates and practical prompt guidance.";
const studio = `/studio?mode=video&workflow=image-to-video&provider=${MISCHIEF_PROVIDER}&duration=5s&resolution=720p&ratio=16%3A9`;
const sourceImage = "https://tbc-public-assests.s3.us-west-2.amazonaws.com/fal/seed-image.png";
const examplePrompt = "Locked camera in a misty pumpkin field at night. A glowing jack-o'-lantern face gradually appears on the foreground pumpkin. Keep the pumpkin in place and hold the final expression.";

export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: absoluteUrl(siteUrl(), path) },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: absoluteUrl(siteUrl(), path), type: "website", images: [absoluteUrl(siteUrl(), "/images/mischief-1/start-image.webp")] },
  twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(siteUrl(), "/images/mischief-1/start-image.webp")] }
};

const faqs = [
  ["What is TBC mischief 1?", "Mischief 1 is an image-to-video model from The Biological Computing Co. It combines a starting image with a description of motion to make a short video. Its short clips and low listed API rates make it an option for exploring concepts, planning shots and trying different motion ideas."],
  ["What does neuron-derived mean?", "TBC says its research studies real neurons to find computational ideas that can be implemented in software. The deployed video model runs on conventional AI hardware; living neurons do not generate your video. This describes TBC's approach, rather than an independent performance benchmark by DreamFace."],
  ["What does mischief 1 cost?", "The fal API lists $0.005 per requested second at 480p and $0.01 at 720p. A five-second request is therefore $0.025 or $0.05 at those API rates. DreamFace charges credits under its own pricing policy; the table above and the estimate in Studio show the applicable credit quote."],
  ["Which video settings are supported?", "Choose a 3- or 5-second clip at 480p or 720p. Output is landscape: 832 × 480 pixels at 480p, or 1280 × 720 at 720p, at 16 frames per second. The default is 5 seconds at 720p. This endpoint does not provide a portrait-output setting."],
  ["What inputs do I need?", "Provide one starting image and a prompt describing what should happen. DreamFace accepts JPEG, PNG and WebP uploads; the endpoint limit is 25 MiB and 100 megapixels. It returns an MP4 video. Text-only generation, multiple references and an end frame are not supported by this endpoint."],
  ["How is the starting image fitted to the video?", "DreamFace uses the endpoint's center-crop option, preserving the image's proportions while trimming edges to fill the landscape frame. Keep important faces, labels and products away from the edges, and use a landscape image when possible."],
  ["Why is the downloaded clip slightly longer than 3 or 5 seconds?", "The endpoint renders 49 frames for a 3-second request and 81 for a 5-second request. At 16 fps, the files run for about 3.0625 or 5.0625 seconds. The supplier bills the requested 3 or 5 seconds; DreamFace also calculates credits from that requested duration."],
  ["Can I set a seed or keep my prompt unchanged?", "A seed from 0 to 2147483647 can be entered under More settings. With a fixed seed, DreamFace sends the original prompt so the supplier's prompt rewrite does not introduce another variable. With no seed, it uses the default enhanced-prompt processing. A seed does not guarantee identical results across future model changes."],
  ["Does this workflow generate sound?", "This integration provides video generation without an audio-generation control. If synchronized audio is part of your goal, compare a model that explicitly supports native audio, such as Gemini Omni Flash 1.2."],
  ["When was mischief 1 released?", "OpenRouter records October 30, 2026 as the model's release date. This is the date in its model listing, separate from when DreamFace connected the endpoint."]
];

function credits(duration: string, resolution: string) {
  return estimateGenerationCredits({ mode: "video", provider: MISCHIEF_PROVIDER, duration, resolution, hasReferences: true, referenceCount: 1 });
}

export default function MischiefPage() {
  const schema = [
    { "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: absoluteUrl(siteUrl(), path), dateModified: reviewedAt },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "DreamFace", item: absoluteUrl(siteUrl(), "/en") },
      { "@type": "ListItem", position: 2, name: "TBC mischief 1", item: absoluteUrl(siteUrl(), path) }
    ] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) }
  ];
  return <main className="min-h-screen bg-[#f8faff] text-[#1f2430]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <TopNav />
      <section className="grid items-center gap-10 py-14 md:py-20 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-3"><img src="/model-logos/tbc.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-xl bg-white object-contain p-1" /><p className="text-xs font-bold uppercase tracking-widest text-[#7554df]">The Biological Computing Co.</p></div>
          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">TBC mischief 1.<br />One image. More motion ideas.</h1>
          <p className="mt-6 text-lg leading-8 text-[#596579]">Turn a starting image into a short moving scene. Explore a camera move, sketch a visual mood or test a few creative directions before developing a longer video.</p>
          <div className="mt-6 flex flex-wrap gap-2">{["Image to video", "3 or 5 seconds", "480p / 720p", "Landscape"].map(label => <span key={label} className="rounded-full border border-[#e8e6f0] bg-white px-3 py-2 text-xs font-semibold">{label}</span>)}</div>
          <Link href={studio} data-growth-cta="hero" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-[#7554df] px-6 py-4 font-bold text-white">Create with mischief 1</Link>
          <p className="mt-4 text-sm leading-6 text-[#667084]">5 seconds at 720p: {credits("5s", "720p")} credits estimated. Upload one image to get started.</p>
        </div>
        <figure className="overflow-hidden rounded-3xl border border-[#e8e6f0] bg-white shadow-sm">
          <img src="/images/mischief-1/start-image.webp" alt="Starting image from TBC's published image-to-video example" width={1024} height={576} fetchPriority="high" className="aspect-video w-full bg-[#17122e] object-contain" />
          <figcaption className="p-5 text-sm leading-6 text-[#596579]"><span className="font-semibold text-[#1f2430]">A starting frame, ready for a motion idea.</span><br />Supplier example input from the fal documentation. The image above is a starting frame, not a generated result or a DreamFace benchmark.</figcaption>
        </figure>
      </section>
      <section className="border-t border-[#e8e6f0] py-14">
        <h2 className="text-3xl font-bold">Keep the test short. Make the direction specific.</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-3">{[
          ["Plan a shot", "Test a slow push-in or a small subject movement before committing to a longer scene."],
          ["Explore a visual mood", "Turn a still concept into a brief motion study for a moodboard or presentation."],
          ["Try a variant", "Change one motion instruction at a time. Review framing, subject details and the final moment before choosing a direction."]
        ].map(([heading, text]) => <article key={heading} className="rounded-2xl border border-[#e8e6f0] bg-white p-6"><h3 className="text-xl font-bold">{heading}</h3><p className="mt-3 text-sm leading-7 text-[#596579]">{text}</p></article>)}</div>
      </section>
      <section className="grid gap-8 border-t border-[#e8e6f0] py-14 md:grid-cols-2">
        <div><h2 className="text-3xl font-bold">Start from the image. Describe the change.</h2><ol className="mt-5 list-decimal space-y-4 ps-5 leading-8 text-[#596579]"><li>Upload one clear image you have permission to use. Center important subjects for the landscape crop.</li><li>Describe the subject movement, camera motion and the final frame. Start with one simple action.</li><li>Choose 3 or 5 seconds, pick 480p or 720p and review the credit estimate before generating.</li></ol></div>
        <article className="rounded-2xl bg-[#efebff] p-6"><p className="text-xs font-bold uppercase tracking-widest text-[#6548d0]">Prompt starting point</p><h3 className="mt-3 text-xl font-bold">A still pumpkin becomes a glowing character</h3><p className="mt-4 leading-7 text-[#596579]">{examplePrompt}</p><p className="mt-3 text-xs leading-6 text-[#667084]">DreamFace prompt suggestion using the supplier's input image. No output for this rewritten prompt has been measured.</p><Link href={`${studio}&reference=${encodeURIComponent(sourceImage)}&prompt=${encodeURIComponent(examplePrompt)}`} rel="nofollow" data-growth-cta="example" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#6548d0]">Open image and prompt</Link></article>
      </section>
      <section className="border-t border-[#e8e6f0] py-14">
        <h2 className="text-3xl font-bold">Compare settings and credit estimates</h2>
        <p className="mt-4 max-w-3xl leading-8 text-[#596579]">API rates below come from fal's published documentation. DreamFace credit estimates reflect your chosen resolution and duration, using the current quote calculation in Studio.</p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e8e6f0] bg-white"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b bg-[#f4f1ff]">{["Resolution", "Requested length", "Supplier API estimate", "DreamFace credits"].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{["480p", "720p"].flatMap(resolution => ["3s", "5s"].map(duration => <tr key={`${resolution}-${duration}`} className="border-b"><td className="p-4">{resolution}</td><td className="p-4">{duration}</td><td className="p-4">${mischiefCostUsd(duration, resolution).toFixed(3)}</td><td className="p-4">{credits(duration, resolution)}</td></tr>))}</tbody></table></div>
        <p className="mt-4 text-xs leading-6 text-[#667084]">Reviewed {reviewedAt}. Quotes are based on requested seconds. Check the estimate beside Generate for the current DreamFace charge.</p>
      </section>
      <section className="border-t border-[#e8e6f0] py-14">
        <h2 className="text-3xl font-bold">Mischief 1 frequently asked questions</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2">{faqs.map(([question, answer]) => <article key={question} className="rounded-2xl border border-[#e8e6f0] bg-white p-6"><h3 className="text-lg font-bold">{question}</h3><p className="mt-3 text-sm leading-7 text-[#596579]">{answer}</p></article>)}</div>
        <p className="mt-6 text-sm leading-7 text-[#667084]">Sources: <a href="https://fal.ai/models/tbc/mischief-1/image-to-video/api" target="_blank" rel="noopener noreferrer" className="underline">fal API documentation</a>, <a href="https://www.tbc.co/" target="_blank" rel="noopener noreferrer" className="underline">TBC's technology explanation</a> and <a href="https://openrouter.ai/tbc/mischief-1" target="_blank" rel="noopener noreferrer" className="underline">OpenRouter's model listing</a>.</p>
        <div className="mt-7 flex flex-wrap gap-5"><Link href={studio} data-growth-cta="footer" className="inline-flex min-h-12 items-center rounded-xl bg-[#7554df] px-6 py-4 font-bold text-white">Open mischief 1 in Studio</Link><Link href="/video/image-to-video" className="min-h-11 py-3 font-semibold text-[#6548d0] underline">Image-to-video guide</Link><Link href="/video/gemini-omni" className="min-h-11 py-3 font-semibold text-[#6548d0] underline">Explore Gemini Omni</Link></div>
      </section>
      <SiteFooter />
    </div>
  </main>;
}
