import Link from "next/link";
import { HomeHeroCarousel } from "../components/home-hero-carousel";
import { PageAnalytics } from "../components/page-analytics";
import { Reveal } from "../components/reveal";
import { TopNav } from "../components/top-nav";
import { AppButton } from "../components/ui/button";
import { CREDIT_PACKS, formatUsd } from "../lib/billing";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";
import { LEGAL_DOCUMENTS } from "../lib/legal";

const plans = [
  { name: "Trial Credits", price: "Free", note: "For new accounts", credits: "120 signup credits included", href: "/studio?mode=image&workflow=text-to-image" },
  ...CREDIT_PACKS.map((pack) => ({
    name: pack.name,
    price: formatUsd(pack.amountCents),
    note: pack.id === "studio" ? "Best value" : "Top up when needed",
    credits: `${pack.credits.toLocaleString()} credits 路 ${pack.idealFor}`,
    href: "/billing"
  }))
];
const faqs = [
  {
    q: "What is DreamFace?",
    a: "DreamFace is an AI creative studio for generating images and videos in one workspace. Creators can move from prompt ideas to AI image generation, AI image editing, and AI video tasks while keeping models, credits, history, and outputs organized."
  },
  {
    q: "What are AI video generators?",
    a: "AI video generators are tools that turn prompts, images, scripts, or reference assets into video clips with AI. They can help creators produce social videos, product demos, B-roll, and marketing visuals without traditional filming or advanced editing skills."
  },
  {
    q: "What is the best AI video generator for marketers and creators?",
    a: "The best AI video generator depends on your workflow, model preferences, budget, and output style. DreamFace is built for creators and marketers who want image generation, image editing, text-to-video, image-to-video, credit estimates, and project history in one workspace."
  },
  {
    q: "Which AI generation tools are available in DreamFace?",
    a: "DreamFace includes tools for text-to-image, image-to-image, text-to-video, image-to-video, photo enhancement workflows, and reusable project history. The studio is designed around choosing what you want to create first, then routing to a suitable AI model."
  },
  {
    q: "Does DreamFace support text-to-image and image-to-image?",
    a: "Yes. You can create an image from a text prompt or add reference images for image-to-image editing. The studio keeps prompt controls and model selection in the same composer so you can choose the right image workflow without changing tools."
  },
  {
    q: "Does DreamFace support text-to-video and image-to-video?",
    a: "Yes. DreamFace separates text-to-video and image-to-video workflows so you can either describe a scene from scratch or animate a reference image. Available settings and quality depend on the selected video model."
  },
  {
    q: "What types of input can I use to create AI videos in DreamFace?",
    a: "You can start from a text prompt, a reference image, or a short creative brief. For image-to-video, upload or paste an image reference and describe motion, camera style, subject behavior, and the final mood."
  },
  {
    q: "Can I create AI videos using a reference image?",
    a: "Yes. Image-to-video workflows let you use a product shot, portrait, character image, or visual concept as the starting frame. DreamFace then sends the reference and prompt to the selected model to generate motion."
  },
  {
    q: "How do I create an AI video of myself?",
    a: "Use a clear reference image or source clip that you have rights to use, then describe the motion, scene, and style you want. DreamFace can help route image-to-video jobs, but you should only upload likenesses you own or have permission to use."
  },
  {
    q: "Can I make AI videos for TikTok, ads, or social media?",
    a: "Yes. DreamFace is designed for short-form creative work such as social clips, product teasers, ad concepts, thumbnails, and campaign assets. You can generate visuals, save outputs to Projects, and reuse prompts or references for new variations."
  },
  {
    q: "Which AI models can I use?",
    a: "Model options depend on the workflow. Image creation includes providers such as GPT Image 2, Nano Banana 2, and FLUX Schnell, and video creation includes routed providers such as Seedance, Kling, Veo, and Grok Imagine Video."
  },
  {
    q: "How long does it take to generate an AI video?",
    a: "Generation time depends on the provider queue, duration, resolution, and model. Short clips can often complete in a few minutes, while heavier video jobs may take longer. DreamFace keeps the task visible in Projects while it runs."
  },
  {
    q: "Can I create AI videos without editing experience?",
    a: "Yes. DreamFace is built around simple creative inputs: choose a workflow, write a prompt, add a reference if needed, select model options, and generate. You do not need timeline editing experience to start producing AI video clips."
  },
  {
    q: "Can I see generation cost before I create?",
    a: "Yes. DreamFace uses credits and shows the estimated credit cost on the generation action before a task is submitted. Billing and creation history keep purchases, balances, and generation tasks easier to trace."
  },
  {
    q: "Is DreamFace free to try?",
    a: "New accounts receive signup credits so they can test supported generation workflows. Paid credit packs are available when you need more image or video generations."
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
    a: "DreamFace is focused on visual generation first, with image and video workflows available in the studio. Audio and voice-related tools may appear as product coverage expands, but current availability depends on the live workspace."
  },
  {
    q: "Can AI videos replace traditional video production?",
    a: "AI videos can replace traditional production for many early creative, marketing, testing, training, and social workflows. For high-stakes shoots, talent usage, brand approvals, and regulated industries, teams should still review outputs carefully before publishing."
  },
  {
    q: "Is DreamFace secure and ethical for AI video generation?",
    a: "DreamFace is designed to keep projects, prompts, credits, and outputs organized in your account. You are responsible for using inputs lawfully, respecting likeness rights, avoiding misleading impersonation, and following the terms of the selected model provider."
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

export default async function HomePage() {
  const galleryItems = await fetchPublishedGalleryItems({ limit: 8, featuredFirst: true })
    .then((rows) => rows.map(mapGalleryRow))
    .catch(() => []);

  return (
    <main className="bg-grid pb-16">
      <PageAnalytics eventName="home_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
      />
      <div className="mx-auto max-w-[1540px] px-3 pt-3 sm:px-4 sm:pt-4 md:px-8 md:pt-5">
        <TopNav />

        <Reveal>
          <HomeHeroCarousel />
        </Reveal>

        {galleryItems.length ? (
          <Reveal>
            <section className="section-shell mt-14 border-t border-black/10 pt-14 md:mt-24 md:pt-24">
              <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">Prompt Gallery</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#171719] sm:text-4xl md:text-5xl">
                    Explore creator-ready AI visuals
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374] sm:text-base">
                    Browse reusable prompts, model examples, and curated references before opening the studio.
                  </p>
                </div>
                <Link
                  href="/gallery"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-black tracking-[-0.02em] text-white shadow-[0_14px_30px_rgba(13,18,35,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#343438]"
                >
                  View More <span className="ml-2">-&gt;</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {galleryItems.map((item) => (
                  <Link
                    key={item.id}
                    href={galleryItemPath(item)}
                    className="card group overflow-hidden rounded-2xl bg-white"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-[#eef2f7]">
                      <img
                        src={item.thumbnailUrl || item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate rounded-full border border-black/10 bg-[#f8fbff] px-2.5 py-1 text-[10px] font-semibold text-[#4c5a70] sm:text-[11px]">
                          {item.category}
                        </span>
                        <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#8792a5] sm:inline">
                          {item.model}
                        </span>
                      </div>
                      <h3 className="mt-3 line-clamp-1 text-sm font-semibold tracking-tight text-[#1d1d1f] sm:text-base">
                        {item.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#687386]">{item.prompt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>
        ) : null}

        <Reveal>
          <section id="products" className="section-shell mt-14 border-t border-black/10 pt-14 md:mt-24 md:pt-24">
            <div className="mx-auto max-w-5xl text-center">
              <h2 className="text-[clamp(2.55rem,12vw,4.8rem)] font-black leading-[0.96] tracking-[-0.055em] text-[#171719] md:text-[clamp(3rem,5.7vw,6.8rem)]">
                AI Video creation just became
                <span className="block">your <span className="text-[#989898]">superpower</span></span>
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-7 text-[#5c5f66] sm:text-lg md:mt-8 md:text-xl md:leading-8">
                Create training, marketing, sales, and internal content from a single workspace with enterprise-grade control and creator-friendly tools.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-[1260px] grid-cols-2 gap-3 sm:mt-16 sm:gap-5 lg:mt-24 lg:grid-cols-5">
              {[
                { title: "Text to Video", href: "/studio?mode=video&workflow=text-to-video" },
                { title: "Photo to Video", href: "/studio?mode=video&workflow=image-to-video" },
                { title: "Product Ads", href: "/studio?mode=image&workflow=text-to-image" },
                { title: "UGC ads", href: "/studio?mode=video&workflow=text-to-video" },
                { title: "AI Models", href: "/studio?view=home" }
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex min-h-[112px] flex-col items-center justify-center rounded-[1.25rem] bg-[#f1f1f1] px-4 py-5 text-center transition duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-[0_22px_55px_rgba(18,22,33,0.1)] sm:min-h-[138px] sm:rounded-[1.7rem] sm:px-5 sm:py-7"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="mb-4 h-6 w-6 text-[#121214]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
                    <path d="m7 3 1.4 2.5M12 3l1.4 2.5M17 3l1.4 2.5" />
                  </svg>
                  <span className="text-base font-black tracking-[-0.04em] text-[#171719] sm:text-xl">{item.title}</span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-shell mt-16 border-t border-black/10 pt-16 md:mt-28 md:pt-28">
            <div className="grid items-center gap-9 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 text-xl font-black tracking-[-0.04em] text-[#11bff3] sm:text-2xl">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
                    <path d="m7 3 1.4 2.5M12 3l1.4 2.5M17 3l1.4 2.5" />
                  </svg>
                  Text to Video
                </p>
                <h3 className="mt-4 text-[clamp(2.35rem,10vw,3.8rem)] font-black leading-[1.02] tracking-[-0.055em] text-[#141416] md:text-[clamp(2.3rem,3.7vw,4.6rem)]">
                  Turn text into video with AI
                </h3>
                <p className="mt-5 text-base font-medium leading-7 text-[#292d35] sm:text-lg sm:leading-8 md:text-xl md:leading-9">
                  Create complete AI videos from a script using text to video AI. Describe the scene, pacing, voice, camera motion, and output style, then generate polished video clips for explainers, ads, sales, onboarding, or social content.
                </p>
                <Link
                  href="/studio?mode=video&workflow=text-to-video"
                  className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#10bff3] px-6 py-4 text-base font-black tracking-[-0.04em] text-[#071116] shadow-[0_18px_36px_rgba(16,191,243,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#00afe6] sm:w-auto sm:text-xl md:mt-10"
                >
                  Get Started For Free <span className="ml-3">-&gt;</span>
                </Link>
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-[1.4rem] bg-white shadow-[0_22px_55px_rgba(16,27,48,0.14)] sm:rounded-[2rem] sm:shadow-[0_28px_80px_rgba(16,27,48,0.16)]">
                  <video
                    src="https://media.dreamface.io/videos/Text_to_Video.webm"
                    className="aspect-[16/9] w-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-shell mt-16 border-t border-black/10 pt-16 md:mt-28 md:pt-28">
            <div className="grid items-center gap-9 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 text-xl font-black tracking-[-0.04em] text-[#11bff3] sm:text-2xl">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
                    <path d="m7 3 1.4 2.5M12 3l1.4 2.5M17 3l1.4 2.5" />
                  </svg>
                  Photo to Video
                </p>
                <h3 className="mt-4 text-[clamp(2.35rem,10vw,3.8rem)] font-black leading-[1.02] tracking-[-0.055em] text-[#141416] md:text-[clamp(2.3rem,3.7vw,4.6rem)]">
                  Transform Photos into Videos
                </h3>
                <p className="mt-5 text-base font-medium leading-7 text-[#292d35] sm:text-lg sm:leading-8 md:text-xl md:leading-9">
                  Turn any image into a video in seconds. Upload an image, add a script or motion prompt, and transform it into a dynamic AI-generated video with natural movement, smooth pacing, and export-ready framing.
                </p>
                <Link
                  href="/studio?mode=video&workflow=image-to-video"
                  className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#10bff3] px-6 py-4 text-base font-black tracking-[-0.04em] text-[#071116] shadow-[0_18px_36px_rgba(16,191,243,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#00afe6] sm:w-auto sm:text-xl md:mt-10"
                >
                  Get Started For Free <span className="ml-3">-&gt;</span>
                </Link>
              </div>

              <div className="relative min-h-[360px] sm:min-h-[510px]">
                <div className="absolute left-0 top-4 z-20 w-[40%] rotate-[-6deg] overflow-hidden rounded-xl border-[7px] border-white bg-white shadow-[0_18px_45px_rgba(16,27,48,0.16)] sm:left-[18%] sm:top-8 sm:w-[34%] sm:border-[10px]">
                  <video
                    src="https://media.dreamface.io/videos/Image_to_Video.mp4"
                    className="aspect-[4/3] w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
                <div className="absolute right-0 top-10 z-20 hidden max-w-[78%] items-center gap-3 rounded-2xl border-2 border-[#004350] bg-[#bdefff] px-3 py-3 text-[#073c45] shadow-[0_18px_42px_rgba(7,50,60,0.12)] sm:inline-flex sm:top-24 sm:gap-4 sm:px-5 sm:py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#063f49] text-white sm:h-12 sm:w-12">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 5h14v14H5z" />
                      <path d="M9 9h2v2H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-black sm:text-lg">Photo to Video</p>
                    <p className="text-xs font-semibold text-[#47707a] sm:text-sm">Turn photo and script into talking video</p>
                  </div>
                </div>
                <div className="ml-auto mt-16 w-[84%] overflow-hidden rounded-[1.5rem] bg-[#e8edf3] shadow-[0_24px_60px_rgba(16,27,48,0.16)] sm:mt-20 sm:w-[70%] sm:rounded-[2rem] sm:shadow-[0_28px_80px_rgba(16,27,48,0.18)]">
                  <video
                    src="https://media.dreamface.io/videos/Image_to_Video.mp4"
                    className="aspect-[16/10] w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
                <div className="absolute bottom-14 right-[13%] z-30 hidden h-12 w-12 place-items-center rounded-full bg-[#10bff3] text-lg font-black text-[#071116] shadow-[0_18px_36px_rgba(16,191,243,0.32)] sm:grid sm:bottom-20 sm:h-16 sm:w-16 sm:text-2xl">
                  ||
                </div>
              </div>
            </div>
          </section>
        </Reveal>
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

