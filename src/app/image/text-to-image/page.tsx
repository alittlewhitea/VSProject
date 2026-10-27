import type { Metadata } from "next";
import { landingAlternates, LandingLanguages } from "../../../features/landing-pages/localized-landing";
import Link from "next/link";
import { SiteFooter } from "../../../components/site-footer";
import { TopNav } from "../../../components/top-nav";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { DREAMFACE_CREDIT_SUMMARY } from "../../compare/dreamface-credit-packs";

const pagePath = "/image/text-to-image";
const studioHref = "/studio?mode=image&workflow=text-to-image";
const title = "Text to Image AI Generator | Create Images from Text | DreamFace";
const description = "Turn a text prompt into an AI image. Choose a model, describe your idea and review the credit cost before generating.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: absoluteUrl(siteUrl(), pagePath), languages: landingAlternates("text-image") },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: absoluteUrl(siteUrl(), pagePath), title, description, siteName: "DreamFace" },
  twitter: { card: "summary", title, description }
};

const steps = [
  ["01", "Describe your idea", "Open Text to Image in Studio and describe the subject, setting, style and lighting you want."],
  ["02", "Choose a model and settings", "Select an available image model and adjust the supported image size or quality options."],
  ["03", "Generate and refine", "Review the estimated credits before generating, then adjust your prompt or settings to explore another result."]
];
const faqs = [
  { question: "How do I create an AI image from text?", answer: "Open Text to Image in DreamFace Studio, describe the picture you want, select a model and available settings, and review the estimated credits before generating." },
  { question: "What is a text-to-image AI generator?", answer: "It is a tool that creates a new image from a written description. The model interprets your prompt to generate visual details such as subjects, settings, lighting and style." },
  { question: "Can I try the AI image generator for free?", answer: "Trial credits depend on signup eligibility and may change. Check your balance and estimated cost in Studio. If you need more credits, DreamFace offers one-time credit packs without automatic renewal." },
  { question: "How much does text-to-image generation cost?", answer: `${DREAMFACE_CREDIT_SUMMARY} Image cost depends on the selected model and settings; check the Studio estimate before generating.` },
  { question: "What should I write in an AI image prompt?", answer: "Start with the subject and setting, then add details such as lighting, composition, color and visual style. For example: 'A ceramic coffee cup on a wooden table, soft morning light, editorial product photography.'" },
  { question: "Which AI image models can I use?", answer: "Studio lists supported models including GPT Image, Nano Banana and FLUX options. Available models, features and prices can change; check the current Studio list." },
  { question: "Can I create realistic photos or illustrations?", answer: "You can ask for photographic, illustrated, cinematic or other styles in your prompt. Results depend on the model and how clearly you describe the image." },
  { question: "Can I choose the size or aspect ratio?", answer: "Available sizes, aspect ratios and quality settings depend on the selected model. Review the options in Studio before generating." },
  { question: "Can I create images for social media and marketing?", answer: "You can generate visuals for ideas such as social posts and product concepts. Choose a suitable composition and review the output and any applicable usage terms before publishing." },
  { question: "Can the AI generate text inside an image?", answer: "Some models can render text, but spelling, layout and legibility are not guaranteed. Specify the exact text in your prompt and check the result before using it." },
  { question: "Can I edit an image after generating it?", answer: "DreamFace Studio also provides image-to-image workflows. Select a supported editing model and supply the image and instructions; available controls depend on the model." },
  { question: "Why did the image differ from my prompt?", answer: "Generated results can vary and may miss details or contain artifacts. Try a clearer prompt, adjust the composition, or choose another available model." },
  { question: "Can I use AI-generated images commercially?", answer: "Review DreamFace's terms, the selected model's applicable terms and any rights associated with your prompt or reference materials before commercial use." },
  { question: "Do I need a subscription to generate images?", answer: "DreamFace offers one-time credit packs without automatic renewal. Check your account balance and the estimated credit cost in Studio before creating." }
];

export default function TextToImagePage() {
  const schema = [{ "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: absoluteUrl(siteUrl(), pagePath) }, {
    "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))
  }];
  return (
    <main className="min-h-screen bg-[#f8faff] text-[#1f2430]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <TopNav />
        <LandingLanguages kind="text-image" />
        <section className="py-16 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7554df]">AI text to image</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">Turn your ideas into images with AI</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#596579]">Describe what you want to create and turn your words into images. Explore realistic scenes, illustrations and visual concepts with the model and settings that fit your idea.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href={studioHref} className="rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white">Create an AI image</Link><Link href="/price" className="rounded-xl border border-[#ddd6f5] bg-white px-6 py-4 text-sm font-bold text-[#5542a4]">See credit packs</Link></div>
          <p className="mt-4 text-sm text-[#667084]">Review the estimated credit cost in Studio before you generate.</p>
        </section>
        <section className="border-t border-[#e8e6f0] py-14">
          <h2 className="text-3xl font-black">How to create an image from text</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">{steps.map(([number, name, detail]) => <div key={number} className="rounded-2xl border border-[#e8e6f0] bg-white p-6"><p className="text-sm font-black text-[#7554df]">{number}</p><h3 className="mt-3 text-xl font-bold">{name}</h3><p className="mt-3 text-sm leading-7 text-[#596579]">{detail}</p></div>)}</div>
        </section>
        <section className="grid gap-8 border-t border-[#e8e6f0] py-14 md:grid-cols-2">
          <div><h2 className="text-3xl font-black">Create visuals from a simple idea</h2><p className="mt-4 leading-8 text-[#596579]">Explore product concepts, illustrations, social media visuals and creative scenes. Describe the subject, composition and lighting to give the model a useful starting point.</p><p className="mt-4 text-sm leading-7 text-[#596579]">Example prompt: ?A ceramic coffee cup on a wooden table, soft morning light, warm neutral colors, editorial product photography.?</p></div>
          <div className="rounded-2xl bg-[#f0edff] p-7"><h2 className="text-2xl font-black">Models, settings and credits</h2><p className="mt-4 text-sm leading-7 text-[#596579]">Choose from the text-to-image models available in Studio. Options such as size and quality depend on the selected model.</p><p className="mt-4 text-sm leading-7 text-[#596579]">{DREAMFACE_CREDIT_SUMMARY}</p><Link href="/price" className="mt-4 inline-block text-sm font-bold text-[#6548d0] underline">View current credit packs</Link></div>
        </section>
        <section className="border-t border-[#e8e6f0] py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">Help and tips</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Frequently asked questions</h2>
          <p className="mt-4 max-w-4xl text-base leading-8 text-[#586579]">Find answers about creating images from text, prompts, model settings, credits and usage.</p>
          <div className="mt-7 grid gap-3 lg:grid-cols-2">{faqs.map(({question, answer}, index) => <article key={question} className={`card motion-smooth lift-soft h-full rounded-2xl p-6 ${index % 3 === 0 ? "tone-blue" : index % 3 === 1 ? "tone-peach" : "tone-mint"}`}><h3 className="text-lg font-semibold tracking-tight">{question}</h3><p className="mt-2 text-sm leading-7 text-[#606676]">{answer}</p></article>)}</div>
          <Link href={studioHref} className="mt-8 inline-block rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white">Start creating</Link>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
