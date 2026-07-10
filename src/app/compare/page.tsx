import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { TopNav } from "../../components/top-nav";
import { absoluteUrl, siteUrl } from "../../lib/site-url";

export const metadata: Metadata = {
  title: "AI Video Platform Comparisons",
  description: "Objective, source-linked comparisons of DreamFace and other AI video creation platforms.",
  alternates: { canonical: absoluteUrl(siteUrl(), "/compare") },
  openGraph: {
    title: "AI Video Platform Comparisons | DreamFace",
    description: "Compare AI video platforms by pricing, model access, workflows, and best-fit use cases.",
    type: "website",
    url: absoluteUrl(siteUrl(), "/compare")
  }
};

export default function ComparePage() {
  const baseUrl = siteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "DreamFace AI Platform Comparisons",
    url: absoluteUrl(baseUrl, "/compare"),
    description: "Source-linked comparisons of AI video and multimodal creation platforms.",
    hasPart: [
      {
        "@type": "WebPage",
        name: "DreamFace vs Higgsfield",
        url: absoluteUrl(baseUrl, "/compare/dreamface-vs-higgsfield")
      },
      {
        "@type": "WebPage",
        name: "DreamFace vs Runway",
        url: absoluteUrl(baseUrl, "/compare/dreamface-vs-runway")
      },
      {
        "@type": "WebPage",
        name: "DreamFace vs Kling AI",
        url: absoluteUrl(baseUrl, "/compare/dreamface-vs-kling-ai")
      },
      {
        "@type": "WebPage",
        name: "DreamFace vs Pika",
        url: absoluteUrl(baseUrl, "/compare/dreamface-vs-pika")
      },
      {
        "@type": "WebPage",
        name: "DreamFace vs Artlist",
        url: absoluteUrl(baseUrl, "/compare/dreamface-vs-artlist")
      },
      {
        "@type": "WebPage",
        name: "DreamFace vs HeyGen",
        url: absoluteUrl(baseUrl, "/compare/dreamface-vs-heygen")
      }
    ]
  };

  return (
    <main className="bg-grid min-h-screen pb-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="px-1 py-12 md:px-4 md:py-20">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087ea4]">AI platform research</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-normal text-[#17191d] md:text-6xl">
            DreamFace competitor comparisons
          </h1>
          <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-[#566172] md:text-lg">
            Purchase-focused comparisons built from public pricing, documented capabilities, and clearly dated source checks.
          </p>
        </section>

        <section className="border-y border-black/10 py-8">
          <div className="grid gap-5">
            {[
              {
                href: "/compare/dreamface-vs-higgsfield",
                title: "DreamFace vs Higgsfield",
                description: "Compare weekly entry access, monthly and annual plans, cinematic controls, avatars, voice tools, and marketing workflows."
              },
              {
                href: "/compare/dreamface-vs-runway",
                title: "DreamFace vs Runway",
                description: "Compare weekly entry access, monthly and annual plans, credits, AI video, editing, avatars, audio, and high-volume workflows."
              },
              {
                href: "/compare/dreamface-vs-kling-ai",
                title: "DreamFace vs Kling AI",
                description: "Compare weekly entry access, monthly and annual plans, credits, Kling-native video controls, avatars, voice, and multi-model workflows."
              },
              {
                href: "/compare/dreamface-vs-pika",
                title: "DreamFace vs Pika",
                description: "Compare weekly entry access, monthly and annual plans, credits, Pika effects, frame animation, avatars, voice, and marketing workflows."
              },
              {
                href: "/compare/dreamface-vs-artlist",
                title: "DreamFace vs Artlist",
                description: "Compare weekly entry access, AI Suite monthly and annual plans, credits, stock media, licensing, avatars, voice, music, and production workflows."
              },
              {
                href: "/compare/dreamface-vs-heygen",
                title: "DreamFace vs HeyGen",
                description: "Compare weekly entry access, monthly and annual plans, credits, digital twins, stock avatars, voice cloning, video translation, and localization workflows."
              }
            ].map((comparison) => (
              <Link
                key={comparison.href}
                href={comparison.href}
                className="grid gap-6 rounded-lg border border-black/10 bg-white p-6 transition hover:border-[#08bff1] hover:shadow-[0_16px_40px_rgba(8,191,241,0.12)] md:grid-cols-[1fr_auto] md:items-center md:p-8"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667084]">AI video and multimodal creation</p>
                  <h2 className="mt-3 text-3xl font-black tracking-normal">{comparison.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[#586477]">{comparison.description}</p>
                </div>
                <span className="text-sm font-black text-[#087ea4]">Read comparison -&gt;</span>
              </Link>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
