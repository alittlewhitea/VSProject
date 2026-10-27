import { DreamfaceCreditPacks, DreamfacePricingCtaCopy, DREAMFACE_CREDIT_SUMMARY } from "../dreamface-credit-packs";
import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { ComparisonPageShell } from "../comparison-page-shell";

const verifiedDate = "2026-10-27";

const faqs = [
  {
    question: "How much does HeyGen cost on an annual plan?",
    answer:
      "HeyGen lists Creator at $29 per month, or $24 per month equivalent when billed annually ($288 per year). Pro starts at $49 per month and Business at $149 per month with monthly billing; check HeyGen's pricing page for current annual rates, taxes, and regional availability."
  },
  {
    question: "Is DreamFace a good HeyGen alternative?",
    answer:
      "DreamFace is a strong HeyGen alternative for creators who want talking avatars alongside image generation, video models, AI voice, and marketing templates at a lower starting commitment. HeyGen is the stronger specialist choice for digital twins, stock avatars, video translation, lip-sync localization, and business training workflows."
  },
  {
    question: "How does DreamFace billing work?",
    answer:
      DREAMFACE_CREDIT_SUMMARY
  },
  {
    question: "Does HeyGen offer a free plan?",
    answer:
      "Yes. HeyGen's current Free plan allows up to three videos per month, videos up to one minute, access to more than 500 stock digital twins, one custom digital twin, and limited access to Avatar IV and Video Agent. Regional quotas can vary."
  },
  {
    question: "Do unused HeyGen credits roll over?",
    answer:
      "Yes. Monthly subscribers can carry eligible unused credits for one additional billing cycle. Annual subscribers receive credits monthly and can accumulate unused credits until the annual renewal date. Credits expire when a paid subscription ends."
  },
  {
    question: "Are HeyGen's current plans unlimited?",
    answer:
      "No. HeyGen's current paid plans use credits across avatar generation, translation, Video Agent, and asset creation. Existing legacy unlimited subscribers may retain their old plan while it remains active, but users who switch or cancel cannot return to it."
  }
];

export const metadata: Metadata = {
  title: "DreamFace vs HeyGen: Pricing, Annual Plans & AI Avatars (2026)",
  description:
    "Compare HeyGen monthly and annual pricing with DreamFace credit packs, plus AI avatars, video generation, voice and translation workflows.",
  keywords: [
    "DreamFace vs HeyGen",
    "HeyGen alternative",
    "HeyGen pricing",
    "AI avatar generator comparison",
    "AI video translation comparison"
  ],
  alternates: { canonical: absoluteUrl(siteUrl(), "/compare/dreamface-vs-heygen") },
  openGraph: {
    title: "DreamFace vs HeyGen: Which AI Avatar Platform Fits You?",
    description: "A source-linked comparison of pricing, credits, avatars, digital twins, voice, localization, and multimodal creation.",
    type: "article",
    url: absoluteUrl(siteUrl(), "/compare/dreamface-vs-heygen"),
    modifiedTime: verifiedDate
  }
};

const tableClass = "w-full min-w-[760px] border-collapse text-left text-sm";
const thClass = "border-b border-black/15 bg-[#f3f8fb] px-4 py-4 font-black text-[#20242b]";
const tdClass = "border-b border-black/10 px-4 py-4 align-top font-medium leading-6 text-[#505c6d]";

export default function DreamFaceVsHeyGenPage() {
  const baseUrl = siteUrl();
  const pageUrl = absoluteUrl(baseUrl, "/compare/dreamface-vs-heygen");
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "DreamFace vs HeyGen: Which AI Avatar Video Platform Is Better in 2026?",
      url: pageUrl,
      dateModified: verifiedDate,
      description: "An objective comparison of DreamFace and HeyGen pricing, avatar capabilities, localization, and best-fit workflows.",
      about: [
        { "@type": "SoftwareApplication", name: "DreamFace", applicationCategory: "MultimediaApplication" },
        { "@type": "SoftwareApplication", name: "HeyGen", applicationCategory: "MultimediaApplication" }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer }
      }))
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl(baseUrl, "/en") },
        { "@type": "ListItem", position: 2, name: "Comparisons", item: absoluteUrl(baseUrl, "/compare") },
        { "@type": "ListItem", position: 3, name: "DreamFace vs HeyGen", item: pageUrl }
      ]
    }
  ];

  const featureRows = [
    ["Primary focus", "Multimodal creation, talking avatars, and marketing assets", "Avatar-led business video, digital twins, and localization"],
    ["Talking avatars", "Dedicated talking-avatar workflow", "500+ stock digital twins on Free and 700+ stock avatars on Creator"],
    ["Custom avatars", "Avatar creation through the current DreamFace workflow", "Custom video avatars; availability and limits depend on plan"],
    ["Voice and languages", "Dedicated multilingual voice and TTS generation", "Voice cloning and 175+ languages and dialects on Creator"],
    ["Video translation", "Model- and workflow-dependent localization", "Audio dubbing, lip-sync translation, precision modes, and script editing on Pro"],
    ["General AI video", "Text-to-video and image-to-video through supported Studio models, including HeyGen Video via fal.ai", "Video Agent plus generated image, video, B-roll, and motion assets"],
    ["Image and marketing tools", "Image generation, editing, cleanup, and curated prompts and creative examples", "Photo Looks, Brand Kit, templates, and assets for avatar-led video"],
    ["Output and teams", "Individual creation and project workflows", "1080p Creator, 4K Pro, and Business collaboration, SSO, SCORM, LMS, and interactive video"]
  ];

  const useCaseRows = [
    ["Low-commitment paid testing", "DreamFace", "One-time credit packs let creators top up when needed without automatic renewal."],
    ["Digital-twin spokesperson videos", "HeyGen", "Its product is centered on stock avatars, custom digital twins, Avatar IV/V, scripts, and brand controls."],
    ["Multilingual video localization", "HeyGen", "Dedicated dubbing, lip sync, translation modes, and 175+ languages make localization a core workflow."],
    ["Mixed image, avatar, voice, and video campaigns", "DreamFace", "Several media modes and curated prompts and creative examples are accessible in one focused workspace."],
    ["Training and interactive learning", "HeyGen Business", "SCORM export, LMS integrations, screen recording, quizzes, links, and branching target learning teams."],
    ["Irregular or seasonal creation", "DreamFace", "One-time credit packs let you top up when needed without automatic renewal."]
  ];

  return (
    <ComparisonPageShell structuredData={structuredData}>
      <article className="comparison-article">
        <header className="comparison-hero px-1 pb-12 pt-9 md:px-4 md:pb-16 md:pt-16">
          <nav aria-label="Breadcrumb" className="text-xs font-bold text-[#6b7280]">
            <Link href="/compare" className="hover:text-[#111]">Comparisons</Link> / DreamFace vs HeyGen
          </nav>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-[#087ea4]">Independent purchase guide</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-[1.08] tracking-normal md:text-6xl">
            DreamFace vs HeyGen: Which AI Avatar Video Platform Is Better in 2026?
          </h1>
          <p className="mt-6 max-w-4xl text-base font-medium leading-8 text-[#536071] md:text-lg">
            DreamFace combines talking avatars with image, video, voice, and marketing creation. HeyGen specializes in digital twins, stock avatars, multilingual spokesperson videos, lip-sync translation, and business learning workflows.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-bold text-[#667084]">
            <span className="rounded-full border border-black/10 bg-white px-4 py-2">HeyGen pricing checked October 27, 2026</span>
            <span className="rounded-full border border-black/10 bg-white px-4 py-2">Prices in USD</span>
          </div>
        </header>

        <section className="comparison-verdict border-y border-black/10 bg-white/70 px-5 py-8 md:px-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087ea4]">AI verdict</p>
          <p className="mt-3 max-w-5xl text-xl font-black leading-8 md:text-2xl">
            DreamFace is the lower-commitment, broader creative option for avatars, voice, images, video models, and campaign templates. HeyGen is the more specialized platform for polished digital-twin presentations, multilingual localization, learning content, and team-controlled avatar production.
          </p>
        </section>

        <section className="comparison-section py-12 md:py-16" aria-labelledby="pricing-quick-answer">
          <h2 id="pricing-quick-answer" className="text-3xl font-black tracking-normal md:text-4xl">HeyGen pricing and annual plans at a glance</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div className="comparison-card rounded-lg border border-black/10 bg-white p-6">
              <h3 className="text-xl font-black">HeyGen: subscription plans</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">Creator costs $29 per month, or $24 per month equivalent billed annually ($288 per year), and includes 600 credits per month. Pro starts at $49 per month and Business at $149 per month with monthly billing. Annual rates for other plans and any taxes should be confirmed at checkout.</p>
              <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">Annual subscribers receive credits monthly; unused credits accumulate until renewal. Monthly subscribers can roll unused credits over for one additional billing cycle.</p>
            </div>
            <div className="comparison-card comparison-card-primary rounded-lg border border-[#9bdffc] bg-[#f1fbff] p-6">
              <h3 className="text-xl font-black">DreamFace: one-time credit packs</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">{DREAMFACE_CREDIT_SUMMARY}</p>
              <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">The two platforms use separate credit systems, so their credit balances and per-generation costs are not directly interchangeable.</p>
              <Link href="/price" className="mt-3 inline-block text-sm font-black text-[#087ea4] underline">See DreamFace pricing</Link>
            </div>
          </div>
        </section>

        <section className="comparison-section py-12 md:py-16">
          <h2 className="text-3xl font-black tracking-normal md:text-4xl">Product overview</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div className="comparison-card comparison-card-primary rounded-lg border border-[#9bdffc] bg-[#f1fbff] p-6">
              <h3 className="text-2xl font-black">DreamFace</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">An all-in-one multimodal creation platform with talking avatars, AI voice and TTS, image creation and editing, video generation, and curated prompts and creative examples.</p>
            </div>
            <div className="comparison-card rounded-lg border border-black/10 bg-white p-6">
              <h3 className="text-2xl font-black">HeyGen</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">An avatar-first video platform with stock digital twins, custom avatars, voice cloning, Video Agent, lip-sync translation, brand controls, and business tools for training, collaboration, and localization.</p>
            </div>
          </div>
        </section>

        <section className="comparison-section pb-12 md:pb-16">
          <h2 className="text-3xl font-black tracking-normal md:text-4xl">Feature comparison matrix</h2>
          <div className="comparison-table-frame mt-7 overflow-x-auto rounded-lg border border-black/10 bg-white">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Feature</th><th className={thClass}>DreamFace</th><th className={thClass}>HeyGen</th></tr></thead>
              <tbody>{featureRows.map(([feature, dreamface, heygen]) => (
                <tr key={feature}><td className={`${tdClass} font-black text-[#20242b]`}>{feature}</td><td className={tdClass}>{dreamface}</td><td className={tdClass}>{heygen}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="comparison-section comparison-panel border-y border-black/10 py-12 md:py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087ea4]">Purchase comparison</p>
              <h2 className="mt-3 text-3xl font-black tracking-normal md:text-4xl">Pricing and billing comparison</h2>
            </div>
            <p className="max-w-xl text-sm font-medium leading-6 text-[#5b6677]">HeyGen Pro supports configurable credit tiers up to 100,000 credits per month. The table compares the publicly documented starting tiers.</p>
          </div>

          <h3 className="mt-9 text-xl font-black">DreamFace one-time credit packs</h3>
<DreamfaceCreditPacks />

          <h3 className="mt-9 text-xl font-black">HeyGen credit-based plans</h3>
          <div className="comparison-table-frame mt-4 overflow-x-auto rounded-lg border border-black/10 bg-white">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Plan</th><th className={thClass}>Monthly billing</th><th className={thClass}>Annual billing</th><th className={thClass}>Included usage</th></tr></thead>
              <tbody>
                <tr><td className={`${tdClass} font-black text-[#20242b]`}>Free</td><td className={tdClass}>$0</td><td className={tdClass}>$0</td><td className={tdClass}>Up to 3 videos per month; no paid-plan credit pool</td></tr>
                <tr><td className={`${tdClass} font-black text-[#20242b]`}>Creator</td><td className={tdClass}>$29 / month</td><td className={tdClass}>$288 / year ($24/mo equivalent)</td><td className={tdClass}>600 credits / month; 1080p; videos up to 30 minutes</td></tr>
                <tr><td className={`${tdClass} font-black text-[#20242b]`}>Pro</td><td className={tdClass}>From $49 / month</td><td className={tdClass}>Annual billing available; confirm live checkout rate</td><td className={tdClass}>From 1,000 credits / month; 4K; configurable up to 100,000 credits</td></tr>
                <tr><td className={`${tdClass} font-black text-[#20242b]`}>Business</td><td className={tdClass}>$149 / month + $20 / additional seat</td><td className={tdClass}>Annual billing available; confirm live checkout rate</td><td className={tdClass}>1,500 shared credits / month; 4K; videos up to 60 minutes</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs font-medium leading-6 text-[#667084]">HeyGen credits cover avatar video, translation, Video Agent, model training, and generated assets at feature-specific rates. Creator and Pro do not support one-time credit packs. Business users can buy additional credits at $5 per 100 credits. Monthly rollover lasts one extra cycle; annual credits can accumulate until renewal.</p>
        </section>

        <section className="comparison-section py-12 md:py-16">
          <h2 className="text-3xl font-black tracking-normal md:text-4xl">Use-case matrix</h2>
          <div className="comparison-table-frame mt-7 overflow-x-auto rounded-lg border border-black/10 bg-white">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Scenario</th><th className={thClass}>Best fit</th><th className={thClass}>Reason</th></tr></thead>
              <tbody>{useCaseRows.map(([scenario, fit, reason]) => (
                <tr key={scenario}><td className={`${tdClass} font-black text-[#20242b]`}>{scenario}</td><td className={tdClass}>{fit}</td><td className={tdClass}>{reason}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="comparison-section comparison-panel border-y border-black/10 py-12 md:py-16">
          <h2 className="text-3xl font-black tracking-normal md:text-4xl">Feature-by-feature analysis</h2>
          <div className="comparison-analysis-grid mt-8 grid gap-9 md:grid-cols-3">
            <div><h3 className="text-xl font-black">Avatars and digital twins</h3><p className="mt-3 text-sm font-medium leading-7 text-[#586477]">Both products support presenter-led video. HeyGen goes deeper with a large stock-avatar catalog, custom digital twins, Photo Looks, Avatar IV/V, expressive motion, avatar slots, and team controls. DreamFace keeps talking avatars inside a broader creative toolkit and is easier to enter for a short project.</p></div>
            <div><h3 className="text-xl font-black">Voice and localization</h3><p className="mt-3 text-sm font-medium leading-7 text-[#586477]">DreamFace provides dedicated multilingual voice generation. HeyGen connects voice cloning to 175+ languages and dialects, then adds audio dubbing, lip-sync translation, precision modes, and translation-script editing. HeyGen is better suited to systematic localization; DreamFace is more direct for standalone voice and avatar assets.</p></div>
            <div><h3 className="text-xl font-black">Broader creative work</h3><p className="mt-3 text-sm font-medium leading-7 text-[#586477]">DreamFace exposes image, video, audio, avatar, and marketing-template modes as first-class tools. HeyGen increasingly supports generated images, video assets, B-roll, Video Agent, and motion design, but those tools primarily serve avatar-led video production. The best choice depends on whether the avatar is the center of the workflow or one format among many.</p></div>
          </div>
        </section>

        <section className="comparison-section py-12 md:py-16">
          <h2 className="text-3xl font-black tracking-normal md:text-4xl">Frequently asked questions</h2>
          <div className="comparison-faq-list mt-7 divide-y divide-black/10 border-y border-black/10">
            {faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="cursor-pointer list-none pr-6 text-lg font-black">{faq.question}</summary>
                <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-[#586477]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="comparison-cta rounded-lg bg-[#111318] px-6 py-9 text-white md:flex md:items-center md:justify-between md:px-9">
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#72d9ff]">Try the lower-commitment path</p><DreamfacePricingCtaCopy /></div>
          <Link href="/price" className="mt-6 inline-flex rounded-lg bg-[#10bff3] px-6 py-3 text-sm font-black text-[#06151b] md:mt-0">View current credit packs</Link>
        </section>

        <section className="comparison-sources py-10 text-xs font-medium leading-6 text-[#667084]">
          <h2 className="font-black uppercase tracking-[0.12em] text-[#3f4856]">Sources and methodology</h2>
          <p className="mt-3 max-w-5xl">DreamFace prices and credits are sourced from the product configuration. HeyGen pricing, included credits, and rollover rules were checked against its official pricing page and credit documentation on October 27, 2026. Other HeyGen feature comparisons were checked on July 10, 2026. Prices, features, regional availability, and taxes can change; confirm details with each provider.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/price" className="font-bold underline">DreamFace pricing</Link>
            <a href="https://www.heygen.com/pricing" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">HeyGen pricing</a>
            <a href="https://help.heygen.com/en/articles/15125761-heygen-credit-based-pricing-plans-explained" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">HeyGen credit plans</a>
            <a href="https://help.heygen.com/en/articles/15126059-how-to-use-credits-on-heygen" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">HeyGen credit usage and rollover</a>
            <a href="https://www.heygen.com/faq" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">HeyGen FAQ</a>
          </div>
        </section>
      </article>
    </ComparisonPageShell>
  );
}
