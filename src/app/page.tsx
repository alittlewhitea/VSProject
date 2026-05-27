import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { HomeHeroCarousel } from "../components/home-hero-carousel";
import { PageAnalytics } from "../components/page-analytics";
import { Reveal } from "../components/reveal";
import { TopNav } from "../components/top-nav";
import { AppButton } from "../components/ui/button";
import { CREDIT_PACKS, formatUsd } from "../lib/billing";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";
import { LEGAL_DOCUMENTS } from "../lib/legal";

const imageProviders = ["ChatGPT Image 2", "Flux 2", "Recraft Pro"];
const videoProviders = ["Seedance 2.0", "Kling 3.0", "Veo 3.1"];
const heroImageModels = [
  "GPT Image 2",
  "GPT Image 1.5",
  "Nano Banana 2",
  "Nano Banana Pro",
  "Seedream 4.0",
  "FLUX.2 max",
  "MAI-Image-2",
  "Imagen 4 Ultra",
  "Qwen Image Max"
];
const heroVideoModels = [
  "Seedance 2.0",
  "Kling 3.0 Omni",
  "Kling 3.0 Pro",
  "Veo 3.1",
  "Veo 3.1 Fast",
  "Sora 2",
  "grok-imagine-video",
  "PixVerse V6",
  "Wan 2.6"
];
const useCases = [
  {
    title: "Performance Marketing",
    desc: "Generate ad variants across image and video for rapid A/B iteration."
  },
  {
    title: "Product Storytelling",
    desc: "Create launch visuals and motion trailers from one content prompt."
  },
  {
    title: "Creative Operations",
    desc: "Standardize provider routing and reduce manual handoffs for teams."
  }
];
const plans = [
  { name: "Trial Credits", price: "Free", note: "For new accounts", credits: "120 signup credits included", href: "/studio?mode=image&workflow=text-to-image" },
  ...CREDIT_PACKS.map((pack) => ({
    name: pack.name,
    price: formatUsd(pack.amountCents),
    note: pack.id === "studio" ? "Best value" : "Top up when needed",
    credits: `${pack.credits.toLocaleString()} credits · ${pack.idealFor}`,
    href: "/billing"
  }))
];
const faqs = [
  {
    q: "What is DreamFace?",
    a: "DreamFace is an AI creative studio for generating images and videos in one workspace. Creators can move from prompt ideas to AI image generation, AI image editing, and AI video tasks while keeping models, credits, history, and outputs organized."
  },
  {
    q: "Which AI generation tools are available in DreamFace?",
    a: "DreamFace currently focuses on an AI image generator and an AI video generator. The image studio supports text-to-image and image-to-image creation, while the video studio supports text-to-video workflows across selected models."
  },
  {
    q: "Does DreamFace support text-to-image and image-to-image?",
    a: "Yes. You can create an image from a text prompt or add reference images for image-to-image editing. The studio keeps prompt controls and model selection in the same composer so you can choose the right image workflow without changing tools."
  },
  {
    q: "Does DreamFace support text-to-video and image-to-video?",
    a: "DreamFace currently exposes text-to-video generation in Video Studio. Image-to-video is a related AI video workflow we can add as model coverage expands, so the product stays clear about what is available now."
  },
  {
    q: "Which AI models can I use?",
    a: "Model options depend on the workflow. Image creation includes providers such as GPT Image 2, Nano Banana 2, and FLUX Schnell, and video creation includes routed providers such as Seedance, Kling, Veo, and Grok Imagine Video."
  },
  {
    q: "Can I see generation cost before I create?",
    a: "Yes. DreamFace uses credits and shows the estimated credit cost on the generation action before a task is submitted. Billing and creation history keep purchases, balances, and generation tasks easier to trace."
  },
  {
    q: "What happens if an AI generation task fails?",
    a: "Generation tasks keep a visible status trail. Failed jobs can show charge and refund information in task details so paid image and video generation stays understandable instead of disappearing behind a spinner."
  },
  {
    q: "Can I browse prompts before opening the studio?",
    a: "Yes. The DreamFace prompt gallery is a starting point for visual ideas, model examples, and reusable prompts before you open the AI image or video workspace."
  },
  {
    q: "Does DreamFace include AI music or AI voice generation?",
    a: "Not on the current homepage workflow. DreamFace is centered on AI image generation and AI video generation today, rather than presenting an AI music generator or AI voice generator that is not ready in the studio."
  },
  {
    q: "Can I use generated content in client or commercial projects?",
    a: "Use depends on the applicable DreamFace terms, the selected provider or model, your inputs, and third-party rights such as trademarks, copyrighted material, and personal likeness. Review the license and terms for the project before publishing or monetizing output."
  }
];

const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a
    }
  }))
};

const HERO_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

async function getHeroImages() {
  try {
    const imageDir = path.join(process.cwd(), "public", "images");
    const files = await fs.readdir(imageDir);
    return files
      .filter((file) => HERO_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((file) => `/images/${encodeURIComponent(file)}`);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const heroImages = await getHeroImages();
  const galleryItems = (await fetchPublishedGalleryItems({ limit: 8, featuredFirst: true }).catch(() => []))
    .map(mapGalleryRow)
    .slice(0, 8);

  return (
    <main className="bg-grid pb-16">
      <PageAnalytics eventName="home_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
      />
      <div className="mx-auto max-w-[1540px] px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <Reveal>
          <HomeHeroCarousel images={heroImages} />
        </Reveal>

        <Reveal>
          <section className="hidden relative overflow-hidden rounded-[2.25rem] border border-black/5 bg-[#f7f9fc] shadow-[0_32px_90px_rgba(35,51,89,0.16)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(62,130,246,0.16),transparent_30%),radial-gradient(circle_at_84%_16%,rgba(23,169,154,0.14),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fbff_45%,#f7fffb_100%)]" />
            <div className="relative grid min-h-[680px] gap-8 px-5 py-8 md:px-10 md:py-12 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
              <div className="max-w-2xl">
                <div className="inline-flex flex-wrap gap-2 rounded-full border border-black/10 bg-white/76 p-1.5 shadow-[0_12px_30px_rgba(23,35,61,0.08)] backdrop-blur">
                  <span className="rounded-full bg-[#1d1d1f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">Image</span>
                  <span className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#35756e]">Video</span>
                  <span className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#725da6]">Voiceover</span>
                </div>

                <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-[#687386]">DreamFace AI Creative Studio</p>
                <h1 className="mt-5 text-5xl font-semibold leading-[0.96] tracking-tight text-[#101827] sm:text-6xl md:text-7xl">
                  Turn ideas into campaign-ready AI visuals.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#53627b] sm:text-lg sm:leading-8">
                  Create images, videos, and voiceover-ready assets from one clean studio. Route work across leading models, keep tasks running in the background, and manage every result in your account.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/studio?mode=image&workflow=text-to-image"
                    className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/15 transition-transform duration-150 active:scale-[0.98]"
                  >
                    Open Studio
                  </Link>
                  <Link
                    href="/gallery"
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1f] shadow-sm transition-transform duration-150 active:scale-[0.98]"
                  >
                    Explore prompts
                  </Link>
                </div>

                <div className="mt-9 grid gap-3 sm:grid-cols-3">
                  {[
                    { value: "No subscription", label: "Credits-based wallet" },
                    { value: "Background tasks", label: "Close the page safely" },
                    { value: "Refund visible", label: "Failed jobs are traceable" }
                  ].map((item) => (
                    <div key={item.value} className="rounded-2xl border border-black/10 bg-white/72 p-4 backdrop-blur">
                      <p className="text-sm font-semibold text-[#172033]">{item.value}</p>
                      <p className="mt-1 text-xs leading-5 text-[#667084]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[540px]">
                <div className="absolute left-4 top-4 z-10 rounded-2xl border border-black/10 bg-white/86 px-4 py-3 shadow-[0_16px_38px_rgba(23,35,61,0.13)] backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#667084]">Live routing</p>
                  <p className="mt-1 text-sm font-semibold text-[#172033]">GPT Image 2 · Seedance · Kling</p>
                </div>

                <div className="absolute right-2 top-20 grid w-[76%] grid-cols-2 gap-3 sm:right-8">
                  {(galleryItems.length ? galleryItems.slice(0, 4) : []).map((item, index) => (
                    <Link
                      key={item.id}
                      href={galleryItemPath(item)}
                      className={`group overflow-hidden rounded-[1.5rem] border border-white/70 bg-white shadow-[0_22px_50px_rgba(23,35,61,0.16)] ${
                        index === 1 ? "translate-y-10" : index === 2 ? "-translate-y-3" : ""
                      }`}
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-[#eef2f7]">
                        <img
                          src={item.thumbnailUrl || item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      </div>
                    </Link>
                  ))}
                  {!galleryItems.length
                    ? ["Image task", "Video scene", "Product shot", "Campaign asset"].map((label, index) => (
                        <div
                          key={label}
                          className={`aspect-[4/5] rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-white via-[#edf4ff] to-[#eefaf6] p-4 shadow-[0_22px_50px_rgba(23,35,61,0.16)] ${
                            index === 1 ? "translate-y-10" : index === 2 ? "-translate-y-3" : ""
                          }`}
                        >
                          <p className="text-sm font-semibold text-[#172033]">{label}</p>
                        </div>
                      ))
                    : null}
                </div>

                <div className="absolute bottom-8 left-0 right-0 mx-auto max-w-md rounded-[1.5rem] border border-black/10 bg-white/88 p-4 shadow-[0_22px_55px_rgba(23,35,61,0.14)] backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#667084]">Generation queue</p>
                      <p className="mt-1 text-sm font-semibold text-[#172033]">DreamFace keeps work running after you leave</p>
                    </div>
                    <span className="rounded-full bg-[#eefaf3] px-3 py-1 text-xs font-semibold text-[#197a46]">Synced</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e6ebf4]">
                    <div className="h-full w-[72%] rounded-full bg-[#17a99a]" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <section className="mx-auto mt-5 w-full max-w-6xl min-w-0">
          <div className="rounded-[1.5rem] border border-black/10 bg-white/78 p-3 shadow-[0_16px_42px_rgba(83,111,170,0.09)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607088]">Supported Model Routing</p>
              <p className="text-[11px] text-[#8a94a6]">Image + Video</p>
            </div>
            <div className="model-ticker relative min-w-0 overflow-hidden py-1">
              <div className="model-ticker-track flex w-max gap-2">
                {[...heroImageModels.map((model) => ({ model, type: "Image" })), ...heroVideoModels.map((model) => ({ model, type: "Video" })), ...heroImageModels.map((model) => ({ model, type: "Image" })), ...heroVideoModels.map((model) => ({ model, type: "Video" }))].map((item, index) => (
                  <span
                    key={`${item.type}-${item.model}-${index}`}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${
                      item.type === "Image"
                        ? "border-[#d7e5ff] bg-[#f8fbff] text-[#365b86]"
                        : "border-[#cbeee8] bg-[#f7fffb] text-[#35756e]"
                    }`}
                  >
                    {item.type}: {item.model}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {galleryItems.length ? (
          <section id="products" className="section-shell mt-14 md:mt-20">
            <Reveal>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#7c7c84]">Prompt Gallery</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                    Start from proven visual prompts
                  </h3>
                </div>
                <Link href="/gallery" className="text-sm font-semibold text-[#1d1d1f]">
                  Browse gallery -&gt;
                </Link>
              </div>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {galleryItems.map((item, index) => (
                <Reveal key={item.id} delayMs={index * 45}>
                  <Link
                    href={galleryItemPath(item)}
                    className="card group block h-full overflow-hidden rounded-2xl bg-white"
                  >
                    <div className="aspect-[4/5] overflow-hidden bg-[#eef2f7]">
                      <img
                        src={item.thumbnailUrl || item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full border border-black/10 bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#4c5a70]">
                          {item.category}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-[#8792a5]">{item.model}</span>
                      </div>
                      <h4 className="mt-3 line-clamp-2 text-base font-semibold tracking-tight">{item.title}</h4>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#667084]">{item.prompt}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section-shell mt-14 grid gap-5 md:mt-20 md:grid-cols-2">
          <Reveal delayMs={50}>
            <article className="card tone-violet motion-smooth lift-soft rounded-3xl p-8">
              <p className="text-xs uppercase tracking-[0.16em] text-[#7c7c84]">Product 01</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Image Studio</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#6e6e73]">
                Prompt-to-image generation with fast iteration loops, style consistency, and export-ready assets.
              </p>
            </article>
          </Reveal>
          <Reveal delayMs={120}>
            <article className="card tone-blue motion-smooth lift-soft rounded-3xl p-8">
              <p className="text-xs uppercase tracking-[0.16em] text-[#7c7c84]">Product 02</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Video Studio</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#6e6e73]">
                Text-to-video and image-to-video generation with asynchronous jobs and reliable task tracking.
              </p>
            </article>
          </Reveal>
        </section>

        <section className="section-shell mt-10 grid gap-4 md:mt-12 md:grid-cols-4">
          {[
            { k: "Active teams", v: "1,900+" },
            { k: "Monthly generations", v: "8.4M" },
            { k: "Average queue", v: "< 18s" },
            { k: "Provider uptime", v: "99.95%" }
          ].map((x) => (
            <div key={x.k} className="card motion-smooth lift-soft rounded-2xl bg-white/92 px-5 py-5 text-center">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7c7c84]">{x.k}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{x.v}</p>
            </div>
          ))}
        </section>

        <section id="providers" className="section-shell mt-14 md:mt-20">
          <Reveal>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Provider Selection</h3>
              <Link href="/studio?mode=image&workflow=text-to-image" className="text-sm font-semibold text-[#1d1d1f]">
                See all in studio -&gt;
              </Link>
            </div>
          </Reveal>

          <div className="grid gap-5 lg:grid-cols-2">
            <Reveal delayMs={40}>
              <article className="card tone-blue motion-smooth lift-soft rounded-3xl p-7">
                <p className="text-xs uppercase tracking-[0.16em] text-[#7c7c84]">Image APIs</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {imageProviders.map((x) => (
                    <div key={x} className="rounded-xl border border-black/10 bg-white/90 px-4 py-4 shadow-[0_8px_18px_rgba(18,22,33,0.06)]">
                      <p className="text-lg font-semibold">{x}</p>
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>

            <Reveal delayMs={100}>
              <article className="card tone-mint motion-smooth lift-soft rounded-3xl p-7">
                <p className="text-xs uppercase tracking-[0.16em] text-[#7c7c84]">Video APIs</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {videoProviders.map((x) => (
                    <div key={x} className="rounded-xl border border-black/10 bg-white/90 px-4 py-4 shadow-[0_8px_18px_rgba(18,22,33,0.06)]">
                      <p className="text-lg font-semibold">{x}</p>
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        <section className="section-shell mt-14 md:mt-20">
          <Reveal>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Built for real workflows</h3>
              <p className="hidden text-sm text-[#6e6e73] md:block">Three common launch scenarios.</p>
            </div>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {useCases.map((u, i) => (
              <Reveal key={u.title} delayMs={i * 70}>
                <article className={`card motion-smooth lift-soft rounded-2xl p-7 ${i === 0 ? "tone-peach" : i === 1 ? "tone-violet" : "tone-mint"}`}>
                  <h4 className="text-2xl font-semibold tracking-tight">{u.title}</h4>
                  <p className="mt-3 text-sm leading-7 text-[#565b6a]">{u.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="platform" className="section-shell mt-14 md:mt-20">
          <Reveal>
            <div className="card motion-smooth lift-soft rounded-3xl p-8 md:p-10">
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Built for production teams.</h3>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  "Model routing by quality and cost",
                  "Credits forecasting before generation",
                  "Async queue with status visibility",
                  "Unified UX across image and video"
                ].map((x) => (
                  <div key={x} className="chip rounded-xl px-4 py-3 text-sm text-[#4e5260]">
                    {x}
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <AppButton href="/studio?mode=image&workflow=text-to-image" variant="dark">Start Building</AppButton>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="section-shell mt-14 md:mt-20" id="pricing">
          <Reveal>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Credits that never feel like a subscription</h3>
              <Link href="/billing" className="text-sm font-semibold text-[#1d1d1f]">Open wallet -&gt;</Link>
            </div>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((p, i) => (
              <Reveal key={p.name} delayMs={i * 60}>
                <article className={`card motion-smooth lift-soft rounded-2xl p-7 ${i === 0 ? "tone-blue" : i === 1 ? "tone-violet" : "tone-pink"}`}>
                  <p className="text-sm text-[#6e6e73]">{p.note}</p>
                  <h4 className="mt-2 text-3xl font-semibold tracking-tight">{p.name}</h4>
                  <p className="mt-4 text-4xl font-semibold tracking-tight">{p.price}</p>
                  <p className="mt-2 text-sm text-[#5a6070]">{p.credits}</p>
                  <div className="mt-6">
                    <AppButton href={p.href} variant="dark" size="md">Get credits</AppButton>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section-shell mt-14 md:mt-20">
          <Reveal>
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">DreamFace FAQ</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Frequently asked questions</h3>
              <p className="mt-4 text-base leading-8 text-[#586579]">
                Learn how the DreamFace AI image generator, AI video generator, text-to-image, image-to-image, and text-to-video workflows fit into one creative studio with model routing, prompt references, credits, and creation history.
              </p>
            </div>
          </Reveal>
          <div className="mt-7 grid gap-3 lg:grid-cols-2">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delayMs={i * 60}>
                <article className={`card motion-smooth lift-soft h-full rounded-2xl p-6 ${i % 3 === 0 ? "tone-blue" : i % 3 === 1 ? "tone-peach" : "tone-mint"}`}>
                  <h4 className="text-lg font-semibold tracking-tight">{f.q}</h4>
                  <p className="mt-2 text-sm leading-7 text-[#606676]">{f.a}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-14 md:mt-20">
          <Reveal>
            <div className="card hero-sheen relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f3f7ff] via-white to-[#f5f0ff] px-7 py-10 text-center md:px-12">
              <div className="orb -left-8 bottom-2 h-24 w-24 bg-[#ffd5b6]" />
              <div className="orb right-0 top-0 h-28 w-28 bg-[#c6dbff]" />
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">Design less around APIs. Build more around outcomes.</h3>
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-[#6e6e73]">
                Launch faster with one clean studio for image and video generation.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <AppButton href="/studio?mode=image&workflow=text-to-image" variant="primary">Start in Studio</AppButton>
                <AppButton variant="secondary">Contact sales</AppButton>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="mt-16 rounded-3xl bg-gradient-to-br from-[#dff3fa] via-[#e8f8ff] to-[#efeefe] px-7 py-9">
          <div className="grid gap-7 border-b border-black/10 pb-7 md:grid-cols-5">
            <div>
              <p className="text-2xl font-semibold tracking-tight">dreamface</p>
              <p className="mt-2 text-sm text-[#506170]">Unified image + video generation infrastructure.</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Products</p>
              <p className="mt-2 text-sm text-[#4f5a67]">Image Studio</p>
              <p className="text-sm text-[#4f5a67]">Video Studio</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Platform</p>
              <p className="mt-2 text-sm text-[#4f5a67]">Provider routing</p>
              <p className="text-sm text-[#4f5a67]">Credits billing</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Company</p>
              <Link href="/about" className="mt-2 block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">About Us</Link>
              <p className="text-sm text-[#4f5a67]">Documentation</p>
              <p className="text-sm text-[#4f5a67]">Contact</p>
            </div>
            <div>
              <p className="text-sm font-semibold">License & Terms</p>
              <div className="mt-2 grid gap-1">
                {LEGAL_DOCUMENTS.map((document) => (
                  <Link key={document.slug} href={`/legal/${document.slug}`} className="text-sm text-[#4f5a67] hover:text-[#1d1d1f]">
                    {document.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <p className="pt-5 text-xs text-[#667180]">(c) 2026 DreamFace. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
