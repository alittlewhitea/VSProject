import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../../components/site-footer";
import { ShowcaseVideo } from "../../../components/showcase-video";
import { TopNav } from "../../../components/top-nav";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { geminiOmniExamples, geminiOmniFaq, type GeminiOmniExample } from "./gemini-omni-data";

const pagePath = "/video/gemini-omni";
const pageTitle = "Gemini Omni AI Video Generator & Editor | Dreamface";
const pageDescription =
  "Explore Gemini Omni video generation and multimodal editing. See examples of anime transformations, ASMR storyboards, natural-language editing and world-aware video creation.";
const generatorHref = "/studio?mode=video&workflow=text-to-video&provider=gemini-omni-flash-video";

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description: pageDescription,
  keywords: [
    "Gemini Omni",
    "Gemini Omni Flash",
    "Gemini Omni video",
    "Gemini Omni AI",
    "Gemini Omni video generator",
    "Gemini Omni video editor",
    "Gemini Omni examples",
    "multimodal video editing",
    "conversational video editing",
    "AI video generation",
    "AI video transformation"
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
    images: [
      {
        url: absoluteUrl(siteUrl(), "/images/gemini-omni/gemini-omni-flash-video-generation-poster.webp"),
        width: 1280,
        height: 720,
        alt: "Gemini Omni Flash video generation example"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [absoluteUrl(siteUrl(), "/images/gemini-omni/gemini-omni-flash-video-generation-poster.webp")]
  }
};

const capabilities = ["Multimodal Inputs", "Natural-Language Editing", "Scene Transformation", "World-Aware Motion"];

const overviewCards = [
  {
    title: "Multimodal Creation",
    description: "Combine prompts and visual references to guide the look, subject and direction of a video."
  },
  {
    title: "Conversational Editing",
    description: "Describe changes in ordinary language instead of rebuilding an edit from the beginning."
  },
  {
    title: "Scene-Aware Transformation",
    description: "Change characters, objects, environments and visual styles while preserving the overall structure of the scene."
  }
];

const creationSteps = [
  {
    number: "01",
    title: "Add Your Input",
    description: "Start with a text prompt, image, video clip or other supported reference material."
  },
  {
    number: "02",
    title: "Describe the Result",
    description: "Explain the scene, style, motion, subject or edit you want in natural language."
  },
  {
    number: "03",
    title: "Generate and Refine",
    description: "Review the video and continue adjusting the idea through follow-up instructions."
  }
];

const useCases = [
  ["Social Video Transformations", "Turn everyday footage into distinctive, shareable visual concepts."],
  ["Product and ASMR Videos", "Plan detailed product sequences with controlled pacing, actions and sound cues."],
  ["Storyboard Prototypes", "Move from a structured shot list to a clearer visual production concept."],
  ["Character and Object Changes", "Explore replacements and transformations inside existing scenes."],
  ["Stylized Video Editing", "Apply anime, illustration or cinematic aesthetics to source footage."],
  ["Iterative Creative Direction", "Develop an idea through multiple rounds of natural-language feedback."]
] as const;

const flexibleCapabilities = [
  "Start from existing footage",
  "Guide scenes with references",
  "Refine through conversation",
  "Explore multiple visual directions"
];

const relatedTools = [
  ["AI Video Generator", "/studio?mode=video&workflow=text-to-video"],
  ["Image to Video", "/studio?mode=video&workflow=image-to-video"],
  ["Text to Video", "/studio?mode=video&workflow=text-to-video"],
  ["AI Avatar", "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video"]
] as const;

function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-[#087bd8]">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl lg:text-5xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-7 text-[#667085] sm:text-lg">{description}</p> : null}
    </div>
  );
}

function ExampleDetails({ example }: { example: GeminiOmniExample }) {
  const details = example.details;
  return (
    <details className="mt-6 rounded-2xl border border-[#dbe4f0] bg-white/80 p-1 open:bg-white">
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-black text-[#17233c] marker:hidden">
        <span className="flex items-center justify-between gap-4">
          {example.detailsTitle}
          <span aria-hidden="true" className="text-lg text-[#168eea]">+</span>
        </span>
      </summary>
      <div className="border-t border-[#e6ebf2] px-4 py-4 text-sm leading-6 text-[#5e6c82]">
        {example.detailsKind === "text" && typeof details === "string" ? <p>{details}</p> : null}
        {example.detailsKind === "ordered" && Array.isArray(details) ? (
          <ol className="grid gap-2">
            {details.map((item, index) => <li key={item}><strong className="mr-2 text-[#1487df]">{index + 1}.</strong>{item}</li>)}
          </ol>
        ) : null}
        {example.detailsKind === "unordered" && Array.isArray(details) ? (
          <ul className="grid gap-2">
            {details.map((item) => <li key={item} className="flex gap-2"><span className="text-[#1487df]">+</span>{item}</li>)}
          </ul>
        ) : null}
        {example.detailsKind === "storyboard" && Array.isArray(details) ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {details.map((item, index) => (
              <div key={item} className="rounded-xl bg-[#f4f8fd] p-3">
                <span className="block text-[11px] font-black text-[#1487df]">{String(index + 1).padStart(2, "0")}</span>
                <span className="mt-1 block leading-5 text-[#445169]">{item}</span>
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
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl(baseUrl, pagePath)}#webpage`,
      url: absoluteUrl(baseUrl, pagePath),
      name: pageTitle,
      description: pageDescription,
      inLanguage: "en"
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl(baseUrl, "/") },
        { "@type": "ListItem", position: 2, name: "Gemini Omni", item: absoluteUrl(baseUrl, pagePath) }
      ]
    },
    {
      "@type": "FAQPage",
      mainEntity: geminiOmniFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    },
    ...geminiOmniExamples.map((example) => ({
      "@type": "VideoObject",
      name: example.title,
      description: example.description,
      thumbnailUrl: absoluteUrl(baseUrl, example.poster),
      contentUrl: example.videoUrl,
      uploadDate: example.uploadDate,
      duration: example.duration
    }))
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }}
    />
  );
}

export default function GeminiOmniPage() {
  const hero = geminiOmniExamples[1];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_18%,#f5f7fb_100%)] text-[#172033]">
      <StructuredData />
      <div className="mx-auto max-w-[1540px] px-3 pb-2 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="relative overflow-hidden rounded-[2rem] bg-[#0c1427] px-5 py-8 text-white sm:px-9 sm:py-12 lg:min-h-[620px] lg:px-14 lg:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(33,184,255,0.24),transparent_33%),radial-gradient(circle_at_55%_90%,rgba(148,101,255,0.18),transparent_36%)]" />
          <div className="relative grid items-center gap-9 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#76d7ff]">GEMINI OMNI VIDEO MODEL</p>
              <h1 className="mt-5 text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                Create and Edit Videos with Gemini Omni
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#c8d4e7] sm:text-lg">
                Explore multimodal video generation and conversational editing with Gemini Omni. Turn text, images, video and audio references into coherent new scenes, then refine the results with natural-language instructions.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={generatorHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#23b8f4] px-6 py-3 text-sm font-black text-[#07111f] transition hover:bg-[#61d0ff]">
                  Try AI Video Generator
                </Link>
                <a href="#examples" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-black text-white transition hover:bg-white/12">
                  Explore Examples
                </a>
              </div>
            </div>
            <ShowcaseVideo src={hero.videoUrl} poster={hero.poster} label="Gemini Omni Flash video generation example" priority />
          </div>
          <div className="relative mt-10 flex flex-wrap gap-2 border-t border-white/12 pt-6">
            {capabilities.map((item) => <span key={item} className="rounded-full border border-white/15 bg-white/7 px-4 py-2 text-xs font-bold text-[#d8e4f5]">{item}</span>)}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] py-20 sm:py-24">
          <SectionHeading eyebrow="MULTIMODAL CREATION" title="What Is Gemini Omni?" />
          <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="max-w-3xl space-y-5 text-base leading-8 text-[#5f6d82] sm:text-lg">
              <p>Gemini Omni is a multimodal video generation and editing model designed to understand text, images, video and audio together. Instead of treating every generation as an isolated clip, it is designed around iterative creation: provide source material, describe the change you want, review the result and continue refining the scene through natural language.</p>
              <p>This makes Gemini Omni especially useful for creators who want to transform existing footage, combine visual references, explore new styles or develop an idea across multiple editing steps.</p>
            </div>
            <div className="rounded-3xl border border-[#dbe5f0] bg-[#edf7ff] p-6 sm:p-8">
              <p className="text-sm font-black text-[#087bd8]">Built for iteration</p>
              <p className="mt-3 text-xl font-black leading-8 text-[#16223a]">Input, generate, review and refine without losing the creative direction of the scene.</p>
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {overviewCards.map((card, index) => (
              <article key={card.title} className="rounded-2xl border border-[#dfe6ef] bg-white p-6 shadow-[0_12px_35px_rgba(27,43,72,0.06)]">
                <span className="text-xs font-black text-[#168eea]">0{index + 1}</span>
                <h3 className="mt-4 text-xl font-black text-[#17233c]">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#667085]">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="examples" className="mx-auto max-w-[1280px] scroll-mt-28 border-t border-[#e0e7f0] py-20 sm:py-24">
          <SectionHeading
            eyebrow="REAL WORKFLOWS"
            title="Gemini Omni Video Examples"
            description="See how Gemini Omni can support stylized transformations, video generation, storyboard-driven production and world-aware multimodal editing."
          />
          <div className="mt-14 space-y-20 sm:space-y-28">
            {geminiOmniExamples.map((example, index) => (
              <article key={example.id} className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <ShowcaseVideo
                    src={example.videoUrl}
                    poster={example.poster}
                    label={`${example.title} video example`}
                  />
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#087bd8]">{example.eyebrow}</p>
                  <h3 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#17233c] sm:text-4xl">{example.title}</h3>
                  <p className="mt-5 text-base leading-7 text-[#58677d]">{example.description}</p>
                  <p className="mt-4 text-sm leading-6 text-[#7a8799]">{example.supplemental}</p>
                  {example.id === "asmr-storyboard" ? (
                    <p className="mt-4 rounded-xl bg-[#edf7ff] px-4 py-3 text-xs font-bold leading-5 text-[#36536f]">
                      Creative workflow: GPT Image 2 + Gemini Omni / Seedance 2.0. This example combines multiple creation tools in one workflow.
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {example.tags.map((tag) => <span key={tag} className="rounded-full border border-[#dce5ef] bg-[#f7f9fc] px-3 py-1.5 text-xs font-bold text-[#536177]">{tag}</span>)}
                  </div>
                  <ExampleDetails example={example} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-10 border-t border-[#e0e7f0] py-20 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <SectionHeading eyebrow="WORKFLOW" title="How to Create with Gemini Omni" />
            <div className="mt-8 grid gap-3">
              {creationSteps.map((step) => (
                <article key={step.number} className="grid grid-cols-[3rem_1fr] gap-4 rounded-2xl border border-[#dfe6ef] bg-white p-5">
                  <span className="text-sm font-black text-[#168eea]">{step.number}</span>
                  <div>
                    <h3 className="font-black text-[#17233c]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="self-end rounded-3xl border border-[#cadced] bg-[#0d172b] p-5 text-white shadow-[0_28px_70px_rgba(19,33,60,0.18)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#71d3ff]">Example workflow</p>
            {[
              ["Initial request", "Turn this street into a hand-drawn anime world."],
              ["Follow-up", "Add animated stickers that react to the camera movement."],
              ["Refinement", "Keep the stickers aligned with the ground and preserve the original perspective."]
            ].map(([label, text], index) => (
              <div key={label} className={`mt-5 max-w-[92%] rounded-2xl px-5 py-4 ${index === 1 ? "ml-auto bg-[#168eea]" : "bg-white/9"}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#b8d7ec]">{label}</p>
                <p className="mt-2 text-sm leading-6">“{text}”</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] border-t border-[#e0e7f0] py-20 sm:py-24">
          <SectionHeading eyebrow="USE CASES" title="What Can You Create with Gemini Omni?" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map(([title, description], index) => (
              <article key={title} className="rounded-2xl border border-[#dfe6ef] bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f6ff] text-sm font-black text-[#087bd8]">{String(index + 1).padStart(2, "0")}</div>
                <h3 className="mt-5 text-lg font-black text-[#17233c]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#667085]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-10 overflow-hidden rounded-3xl bg-[#eaf6ff] px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-14">
          <div>
            <SectionHeading eyebrow="CREATIVE CONTROL" title="A More Flexible Way to Create Video" />
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#56677f] sm:text-lg">
              Traditional video generation often ends after one prompt and one output. A multimodal, conversational workflow gives creators more control over the process. You can begin with existing material, communicate changes in natural language and gradually move the result closer to the intended idea.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {flexibleCapabilities.map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_24px_rgba(39,72,105,0.06)]">
                <span className="text-xs font-black text-[#168eea]">0{index + 1}</span>
                <p className="mt-3 font-black leading-6 text-[#17233c]">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] py-20 sm:py-24">
          <div className="overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#0796df,#5976e8_55%,#af6ee8)] px-6 py-12 text-white sm:px-12 sm:py-16">
            <h2 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Turn Your Next Idea into Video</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">Explore AI video creation in Dreamface and transform prompts, images and creative references into new visual stories.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={generatorHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-black text-[#17459e] hover:bg-[#f1f8ff]">Create an AI Video</Link>
              <Link href="/studio?view=home" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/35 bg-white/10 px-6 py-3 text-sm font-black text-white hover:bg-white/18">View More AI Tools</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[960px] border-t border-[#e0e7f0] py-20 sm:py-24">
          <SectionHeading eyebrow="QUESTIONS" title="Gemini Omni FAQ" />
          <div className="mt-9 divide-y divide-[#dfe6ef] border-y border-[#dfe6ef]">
            {geminiOmniFaq.map((item) => (
              <details key={item.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-black text-[#17233c] marker:hidden sm:text-lg">
                  {item.question}
                  <span aria-hidden="true" className="shrink-0 text-xl text-[#168eea] group-open:rotate-45">+</span>
                </summary>
                <div className="max-w-3xl pb-6 pr-10 text-sm leading-7 text-[#667085] sm:text-base">
                  <p>{item.answer}</p>
                  {item.question === "Is Gemini Omni available on Dreamface?" ? (
                    <Link href={generatorHref} className="mt-3 inline-flex font-black text-[#087bd8] hover:text-[#075da4]">
                      Open Gemini Omni in AI Video -&gt;
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section id="related-tools" className="mx-auto max-w-[1280px] border-t border-[#e0e7f0] py-16">
          <h2 className="text-2xl font-black tracking-tight text-[#17233c] sm:text-3xl">Explore More Dreamface Tools</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {relatedTools.map(([title, href]) => (
              <Link key={title} href={href} className="flex items-center justify-between rounded-2xl border border-[#dfe6ef] bg-white px-5 py-4 text-sm font-black text-[#17233c] transition hover:border-[#79c8f5] hover:bg-[#f2faff]">
                {title}<span aria-hidden="true" className="text-[#168eea]">-&gt;</span>
              </Link>
            ))}
          </div>
          <p className="mt-10 text-xs leading-5 text-[#7a8799]">Gemini and related names may be trademarks of their respective owners. Dreamface is an independent AI creation platform.</p>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
