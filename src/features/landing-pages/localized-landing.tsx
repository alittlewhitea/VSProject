import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../components/site-footer";
import { TopNav } from "../../components/top-nav";
import { LocalizedStudioLink } from "./localized-studio-link";
import { absoluteUrl, siteUrl } from "../../lib/site-url";
import { getLandingData, landingPath, type LandingKind, type LandingLocale } from "./localized-data";

export function supportedLandingLocale(locale:string): locale is LandingLocale { return locale === "es" || locale === "pt-BR"; }
export function landingAlternates(kind:LandingKind) {
  const base=siteUrl(), path=landingPath(kind);
  return { en:absoluteUrl(base,path), es:absoluteUrl(base,`/es${path}`), "pt-BR":absoluteUrl(base,`/pt-BR${path}`), "x-default":absoluteUrl(base,path) };
}
export function landingMetadata(locale:string,kind:LandingKind):Metadata {
  if (!supportedLandingLocale(locale)) return {};
  const content=getLandingData(locale,kind), url=absoluteUrl(siteUrl(),`/${locale}${landingPath(kind)}`);
  return { title:{absolute:content.title}, description:content.description, robots:{index:true,follow:true}, alternates:{canonical:url,languages:landingAlternates(kind)}, openGraph:{type:"website",url,title:content.title,description:content.description,siteName:"DreamFace",locale:locale==="es"?"es_ES":"pt_BR"}, twitter:{card:"summary",title:content.title,description:content.description} };
}
export function LandingLanguages({kind}:{kind:LandingKind}) {
  const path=landingPath(kind);
  return <nav aria-label="Language" className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-[#6548d0]"><Link href={path} hrefLang="en">English</Link><Link href={`/es${path}`} hrefLang="es">Español</Link><Link href={`/pt-BR${path}`} hrefLang="pt-BR">Português (Brasil)</Link></nav>;
}
export function LocalizedLanding({locale,kind}:{locale:string;kind:LandingKind}) {
  if(!supportedLandingLocale(locale)) notFound();
  const c=getLandingData(locale,kind), path=landingPath(kind);
  const studioHref=kind==="text-image"?"/studio?mode=image&workflow=text-to-image":"/studio?mode=video&workflow=image-to-video";
  const schema=[{"@context":"https://schema.org","@type":"WebPage",name:c.title,description:c.description,url:absoluteUrl(siteUrl(),`/${locale}${path}`),inLanguage:locale},{"@context":"https://schema.org","@type":"FAQPage",mainEntity:c.faqs.map(([question,answer])=>({"@type":"Question",name:question,acceptedAnswer:{"@type":"Answer",text:answer}}))}];
  const faqTitle=locale==="es"?"Preguntas frecuentes":"Perguntas frequentes";
  const help=locale==="es"?"Ayuda y consejos":"Ajuda e dicas";
  const credits=locale==="es"?"Paquetes de créditos de pago único, sin renovación automática. Los créditos de prueba dependen de los requisitos de registro.":"Pacotes de créditos de compra única, sem renovação automática. Os créditos de teste dependem da elegibilidade no cadastro.";
  return <main className="min-h-screen bg-[#f8faff] text-[#1f2430]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}} />
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <TopNav />
      <LandingLanguages kind={kind} />
      <section className="py-16 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7554df]">{c.eyebrow}</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">{c.heading}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#596579]">{c.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3"><LocalizedStudioLink locale={locale} href={studioHref} className="rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white">{c.cta}</LocalizedStudioLink><Link href={`/${locale}/price`} className="rounded-xl border border-[#ddd6f5] bg-white px-6 py-4 text-sm font-bold text-[#5542a4]">{c.price}</Link></div>
        <p className="mt-4 text-sm text-[#667084]">{c.notice}</p>
      </section>
      <section className="border-t border-[#e8e6f0] py-14"><h2 className="text-3xl font-black">{c.how}</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{c.steps.map(([name,detail],i)=><div key={name} className="rounded-2xl border border-[#e8e6f0] bg-white p-6"><p className="text-sm font-black text-[#7554df]">0{i+1}</p><h3 className="mt-3 text-xl font-bold">{name}</h3><p className="mt-3 text-sm leading-7 text-[#596579]">{detail}</p></div>)}</div></section>
      <section className="grid gap-8 border-t border-[#e8e6f0] py-14 md:grid-cols-2"><div><h2 className="text-3xl font-black">{c.ideasTitle}</h2><p className="mt-4 leading-8 text-[#596579]">{c.ideas}</p><p className="mt-4 text-sm leading-7 text-[#596579]">{c.example}</p></div><div className="rounded-2xl bg-[#f0edff] p-7"><h2 className="text-2xl font-black">{c.pricingTitle}</h2><p className="mt-4 text-sm leading-7 text-[#596579]">{c.pricing}</p><p className="mt-4 text-sm leading-7 text-[#596579]">{credits}</p><Link href={`/${locale}/price`} className="mt-4 inline-block text-sm font-bold text-[#6548d0] underline">{c.price}</Link></div></section>
      <section className="border-t border-[#e8e6f0] py-14"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">{help}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">{faqTitle}</h2><p className="mt-4 max-w-4xl text-base leading-8 text-[#586579]">{c.faqIntro}</p><div className="mt-7 grid gap-3 lg:grid-cols-2">{c.faqs.map(([question,answer],i)=><article key={question} className={`card motion-smooth lift-soft h-full rounded-2xl p-6 ${i%3===0?"tone-blue":i%3===1?"tone-peach":"tone-mint"}`}><h3 className="text-lg font-semibold tracking-tight">{question}</h3><p className="mt-2 text-sm leading-7 text-[#606676]">{answer}</p></article>)}</div><LocalizedStudioLink locale={locale} href={studioHref} className="mt-8 inline-block rounded-xl bg-[#7554df] px-6 py-4 text-sm font-bold text-white">{c.cta}</LocalizedStudioLink></section>
      <SiteFooter />
    </div>
  </main>;
}
