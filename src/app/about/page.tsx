import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";

const pillars = [
  {
    title: "Leading AI tools",
    body:
      "DreamFace brings together current AI models for image, video, and voiceover creation with curated prompts, production-ready workflows, and editing utilities. Everything sits in one workspace so creators can move from idea to polished asset without chasing tools across tabs.",
    cta: "Explore AI Tools",
    href: "/studio?mode=image&workflow=text-to-image"
  },
  {
    title: "Our mission",
    body:
      "Our mission is to help creators, founders, and brands bring visual ideas to life with speed and confidence. Whether you are telling a story, launching a product, testing ad concepts, or building a campaign, DreamFace gives you the AI tools and creative structure to make high-quality work without unnecessary friction.",
    cta: "Learn More",
    href: "/gallery"
  },
  {
    title: "Creator community",
    body:
      "DreamFace is built for the new generation of visual creators: solo makers, agencies, ecommerce teams, social studios, and brand marketers. We focus on legally aware AI workflows, reusable prompts, credit-based generation, and organized creation history so you can spend more time creating and less time managing the process.",
    cta: "Start Creating",
    href: "/studio?mode=image&workflow=text-to-image"
  }
];

const stats = [
  { label: "Creation modes", value: "Image + Video" },
  { label: "Workflow", value: "Prompt to asset" },
  { label: "Billing", value: "Credits" },
  { label: "Focus", value: "Commercial creators" }
];

export const metadata = {
  title: "About Us | DreamFace",
  description: "Learn about DreamFace, our mission, AI tools, and creator-focused workflow."
};

export default function AboutPage() {
  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="rounded-[2rem] border border-black/5 bg-white/92 p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">About Us</p>
              <h1 className="mt-3 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
                AI creation tools for teams that move fast.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-[#53627b] md:text-lg">
                DreamFace helps creators and brands produce standout visual content with modern AI models, reusable prompt workflows, credit-based generation, and a growing library of creative references.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <AppButton href="/studio?mode=image&workflow=text-to-image" variant="primary">Open Studio</AppButton>
                <AppButton href="/gallery" variant="secondary">Browse Gallery</AppButton>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-black/10 bg-[#f8fbff] p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#667084]">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {pillars.map((pillar, index) => (
            <article
              key={pillar.title}
              className={`card rounded-3xl p-7 ${
                index === 0 ? "tone-blue" : index === 1 ? "tone-mint" : "tone-violet"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.14em] text-[#667084]">0{index + 1}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{pillar.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[#536071]">{pillar.body}</p>
              <div className="mt-6">
                <AppButton href={pillar.href} variant={index === 1 ? "dark" : "secondary"} size="md">
                  {pillar.cta}
                </AppButton>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[2rem] border border-black/5 bg-gradient-to-br from-[#eef7ff] via-white to-[#f5f0ff] p-6 shadow-[0_20px_50px_rgba(13,18,35,0.08)] md:p-9">
          <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Why DreamFace</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">Built around creative momentum.</h2>
            </div>
            <div className="grid gap-3">
              {[
                "Route image and video tasks through a unified workflow.",
                "Track credits, task status, and generated work in one account.",
                "Use prompt galleries as starting points for faster iteration.",
                "Keep commercial usage, copyright, and privacy terms visible from day one."
              ].map((item) => (
                <div key={item} className="rounded-xl border border-black/10 bg-white/85 px-4 py-3 text-sm text-[#4e596b]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
