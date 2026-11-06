import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "../../components/top-nav";
import { SiteFooter } from "../../components/site-footer";
import { absoluteUrl, siteUrl } from "../../lib/site-url";
import { LocalizedStudioLink } from "./localized-studio-link";
import { textVideoCopy, type TextVideoLocale } from "./text-video-data";
import { textVideoMedia, type TextVideoMedia } from "./text-video-media";

const path = "/video/text-to-video";
const studioHref = "/studio?mode=video&workflow=text-to-video";
const languages = ["en", "es", "pt-BR"] as const;
const caseIds = ["product", "cinema", "illustration", "nature"] as const;
const promptIdeas = {
  en: ["A ceramic perfume bottle on a stone pedestal. The camera slowly circles the bottle as warm light moves across the background. Minimal studio product shot.", "A lone traveler walks through a quiet city street at dusk. The camera follows slowly from behind. Gentle rain reflects the amber streetlights.", "An illustrated fox walks through a paper-cut forest. Leaves sway gently as the camera pans right. Warm colors and a storybook style.", "Morning mist drifts across a mountain lake. A slow camera push reveals the trees reflected in the water. Soft golden light."],
  es: ["Un frasco de perfume de cerámica sobre un pedestal de piedra. La cámara gira lentamente mientras una luz cálida recorre el fondo. Estilo de fotografía de producto minimalista.", "Una persona camina por una calle tranquila al anochecer. La cámara la sigue lentamente desde atrás. La lluvia refleja las luces de la calle.", "Un zorro ilustrado camina por un bosque de papel recortado. Las hojas se mueven suavemente y la cámara gira a la derecha. Colores cálidos y estilo de cuento.", "La niebla matinal se desplaza sobre un lago de montaña. La cámara avanza lentamente y revela el reflejo de los árboles. Luz dorada suave."],
  "pt-BR": ["Um frasco de perfume de cerâmica sobre um pedestal de pedra. A câmera circula lentamente enquanto uma luz quente atravessa o fundo. Estilo de fotografia de produto minimalista.", "Uma pessoa caminha por uma rua tranquila ao anoitecer. A câmera acompanha lentamente por trás. A chuva reflete as luzes da rua.", "Uma raposa ilustrada caminha por uma floresta de papel recortado. As folhas se movem suavemente e a câmera gira à direita. Cores quentes e estilo de livro infantil.", "A névoa da manhã passa sobre um lago de montanha. A câmera avança lentamente e revela o reflexo das árvores. Luz dourada suave."]
};

function urlFor(locale: TextVideoLocale) { return locale === "en" ? path : `/${locale}${path}`; }
function isSupported(locale: string): locale is TextVideoLocale { return languages.some((value) => value === locale); }
export function textVideoMetadata(locale: string): Metadata {
  if (!isSupported(locale)) return {};
  const c = textVideoCopy[locale];
  return {
    title: { absolute: c.title }, description: c.description, robots: { index: true, follow: true },
    alternates: { canonical: absoluteUrl(siteUrl(), urlFor(locale)), languages: { ...Object.fromEntries(languages.map((lang) => [lang, absoluteUrl(siteUrl(), urlFor(lang))])), "x-default": absoluteUrl(siteUrl(), path) } },
    openGraph: { type: "website", title: c.title, description: c.description, url: absoluteUrl(siteUrl(), urlFor(locale)), locale: locale === "pt-BR" ? "pt_BR" : locale === "es" ? "es_ES" : "en_US", siteName: "DreamFace" },
    twitter: { card: "summary", title: c.title, description: c.description }
  };
}

function Media({ media, title, note, variant = 0 }: { media: TextVideoMedia | null; title: string; note: string; variant?: number }) {
  if (media) return <video aria-label={title} src={media.videoUrl} poster={media.posterUrl} controls playsInline preload="none" className="aspect-video w-full bg-[#17122e] object-contain" />;
  const tones = ["from-[#291a59] via-[#4d3c7e] to-[#b291ba]", "from-[#332642] via-[#8c6261] to-[#dfb287]", "from-[#1a3844] via-[#416b70] to-[#a1c3a3]", "from-[#263952] via-[#5b7386] to-[#c5c6b1]"];
  return <div className={`relative isolate flex aspect-video flex-col justify-end overflow-hidden bg-gradient-to-br ${tones[variant % tones.length]} p-7 text-white sm:p-9`}>
    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 h-64 w-64 rounded-full border-[32px] border-white/10" />
    <div aria-hidden="true" className="pointer-events-none absolute left-10 top-12 h-28 w-28 rotate-12 rounded-3xl border border-white/20 bg-white/10" />
    <p className="relative max-w-sm text-2xl font-semibold leading-tight sm:text-3xl">{title}</p>
    <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/75">{note}</p>
  </div>;
}

export function TextVideoPage({ locale }: { locale: string }) {
  if (!isSupported(locale)) notFound();
  const c = textVideoCopy[locale];
  const schema = [{ "@context": "https://schema.org", "@type": "WebPage", name: c.title, description: c.description, url: absoluteUrl(siteUrl(), urlFor(locale)), inLanguage: locale }, {
    "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))
  }];
  const primary = "inline-flex items-center justify-center rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#6241ca] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7554df]";
  const hasExamples = caseIds.some((id) => textVideoMedia[id]);
  const examplesIntro = hasExamples ? c.intro : c.examplesIntro;
  return <main className="min-h-screen bg-[#f8faff] text-[#1f2430]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <TopNav />
      <section className="grid grid-cols-1 items-center gap-10 py-14 md:py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#7554df]">{c.eyebrow}</p><h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">{c.heading}</h1><p className="mt-6 text-lg leading-8 text-[#596579]">{c.intro}</p><div className="mt-8 flex flex-wrap gap-3"><LocalizedStudioLink locale={locale} href={studioHref} className={primary}>{c.create}</LocalizedStudioLink><Link href={`/${locale}/price`} className="rounded-xl border border-[#ddd6f5] bg-white px-6 py-4 text-sm font-bold text-[#5542a4]">{c.pricing}</Link></div><p className="mt-4 text-sm text-[#667084]">{c.note}</p></div>
        <div className="overflow-hidden rounded-3xl border border-black/5 shadow-[0_24px_70px_-30px_#56359166]"><Media media={textVideoMedia.hero} title={c.preview} note={c.previewNote} /></div>
      </section>
      <section className="border-t border-[#e8e6f0] py-14"><div className="max-w-3xl"><h2 className="text-3xl font-black tracking-tight md:text-4xl">{c.examples}</h2><p className="mt-4 leading-8 text-[#596579]">{examplesIntro}</p></div>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">{caseIds.map((id, i) => {
          const media = textVideoMedia[id];
          return <article key={id} className="overflow-hidden rounded-2xl border border-[#e8e6f0] bg-white"><Media media={media} title={c.scenes[i][0]} note={c.concept} variant={i} /><div className="p-6"><h3 className="text-xl font-bold">{c.scenes[i][0]}</h3><p className="mt-2 text-sm leading-7 text-[#596579]">{c.scenes[i][1]}</p>{media && <p className="mt-3 text-xs font-semibold text-[#7554df]">{[media.model, media.duration, media.resolution].filter(Boolean).join(" · ")}</p>}<div className="mt-4 rounded-xl bg-[#f7f6fc] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#7554df]">{c.prompt}</p><p className="mt-2 text-sm leading-7 text-[#596579]">{media?.prompt || promptIdeas[locale][i]}</p></div></div></article>;
        })}</div>
      </section>
      <section className="border-t border-[#e8e6f0] py-14"><h2 className="text-3xl font-black md:text-4xl">{c.how}</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{c.steps.map(([name, body], i) => <article key={name} className="rounded-2xl border border-[#e8e6f0] bg-white p-6"><p className="text-sm font-bold text-[#7554df]">0{i + 1}</p><h3 className="mt-3 text-xl font-bold">{name}</h3><p className="mt-3 text-sm leading-7 text-[#596579]">{body}</p></article>)}</div></section>
      <section className="grid gap-8 rounded-3xl bg-[#f0edff] p-7 md:grid-cols-2 md:p-10"><div><h2 className="text-3xl font-black">{c.models}</h2><p className="mt-4 text-sm leading-8 text-[#596579]">{c.modelCopy}</p></div><div><p className="text-sm leading-8 text-[#596579]">{c.credits}</p><Link href={`/${locale}/price`} className="mt-5 inline-block text-sm font-bold text-[#6548d0] underline">{c.pricing}</Link></div></section>
      <section className="py-14"><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">{c.faq}</h2><p className="mt-4 text-base leading-8 text-[#586579]">{c.faqIntro}</p><div className="mt-7 grid gap-3 lg:grid-cols-2">{c.faqs.map(([question, answer], i) => <article key={question} className={`card motion-smooth lift-soft h-full rounded-2xl p-6 ${i % 3 === 0 ? "tone-blue" : i % 3 === 1 ? "tone-peach" : "tone-mint"}`}><h3 className="text-lg font-semibold tracking-tight">{question}</h3><p className="mt-2 text-sm leading-7 text-[#606676]">{answer}</p></article>)}</div><LocalizedStudioLink locale={locale} href={studioHref} className={`mt-8 ${primary}`}>{c.create}</LocalizedStudioLink></section>
      <SiteFooter />
    </div>
  </main>;
}
