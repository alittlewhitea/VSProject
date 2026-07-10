import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { ComparisonPageShell } from "../comparison-page-shell";

const verifiedDate = "2026-07-10";

const faqs = [
  {
    question: "Is DreamFace a suitable Runway alternative for marketing teams?",
    answer:
      "DreamFace is a suitable Runway alternative for teams that prioritize talking avatars, AI voice, image and video generation, and 300+ marketing templates in one workflow. Runway is a stronger fit when its video editing, visual-effects workflow, and Runway-native generation models are the primary requirements."
  },
  {
    question: "Which platform has the lower paid entry price?",
    answer:
      "DreamFace starts at $4.99 per week with 800 credits and access to the models listed in DreamFace Studio. Runway Standard costs $15 per month or $144 per year and includes 625 credits each month."
  },
  {
    question: "Does Runway still offer an Unlimited plan?",
    answer:
      "Runway stopped offering Unlimited to new subscribers in June 2026 and introduced Max as its high-volume plan. Existing Unlimited subscriptions are scheduled to move to Max on September 1, 2026, subject to Runway's published migration terms."
  },
  {
    question: "Do Runway monthly credits roll over?",
    answer:
      "Standard and Pro monthly credits expire on the billing date. Max allows up to one month of unused credits to roll over. Purchased Runway credits do not expire according to Runway's help documentation."
  },
  {
    question: "Does DreamFace's $4.99 weekly plan include unlimited generation?",
    answer:
      "No. DreamFace Premium Lite weekly provides 800 credits and model-catalog access. Generations consume credits according to the selected model and settings."
  }
];

export const metadata: Metadata = {
  title: "DreamFace vs Runway: AI Video Generator Comparison (2026)",
  description:
    "Compare DreamFace and Runway pricing, annual plans, credits, model access, AI video, avatars, voice tools, editing, and best-fit workflows.",
  keywords: [
    "DreamFace vs Runway",
    "Runway alternative",
    "Runway pricing",
    "Runway AI alternative",
    "AI video generator comparison"
  ],
  alternates: { canonical: absoluteUrl(siteUrl(), "/compare/dreamface-vs-runway") },
  openGraph: {
    title: "DreamFace vs Runway: Which AI Video Platform Fits Your Workflow?",
    description: "A source-linked comparison of pricing, credits, model access, avatars, voice, editing, and video workflows.",
    type: "article",
    url: absoluteUrl(siteUrl(), "/compare/dreamface-vs-runway"),
    modifiedTime: verifiedDate
  }
};

const tableClass = "w-full min-w-[760px] border-collapse text-left text-sm";
const thClass = "border-b border-black/15 bg-[#f3f8fb] px-4 py-4 font-black text-[#20242b]";
const tdClass = "border-b border-black/10 px-4 py-4 align-top font-medium leading-6 text-[#505c6d]";

export default function DreamFaceVsRunwayPage() {
  const baseUrl = siteUrl();
  const pageUrl = absoluteUrl(baseUrl, "/compare/dreamface-vs-runway");
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "DreamFace vs Runway: Which AI Video Generator Is Better in 2026?",
      url: pageUrl,
      dateModified: verifiedDate,
      description: "An objective comparison of DreamFace and Runway pricing, capabilities, and best-fit workflows.",
      about: [
        { "@type": "SoftwareApplication", name: "DreamFace", applicationCategory: "MultimediaApplication" },
        { "@type": "SoftwareApplication", name: "Runway", applicationCategory: "MultimediaApplication" }
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
        { "@type": "ListItem", position: 3, name: "DreamFace vs Runway", item: pageUrl }
      ]
    }
  ];

  return (
    <ComparisonPageShell structuredData={structuredData}>
        <article className="comparison-article">
          <header className="comparison-hero px-1 pb-12 pt-9 md:px-4 md:pb-16 md:pt-16">
            <nav aria-label="Breadcrumb" className="text-xs font-bold text-[#6b7280]">
              <Link href="/compare" className="hover:text-[#111]">Comparisons</Link> / DreamFace vs Runway
            </nav>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-[#087ea4]">Independent purchase guide</p>
            <h1 className="mt-4 max-w-5xl text-4xl font-black leading-[1.08] tracking-normal md:text-6xl">
              DreamFace vs Runway: Which AI Video Generator Is Better in 2026?
            </h1>
            <p className="mt-6 max-w-4xl text-base font-medium leading-8 text-[#536071] md:text-lg">
              DreamFace emphasizes low-commitment multi-model creation, talking avatars, voice, and marketing templates. Runway emphasizes AI video generation, editing, visual effects, and higher-volume production workspaces.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-bold text-[#667084]">
              <span className="rounded-full border border-black/10 bg-white px-4 py-2">Pricing verified July 10, 2026</span>
              <span className="rounded-full border border-black/10 bg-white px-4 py-2">Prices in USD</span>
            </div>
          </header>

          <section className="comparison-verdict border-y border-black/10 bg-white/70 px-5 py-8 md:px-8">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087ea4]">AI verdict</p>
            <p className="mt-3 max-w-5xl text-xl font-black leading-8 md:text-2xl">
              DreamFace is the lower-commitment choice for creators who need multiple model providers, avatars, voice, images, video, and reusable marketing formats. Runway is the stronger fit for teams centered on video editing, VFX, Runway's native generation workflow, and large monthly credit allocations.
            </p>
          </section>

          <section className="comparison-section py-12 md:py-16">
            <h2 className="text-3xl font-black tracking-normal md:text-4xl">Product overview</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <div className="comparison-card comparison-card-primary rounded-lg border border-[#9bdffc] bg-[#f1fbff] p-6">
                <h3 className="text-2xl font-black">DreamFace</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">
                  An all-in-one multimodal creation platform with text-to-video, image-to-video, talking avatars, AI voice and TTS, image creation and editing, and 300+ marketing templates.
                </p>
              </div>
              <div className="comparison-card rounded-lg border border-black/10 bg-white p-6">
                <h3 className="text-2xl font-black">Runway</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[#526071]">
                  An AI video and creative production platform with generative video and image models, video editing and transformation tools, audio tools, custom voices on Pro and above, workspace storage, and enterprise controls.
                </p>
              </div>
            </div>
          </section>

          <section className="comparison-section pb-12 md:pb-16">
            <h2 className="text-3xl font-black tracking-normal md:text-4xl">Feature comparison matrix</h2>
            <div className="comparison-table-frame mt-7 overflow-x-auto rounded-lg border border-black/10 bg-white">
              <table className={tableClass}>
                <thead><tr><th className={thClass}>Feature</th><th className={thClass}>DreamFace</th><th className={thClass}>Runway</th></tr></thead>
                <tbody>
                  {[
                    ["Primary focus", "Multimodal creation and marketing workflows", "AI video production, editing, and visual effects"],
                    ["Video generation", "Text-to-video and image-to-video across multiple providers", "Runway and third-party video models, including Gen-4.5 and more"],
                    ["Talking avatars", "Dedicated talking-avatar workflow", "Lip Sync and performance-oriented video tools"],
                    ["AI voice / TTS", "Dedicated multilingual voice generation", "TTS and audio tools; custom voices on Pro and above"],
                    ["Image tools", "Generation, editing, upscaling, and background removal", "Generation, references, image apps, and editing tools"],
                    ["Marketing assets", "300+ pre-made marketing templates", "Creative Apps and production tools; comparable public template count not confirmed"],
                    ["Video editing / VFX", "Generation-first workflow with model-dependent editing", "Broader documented video editing, transformation, and VFX workflow"],
                    ["Billing model", "Weekly, monthly, annual, and one-time credit options", "Free trial credits plus monthly or annual workspace subscriptions"]
                  ].map(([feature, dreamface, runway]) => (
                    <tr key={feature}><td className={`${tdClass} font-black text-[#20242b]`}>{feature}</td><td className={tdClass}>{dreamface}</td><td className={tdClass}>{runway}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="comparison-section comparison-panel border-y border-black/10 py-12 md:py-16">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087ea4]">Purchase comparison</p>
                <h2 className="mt-3 text-3xl font-black tracking-normal md:text-4xl">Monthly and annual pricing</h2>
              </div>
              <p className="max-w-xl text-sm font-medium leading-6 text-[#5b6677]">Annual equivalent prices are calculations for comparison. Annual subscriptions are billed upfront.</p>
            </div>

            <h3 className="mt-9 text-xl font-black">DreamFace plans</h3>
            <div className="comparison-table-frame mt-4 overflow-x-auto rounded-lg border border-black/10 bg-white">
              <table className={tableClass}>
                <thead><tr><th className={thClass}>Plan</th><th className={thClass}>Billing price</th><th className={thClass}>Credits</th><th className={thClass}>Purchase note</th></tr></thead>
                <tbody>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Premium Lite weekly</td><td className={tdClass}>$4.99 / week</td><td className={tdClass}>800 / week</td><td className={tdClass}>Lowest paid commitment; access to all models listed in Studio, with credit-based usage.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Premium Lite monthly</td><td className={tdClass}>$12.99 / month</td><td className={tdClass}>2,400 / month</td><td className={tdClass}>Flexible monthly billing.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Premium Lite annual</td><td className={tdClass}>$99 / year ($8.25/mo equivalent)</td><td className={tdClass}>18,000 / year</td><td className={tdClass}>About $56 less than 12 monthly payments.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Premium monthly</td><td className={tdClass}>$24.99 / month</td><td className={tdClass}>4,600 / month</td><td className={tdClass}>Higher capacity for premium video and campaign work.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Premium annual</td><td className={tdClass}>$199 / year ($16.58/mo equivalent)</td><td className={tdClass}>38,000 / year</td><td className={tdClass}>About $100 less than 12 monthly payments.</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="mt-9 text-xl font-black">Runway individual plans</h3>
            <div className="comparison-table-frame mt-4 overflow-x-auto rounded-lg border border-black/10 bg-white">
              <table className={tableClass}>
                <thead><tr><th className={thClass}>Plan</th><th className={thClass}>Monthly billing</th><th className={thClass}>Annual billing</th><th className={thClass}>Monthly credits</th></tr></thead>
                <tbody>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Standard</td><td className={tdClass}>$15 / month</td><td className={tdClass}>$144 / year ($12/mo equivalent)</td><td className={tdClass}>625</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Pro</td><td className={tdClass}>$35 / month</td><td className={tdClass}>$336 / year ($28/mo equivalent)</td><td className={tdClass}>2,250</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Max</td><td className={tdClass}>$95 / month</td><td className={tdClass}>$912 / year ($76/mo equivalent)</td><td className={tdClass}>9,500; up to one month of unused credits can roll over</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs font-medium leading-6 text-[#667084]">
              Runway Free includes 125 one-time credits. Standard and Pro plan credits reset on the billing date. Runway introduced Max in June 2026 and is phasing out Unlimited; existing Unlimited subscribers are scheduled to transition under Runway's published migration process.
            </p>
          </section>

          <section className="comparison-section py-12 md:py-16">
            <h2 className="text-3xl font-black tracking-normal md:text-4xl">Use-case matrix</h2>
            <div className="comparison-table-frame mt-7 overflow-x-auto rounded-lg border border-black/10 bg-white">
              <table className={tableClass}>
                <thead><tr><th className={thClass}>Scenario</th><th className={thClass}>Best fit</th><th className={thClass}>Reason</th></tr></thead>
                <tbody>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Low-commitment multi-model testing</td><td className={tdClass}>DreamFace</td><td className={tdClass}>The $4.99 weekly plan provides 800 credits and access to the Studio model catalog.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Social ads and talking explainers</td><td className={tdClass}>DreamFace</td><td className={tdClass}>Templates, talking avatars, voice, images, and video are integrated as direct creation modes.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Video editing and visual effects</td><td className={tdClass}>Runway</td><td className={tdClass}>Runway documents a broader production workflow around editing, transformation, and VFX tools.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>High-volume monthly generation</td><td className={tdClass}>Runway Max</td><td className={tdClass}>Max includes 9,500 monthly credits and permits one month of credit rollover.</td></tr>
                  <tr><td className={`${tdClass} font-black text-[#20242b]`}>Irregular or seasonal creation</td><td className={tdClass}>DreamFace</td><td className={tdClass}>Weekly subscriptions and one-time credit packs avoid a required monthly or annual commitment.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="comparison-section comparison-panel border-y border-black/10 py-12 md:py-16">
            <h2 className="text-3xl font-black tracking-normal md:text-4xl">Feature-by-feature analysis</h2>
            <div className="comparison-analysis-grid mt-8 grid gap-9 md:grid-cols-3">
              <div><h3 className="text-xl font-black">Video generation and editing</h3><p className="mt-3 text-sm font-medium leading-7 text-[#586477]">Both platforms provide text-to-video and image-to-video workflows across modern models. Runway surrounds generation with a deeper documented editing and visual-effects environment. DreamFace keeps generation simpler and routes creators across several providers from one Studio. Runway is the better fit for video-first production; DreamFace is the better fit when video is one part of a mixed image, avatar, voice, and marketing workflow.</p></div>
              <div><h3 className="text-xl font-black">Avatars and audio</h3><p className="mt-3 text-sm font-medium leading-7 text-[#586477]">DreamFace exposes talking avatars and multilingual voice generation as dedicated Studio modes. Runway provides generative audio, text-to-speech, Lip Sync, and custom voices on Pro and higher plans. Teams should choose based on workflow shape: DreamFace for direct avatar-led content and reusable marketing templates; Runway for integrating audio and performance tools into a broader video-production workspace.</p></div>
              <div><h3 className="text-xl font-black">Billing flexibility</h3><p className="mt-3 text-sm font-medium leading-7 text-[#586477]">DreamFace offers weekly, monthly, annual, and one-time credit purchases. Runway offers a free one-time credit allocation and paid monthly or annual workspace plans. Runway annual pricing reduces each tier by 20 percent relative to monthly billing. DreamFace provides the lower initial paid commitment, while Runway Max provides the largest fixed monthly allocation in this comparison.</p></div>
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
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#72d9ff]">Try the lower-commitment path</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-normal">Access the DreamFace model catalog from $4.99 per week.</h2><p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/70">Includes 800 weekly credits. Model usage remains credit-based and subject to availability.</p></div>
            <Link href="/price" className="mt-6 inline-flex rounded-lg bg-[#10bff3] px-6 py-3 text-sm font-black text-[#06151b] md:mt-0">View DreamFace pricing</Link>
          </section>

          <section className="comparison-sources py-10 text-xs font-medium leading-6 text-[#667084]">
            <h2 className="font-black uppercase tracking-[0.12em] text-[#3f4856]">Sources and methodology</h2>
            <p className="mt-3 max-w-5xl">DreamFace prices and credits are sourced from the live product configuration. Runway prices, credits, rollover rules, and the Unlimited-to-Max transition were checked against Runway's official pricing page and help center on July 10, 2026. Prices, taxes, credits, models, promotions, and availability can change.</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/price" className="font-bold underline">DreamFace pricing</Link>
              <a href="https://runwayml.com/pricing" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">Runway pricing</a>
              <a href="https://help.runwayml.com/hc/en-us/articles/15124877443219-How-do-credits-work" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">Runway credit rules</a>
              <a href="https://help.runwayml.com/hc/en-us/articles/52068047744019-Unlimited-plan-is-switching-to-Max" target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">Runway Max transition</a>
            </div>
          </section>
        </article>
    </ComparisonPageShell>
  );
}
