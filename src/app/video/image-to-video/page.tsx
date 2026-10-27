import type { Metadata } from "next";
import { landingAlternates, LandingLanguages } from "../../../features/landing-pages/localized-landing";
import Link from "next/link";
import { SiteFooter } from "../../../components/site-footer";
import { TopNav } from "../../../components/top-nav";
import { absoluteUrl, siteUrl } from "../../../lib/site-url";
import { DREAMFACE_CREDIT_SUMMARY } from "../../compare/dreamface-credit-packs";

const pagePath = "/video/image-to-video";
const studioHref = "/studio?mode=video&workflow=image-to-video";
const title = "Image to Video AI Generator | Animate Photos | DreamFace";
const description = "Turn a photo or illustration into AI video. Upload an image, describe the motion, choose a model and preview the credit cost before generating.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: absoluteUrl(siteUrl(), pagePath), languages: landingAlternates("image-video") },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: absoluteUrl(siteUrl(), pagePath), title, description, siteName: "DreamFace" },
  twitter: { card: "summary", title, description }
};

const steps = [
  ["01", "Upload an image", "Open Studio, choose Image to Video, and add the image you want to animate."],
  ["02", "Describe the motion", "Write what should move, how the camera should behave, and the style or atmosphere you want."],
  ["03", "Choose settings and generate", "Select an available model, duration and resolution. Review the estimated credit cost next to Generate before starting."]
];
const faqs = [
  { question: "How do I turn a photo into a video with AI?", answer: "Open Image to Video in DreamFace Studio, upload a photo, and describe the movement you want. Choose an available model and settings, check the estimated credits, and generate your video." },
  { question: "What is image-to-video AI?", answer: "Image-to-video AI uses a still image and a motion prompt to create a short animated video. The image guides the scene while the selected model generates motion; results vary by model and prompt." },
  { question: "Can I try image to video for free?", answer: "Trial credits depend on signup eligibility and may change. Check your account balance and the estimated generation cost in Studio; if you need more credits, DreamFace offers one-time credit packs without automatic renewal." },
  { question: "How much does image to video cost?", answer: `${DREAMFACE_CREDIT_SUMMARY} The estimated credits for your chosen model and settings are shown in Studio before generation.` },
  { question: "What image formats can I upload?", answer: "The Studio image upload accepts JPEG, PNG, and WebP. Choose a clear image with the subject and framing you want; upload and model limits are shown in Studio." },
  { question: "How long can an AI-generated video be?", answer: "Available durations depend on the selected model. HeyGen Video supports clips from 5 to 15 seconds. Check the duration options in Studio for the model you choose." },
  { question: "Can I create image-to-video clips in HD or 2K?", answer: "Resolution options vary by model. HeyGen Video supports 480p, 768p, 1080p and 2K; higher resolutions may use more credits. Review the estimate before generating." },
  { question: "Does image to video include sound?", answer: "Audio depends on the model. HeyGen Video generates sound with its video; other models may offer different audio options. Review the available controls for your selected model." },
  { question: "What should I write in an image-to-video prompt?", answer: "Describe the motion you want rather than only listing what is already in the image. Include the subject's movement, camera direction and atmosphere. For example: 'The camera slowly moves toward the product as soft light shifts across the background.'" },
  { question: "Can I animate a portrait or an old photo?", answer: "You can upload a portrait or an old photo and describe subtle movements, such as a gentle head turn or a slow camera push. Results may vary, and you should have the rights and permissions needed to use the image." },
  { question: "Can I turn a product image or illustration into a video?", answer: "Yes. Upload your product image or illustration and describe the motion or camera movement. Simple, specific prompts can help keep attention on the subject, although the generated result may change details." },
  { question: "Can I make a vertical video for social media?", answer: "You can start with a portrait image and choose a compatible model or aspect ratio. Available ratios depend on the model; some image-to-video models follow the source image's aspect ratio." },
  { question: "How is image to video different from text to video?", answer: "Image to video starts with an uploaded image as a visual reference, while text to video starts with a written prompt. Both use a prompt to describe the scene and movement." },
  { question: "Why did my video look different from the source image?", answer: "AI models generate new frames rather than simply moving the original pixels, so faces, objects or backgrounds may change. Try a clear source image, a simpler motion prompt or another supported model." },
  { question: "How long does video generation take?", answer: "Generation time varies with the model, duration, resolution and provider queue. Studio shows the task status while it is processing; there is no guaranteed completion time." },
  { question: "Can I use my generated video commercially?", answer: "Review DreamFace's terms, the selected model's applicable terms and any rights in your source image, music or other material before commercial use. You are responsible for obtaining necessary permissions." }
];

export default function ImageToVideoPage() {
  const schema = [{ "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: absoluteUrl(siteUrl(), pagePath) }, {
    "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))
  }];
  return (
    <main className="min-h-screen bg-[#f8faff] text-[#1f2430]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <TopNav />
        <LandingLanguages kind="image-video" />
        <section className="py-16 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7554df]">AI image to video</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">Turn an image into a video with AI</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#596579]">Bring photos, illustrations, and product images to life. Upload an image, describe the motion, and create a short video with the model and settings that fit your idea.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href={studioHref} className="rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white">Create image to video</Link><Link href="/price" className="rounded-xl border border-[#ddd6f5] bg-white px-6 py-4 text-sm font-bold text-[#5542a4]">See credit packs</Link></div>
          <p className="mt-4 text-sm text-[#667084]">Review the estimated credit cost in Studio before you generate.</p>
        </section>
        <section className="border-t border-[#e8e6f0] py-14">
          <h2 className="text-3xl font-black">How to animate an image</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">{steps.map(([number, name, detail]) => <div key={number} className="rounded-2xl border border-[#e8e6f0] bg-white p-6"><p className="text-sm font-black text-[#7554df]">{number}</p><h3 className="mt-3 text-xl font-bold">{name}</h3><p className="mt-3 text-sm leading-7 text-[#596579]">{detail}</p></div>)}</div>
        </section>
        <section className="grid gap-8 border-t border-[#e8e6f0] py-14 md:grid-cols-2">
          <div><h2 className="text-3xl font-black">Create from the images you already have</h2><p className="mt-4 leading-8 text-[#596579]">Explore motion for a product image, add atmosphere to an illustration, or turn a portrait into a short creative clip. Describe specific movement and camera direction for a clearer starting point.</p><p className="mt-4 text-sm leading-7 text-[#596579]">Example prompt: “Slowly move the camera toward the product while soft light shifts across the background. Keep the product centered.”</p></div>
          <div className="rounded-2xl bg-[#f0edff] p-7"><h2 className="text-2xl font-black">Models, settings and credits</h2><p className="mt-4 text-sm leading-7 text-[#596579]">Select from the image-to-video models available in Studio. HeyGen Video defaults to 5 seconds at 768p and supports generated audio; other models have their own settings.</p><p className="mt-4 text-sm leading-7 text-[#596579]">{DREAMFACE_CREDIT_SUMMARY}</p><Link href="/price" className="mt-4 inline-block text-sm font-bold text-[#6548d0] underline">View current credit packs</Link></div>
        </section>
        <section className="border-t border-[#e8e6f0] py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">Help and tips</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Frequently asked questions</h2>
          <p className="mt-4 max-w-4xl text-base leading-8 text-[#586579]">Find answers about animating photos, model settings, credits and getting better results.</p>
          <div className="mt-7 grid gap-3 lg:grid-cols-2">{faqs.map(({question, answer}, index) => <article key={question} className={`card motion-smooth lift-soft h-full rounded-2xl p-6 ${index % 3 === 0 ? "tone-blue" : index % 3 === 1 ? "tone-peach" : "tone-mint"}`}><h3 className="text-lg font-semibold tracking-tight">{question}</h3><p className="mt-2 text-sm leading-7 text-[#606676]">{answer}</p></article>)}</div>
          <Link href={studioHref} className="mt-8 inline-block rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white">Start creating</Link>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
