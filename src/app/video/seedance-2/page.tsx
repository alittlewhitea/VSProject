import type { Metadata } from "next";
import Link from "next/link";
import { ShowcaseVideo } from "../../../components/showcase-video";
import { SiteFooter } from "../../../components/site-footer";
import { TopNav } from "../../../components/top-nav";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { seedanceExamples, seedanceFaq, type SeedanceExample } from "./seedance-2-data";

const pagePath = "/video/seedance-2";
const pageTitle = "Seedance 2.0 AI Video Generator | Dreamface";
const pageDescription = "Explore cinematic AI videos created with Seedance 2.0. Watch storytelling, meme videos, character animation and creative AI filmmaking examples.";
const generatorHref = "/studio?mode=video&workflow=text-to-video&provider=seedance-video";

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description: pageDescription,
  keywords: [
    "Seedance 2.0",
    "Seedance AI",
    "Seedance AI Video",
    "Seedance Examples",
    "Seedance Storytelling",
    "Seedance Meme",
    "Seedance Video Generator",
    "Cinematic AI Video",
    "AI Storytelling",
    "Movie Scene AI"
  ],
  alternates: { canonical: absoluteUrl(siteUrl(), pagePath) },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: absoluteUrl(siteUrl(), pagePath),
    title: pageTitle,
    description: pageDescription,
    siteName: "Dreamface",
    locale: "en_US",
    images: [{
      url: absoluteUrl(siteUrl(), "/images/seedance-2/seedance-2-storyboard-to-film-poster.webp"),
      width: 1280,
      height: 720,
      alt: "Seedance 2.0 storyboard to cinematic film example"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [absoluteUrl(siteUrl(), "/images/seedance-2/seedance-2-storyboard-to-film-poster.webp")]
  }
};

const capabilities = ["Movie-quality motion", "Storytelling", "Character Animation", "Creative Videos"];
const popularDirections = ["Meme videos", "AI short films", "Story-driven scenes", "Character animation", "Creative social media content"];
const creatorSteps = ["Imagine", "Storyboard", "Generate", "Share"];
const categories = ["Meme Videos", "Comedy Shorts", "Movie Scenes", "Storytelling", "Anime Clips", "Character Animation", "Product Storytelling", "Social Media Videos"];
const creatorReasons = [
  ["Story-first creation", "Begin with an idea, mood or narrative beat instead of treating every shot as an isolated output."],
  ["Fast iteration", "Try a direction, review the scene and continue developing the concept through another generation."],
  ["Expressive motion", "Use performance, movement and visual timing to make characters and scenes feel more alive."],
  ["Cinematic quality", "Explore framing, atmosphere and camera language that give short videos a film-inspired finish."]
] as const;

function Heading({ eyebrow, title, description, light = false }: { eyebrow: string; title: string; description?: string; light?: boolean }) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-black uppercase tracking-[0.22em] ${light ? "text-[#d8ff48]" : "text-[#5664d8]"}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl ${light ? "text-white" : "text-[#141414]"}`}>{title}</h2>
      {description ? <p className={`mt-5 text-base leading-7 sm:text-lg ${light ? "text-white/65" : "text-[#676b76]"}`}>{description}</p> : null}
    </div>
  );
}

function ExampleDetails({ example, dark }: { example: SeedanceExample; dark: boolean }) {
  return (
    <details className={`mt-6 rounded-2xl border p-1 ${dark ? "border-white/15 bg-white/5 open:bg-white/8" : "border-black/10 bg-white open:bg-[#fafafa]"}`}>
      <summary className={`cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-black marker:hidden ${dark ? "text-white" : "text-[#181818]"}`}>
        <span className="flex items-center justify-between gap-4">{example.detailsTitle}<span aria-hidden="true" className="text-xl text-[#b8ef27]">+</span></span>
      </summary>
      <div className={`border-t px-4 py-4 text-sm leading-6 ${dark ? "border-white/10 text-white/65" : "border-black/10 text-[#626773]"}`}>
        {example.detailsKind === "prompt" && typeof example.details === "string" ? <p>“{example.details}”</p> : null}
        {example.detailsKind === "workflow" && Array.isArray(example.details) ? (
          <div className="grid gap-2 sm:grid-cols-4">
            {example.details.map((item, index) => (
              <div key={item} className={`relative rounded-xl px-3 py-4 text-center font-black ${dark ? "bg-white/8 text-white" : "bg-[#f0f2f5] text-[#202020]"}`}>
                {item}{index < example.details.length - 1 ? <span className="absolute -bottom-4 left-1/2 z-10 -translate-x-1/2 sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 sm:translate-x-0 sm:-translate-y-1/2">↓</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function StructuredData() {
  const baseUrl = siteUrl();
  const graph = [
    { "@type": "WebPage", "@id": `${absoluteUrl(baseUrl, pagePath)}#webpage`, url: absoluteUrl(baseUrl, pagePath), name: pageTitle, description: pageDescription, inLanguage: "en" },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl(baseUrl, "/") },
        { "@type": "ListItem", position: 2, name: "Seedance 2.0", item: absoluteUrl(baseUrl, pagePath) }
      ]
    },
    {
      "@type": "FAQPage",
      mainEntity: seedanceFaq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } }))
    },
    ...seedanceExamples.map((example) => ({
      "@type": "VideoObject",
      name: example.title,
      description: example.description,
      thumbnailUrl: absoluteUrl(baseUrl, example.poster),
      contentUrl: example.videoUrl,
      uploadDate: example.uploadDate,
      duration: example.duration
    }))
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }} />;
}

export default function SeedancePage() {
  const hero = seedanceExamples[2];
  return (
    <main className="min-h-screen bg-[#f2f2f0] text-[#151515]">
      <StructuredData />
      <div className="mx-auto max-w-[1540px] px-3 pb-2 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="relative overflow-hidden rounded-[2rem] bg-[#080808] px-5 pb-7 pt-10 text-white sm:px-10 sm:pb-10 sm:pt-14 lg:px-14 lg:pt-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,rgba(110,92,255,0.2),transparent_55%)]" />
          <div className="relative mx-auto max-w-5xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d8ff48]">SEEDANCE 2.0 VIDEO MODEL</p>
            <h1 className="mt-5 text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">Create Cinematic AI Videos with Seedance 2.0</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">Explore viral AI storytelling, cinematic scenes, character-driven videos and meme-style creations built with Seedance 2.0.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={generatorHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#d8ff48] px-6 py-3 text-sm font-black text-black transition hover:bg-white">Try AI Video Generator</Link>
              <a href="#examples" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/25 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">Watch Examples</a>
            </div>
          </div>
          <div className="relative mx-auto mt-11 max-w-6xl">
            <ShowcaseVideo src={hero.videoUrl} poster={hero.poster} label="Seedance 2.0 storyboard to film example" priority className="rounded-[1.25rem] border-white/20 shadow-[0_32px_100px_rgba(0,0,0,0.65)]" />
          </div>
          <div className="relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/12 sm:grid-cols-4">
            {capabilities.map((item) => <div key={item} className="bg-[#111] px-4 py-4 text-center text-xs font-black text-white/75 sm:py-5">{item}</div>)}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Heading eyebrow="CREATOR-LED VIDEO" title="What Is Seedance 2.0?" />
            <div>
              <p className="text-xl font-bold leading-9 text-[#272727] sm:text-2xl">Seedance 2.0 focuses on cinematic motion, expressive storytelling and creator-friendly video generation.</p>
              <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-[#777b85]">It is widely used for</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {popularDirections.map((item) => <span key={item} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#363636]">{item}</span>)}
              </div>
              <p className="mt-8 border-l-2 border-[#5664d8] pl-5 text-sm leading-7 text-[#696d77]">The examples below demonstrate different creative directions rather than technical benchmarks.</p>
            </div>
          </div>
        </section>

        <section id="examples" className="scroll-mt-28 space-y-4">
          {seedanceExamples.map((example, index) => {
            const dark = index % 2 === 0;
            return (
              <article key={example.id} className={`overflow-hidden rounded-[2rem] px-5 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-16 ${dark ? "bg-[#090909] text-white" : "border border-black/8 bg-white"}`}>
                <div className="grid items-center gap-9 lg:grid-cols-[1.18fr_0.82fr] lg:gap-14">
                  <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                    <ShowcaseVideo src={example.videoUrl} poster={example.poster} label={`${example.title} Seedance 2.0 example`} className={dark ? "border-white/15" : "border-black/10"} />
                  </div>
                  <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                    <p className={`text-xs font-black uppercase tracking-[0.22em] ${dark ? "text-[#d8ff48]" : "text-[#5664d8]"}`}>{example.eyebrow}</p>
                    <h2 className={`mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#151515]"}`}>{example.title}</h2>
                    <p className={`mt-5 text-base leading-7 ${dark ? "text-white/68" : "text-[#60646e]"}`}>{example.description}</p>
                    <p className={`mt-5 border-l-2 pl-4 text-sm font-bold leading-6 ${dark ? "border-[#d8ff48] text-white/85" : "border-[#5664d8] text-[#3e424b]"}`}>{example.highlight}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {example.tags.map((tag) => <span key={tag} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${dark ? "border-white/15 bg-white/5 text-white/70" : "border-black/10 bg-[#f7f7f5] text-[#555a64]"}`}>{tag}</span>)}
                    </div>
                    <ExampleDetails example={example} dark={dark} />
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mx-auto max-w-[1280px] py-20 sm:py-28">
          <Heading eyebrow="FROM IDEA TO AUDIENCE" title="How Creators Use Seedance" description="A simple creative rhythm keeps attention on the story instead of the mechanics behind it." />
          <div className="mt-12 grid gap-3 sm:grid-cols-4">
            {creatorSteps.map((step, index) => (
              <div key={step} className="relative rounded-2xl border border-black/10 bg-white px-5 py-8 text-center">
                <span className="text-xs font-black text-[#5664d8]">0{index + 1}</span>
                <h3 className="mt-4 text-2xl font-black">{step}</h3>
                {index < creatorSteps.length - 1 ? <span aria-hidden="true" className="absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 text-xl font-black sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 sm:translate-x-0 sm:-translate-y-1/2">→</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#101010] px-5 py-14 text-white sm:px-10 sm:py-20 lg:px-14">
          <Heading eyebrow="CREATIVE CATEGORIES" title="Find a Direction Worth Making" description="Seedance can support very different kinds of creator-led entertainment, from quick jokes to planned film scenes." light />
          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.map((item, index) => (
              <article key={item} className="min-h-36 rounded-2xl border border-white/12 bg-white/[0.04] p-5 transition hover:border-[#d8ff48]/60 hover:bg-white/[0.07]">
                <span className="text-xs font-black text-[#d8ff48]">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-8 text-base font-black leading-6 sm:text-lg">{item}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-10 py-20 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <Heading eyebrow="CREATOR WORKFLOW" title="Direct the Scene Through Conversation" />
            <div className="mt-8 grid grid-cols-2 gap-3">
              {["Explain your idea.", "Generate.", "Refine.", "Share."].map((item, index) => <div key={item} className="rounded-2xl border border-black/10 bg-white p-5"><span className="text-xs font-black text-[#5664d8]">0{index + 1}</span><p className="mt-4 font-black">{item}</p></div>)}
            </div>
          </div>
          <div className="rounded-[2rem] bg-[#161616] p-5 text-white shadow-[0_28px_70px_rgba(0,0,0,0.2)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8ff48]">Example creative exchange</p>
            {[
              ["User", "Make this feel like a movie trailer."],
              ["AI", "Done."],
              ["User", "Add dramatic camera movement."],
              ["AI", "Updated Scene"]
            ].map(([speaker, text], index) => <div key={`${speaker}-${text}`} className={`mt-4 max-w-[88%] rounded-2xl px-5 py-4 ${speaker === "AI" ? "ml-auto bg-[#d8ff48] text-black" : "bg-white/8"}`}><p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-65">{speaker}</p><p className="mt-2 text-sm font-bold leading-6">{text}</p>{index < 3 ? null : null}</div>)}
          </div>
        </section>

        <section className="rounded-[2rem] border border-black/8 bg-white px-5 py-14 sm:px-10 sm:py-20 lg:px-14">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <Heading eyebrow="WHY CREATORS USE IT" title="Create for the Story, Not the Spec Sheet" description="The strongest Seedance concepts begin with a clear entertainment idea and use motion, pacing and atmosphere to carry it." />
            <div className="grid gap-3 sm:grid-cols-2">
              {creatorReasons.map(([title, description], index) => <article key={title} className="rounded-2xl bg-[#f3f3f0] p-6"><span className="text-xs font-black text-[#5664d8]">0{index + 1}</span><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#676b75]">{description}</p></article>)}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="rounded-[2rem] bg-[#5664d8] px-6 py-14 text-center text-white sm:px-12 sm:py-20">
            <h2 className="text-3xl font-black tracking-tight sm:text-6xl">Turn Ideas Into Cinematic Videos</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">Bring a story, scene or shareable concept into Dreamface and start exploring it with AI video.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={generatorHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#d8ff48] px-6 py-3 text-sm font-black text-black hover:bg-white">Create AI Video</Link>
              <Link href="/studio?view=home" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/30 px-6 py-3 text-sm font-black text-white hover:bg-white/10">Explore Dreamface</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[960px] border-t border-black/10 py-20 sm:py-24">
          <Heading eyebrow="QUESTIONS" title="Seedance 2.0 FAQ" />
          <div className="mt-9 divide-y divide-black/10 border-y border-black/10">
            {seedanceFaq.map((item) => (
              <details key={item.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-black marker:hidden sm:text-lg">{item.question}<span aria-hidden="true" className="shrink-0 text-xl text-[#5664d8] group-open:rotate-45">+</span></summary>
                <div className="max-w-3xl pb-6 pr-10 text-sm leading-7 text-[#666b75] sm:text-base">
                  <p>{item.answer}</p>
                  {item.question === "How does Dreamface support AI video creation?" ? <Link href={generatorHref} className="mt-3 inline-flex font-black text-[#5664d8] hover:text-[#353f9e]">Open Seedance 2.0 in AI Video -&gt;</Link> : null}
                </div>
              </details>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
