import Link from "next/link";
import { Reveal } from "../components/reveal";
import { TopNav } from "../components/top-nav";
import { AppButton } from "../components/ui/button";
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
  { name: "Trial Credits", price: "Free", note: "For new accounts", credits: "Signup bonus included" },
  { name: "Creator Pack", price: "$10", note: "Top up when needed", credits: "Pay once, use until spent" },
  { name: "Studio Pack", price: "$50", note: "For heavier creative runs", credits: "Larger prepaid balance" }
];
const faqs = [
  {
    q: "How do you switch between APIs?",
    a: "Provider routing is configured per task in Studio, with a single UX across image and video flows."
  },
  {
    q: "Can I control cost before generating?",
    a: "Yes. Every job shows estimated credit usage before submission."
  },
  {
    q: "Do you support enterprise security requirements?",
    a: "The platform supports private endpoints, audit-friendly task logs, and role-based workflows."
  }
];

export default async function HomePage() {
  const galleryItems = (await fetchPublishedGalleryItems({ limit: 8, featuredFirst: true }).catch(() => []))
    .map(mapGalleryRow)
    .slice(0, 8);

  return (
    <main className="bg-grid pb-16">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <Reveal>
          <section className="relative overflow-hidden rounded-[2.25rem] border border-black/5 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_34%,#f7fffb_68%,#fffaf4_100%)] px-5 py-8 shadow-[0_28px_80px_rgba(72,103,170,0.12)] md:px-10 md:py-10">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#d9cbff]/35 blur-3xl" />
            <div className="absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-[#bdeee5]/35 blur-3xl" />
            <div className="relative mx-auto flex min-h-[520px] max-w-6xl flex-col justify-center">
              <div className="mx-auto max-w-5xl text-center">
                <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                  <span className="rounded-full border border-[#d7e5ff] bg-white/80 px-4 py-2 text-[#38618f] shadow-sm">Image Studio</span>
                  <span className="rounded-full border border-[#cbeee8] bg-white/80 px-4 py-2 text-[#35756e] shadow-sm">Video Studio</span>
                  <span className="rounded-full border border-[#e3d8ff] bg-white/80 px-4 py-2 text-[#725da6] shadow-sm">Prompt Gallery</span>
                </div>

                <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-[#687386]">Unified AI Creation Platform</p>
                <h1 className="mx-auto mt-5 max-w-5xl text-5xl font-semibold leading-[0.98] tracking-tight text-[#172033] sm:text-6xl md:text-7xl">
                  Create images, videos, and campaigns in one workflow.
                </h1>
                <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-[#53627b] sm:text-lg sm:leading-8 md:text-xl md:leading-9">
                  Use curated visual prompts as a starting point, route work across image and video models, and keep every generation organized in one studio.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/studio?mode=image"
                    className="inline-flex items-center justify-center rounded-full bg-[#3b82f6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#8ebcff]/35 transition-transform duration-150 active:scale-[0.98]"
                  >
                    Generate Image
                  </Link>
                  <Link
                    href="/studio?mode=video"
                    className="inline-flex items-center justify-center rounded-full bg-[#17a99a] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#9be2da]/40 transition-transform duration-150 active:scale-[0.98]"
                  >
                    Generate Video
                  </Link>
                  <Link
                    href="/gallery"
                    className="inline-flex items-center justify-center rounded-full bg-[#8b6fe8] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cabdff]/45 transition-transform duration-150 active:scale-[0.98]"
                  >
                    Explore Gallery
                  </Link>
                </div>
              </div>

              <div className="mx-auto mt-10 w-full max-w-5xl min-w-0">
                <div className="rounded-[1.5rem] border border-black/10 bg-white/78 p-3 shadow-[0_16px_42px_rgba(83,111,170,0.11)] backdrop-blur">
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
              </div>
            </div>
          </section>
        </Reveal>

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
              <Link href="/studio" className="text-sm font-semibold text-[#1d1d1f]">
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
                <AppButton href="/studio" variant="dark">Start Building</AppButton>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="section-shell mt-14 md:mt-20" id="pricing">
          <Reveal>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Credits that never feel like a subscription</h3>
              <Link href="/studio" className="text-sm font-semibold text-[#1d1d1f]">Open wallet -&gt;</Link>
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
                    <AppButton href="/studio?mode=image" variant="dark" size="md">Get credits</AppButton>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section-shell mt-14 md:mt-20">
          <Reveal>
            <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Frequently asked questions</h3>
          </Reveal>
          <div className="mt-6 space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delayMs={i * 60}>
                <article className={`card motion-smooth lift-soft rounded-2xl p-6 ${i % 2 === 0 ? "tone-blue" : "tone-peach"}`}>
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
                <AppButton href="/studio" variant="primary">Start in Studio</AppButton>
                <AppButton variant="secondary">Contact sales</AppButton>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="mt-16 rounded-3xl bg-gradient-to-br from-[#dff3fa] via-[#e8f8ff] to-[#efeefe] px-7 py-9">
          <div className="grid gap-7 border-b border-black/10 pb-7 md:grid-cols-5">
            <div>
              <p className="text-2xl font-semibold tracking-tight">nova</p>
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
              <p className="mt-2 text-sm text-[#4f5a67]">Documentation</p>
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
          <p className="pt-5 text-xs text-[#667180]">(c) 2026 Nova Studio. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
