import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { HomeHeroCarousel } from "../components/home-hero-carousel";
import { PageAnalytics } from "../components/page-analytics";
import { Reveal } from "../components/reveal";
import { SiteFooter } from "../components/site-footer";
import { TopNav } from "../components/top-nav";
import { AppButton } from "../components/ui/button";
import { defaultLocale, isLocale } from "../i18n/routing";
import { CREDIT_PACKS, formatUsd } from "../lib/billing";
import { galleryItemPath, mapGalleryRow } from "../lib/gallery";
import { fetchPublishedGalleryItems } from "../lib/gallery-server";

const homeFaqKeys = [
  "whatIsDreamFace",
  "videoGenerators",
  "bestVideoGenerator",
  "availableTools",
  "textImageSupport",
  "videoSupport",
  "videoInputs",
  "referenceImage",
  "videoOfMyself",
  "socialMedia",
  "models",
  "videoTiming",
  "noEditing",
  "costBeforeCreate",
  "freeTrial",
  "failedTask",
  "promptGallery",
  "audioSupport",
  "replaceProduction",
  "securityEthics",
  "commercialUse"
];

export default async function HomePage() {
  const requestLocale = headers().get("x-dreamface-locale");
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const t = await getTranslations({ locale });
  const galleryItems = await fetchPublishedGalleryItems({ limit: 8, featuredFirst: true })
    .then((rows) => rows.map(mapGalleryRow))
    .catch(() => []);
  const plans = [
    {
      name: t("home.pricing.trial.name"),
      price: t("home.pricing.trial.price"),
      note: t("home.pricing.trial.note"),
      credits: t("home.pricing.trial.credits"),
      href: "/studio?mode=image&workflow=text-to-image"
    },
    ...CREDIT_PACKS.map((pack) => ({
      name: t(`pricing.creditPack.${pack.id === "pro-topup" ? "proTopup" : pack.id}.name`),
      price: formatUsd(pack.amountCents),
      note: pack.id === "studio" ? t("home.pricing.bestValue") : t("home.pricing.topUpWhenNeeded"),
      credits: `${pack.credits.toLocaleString()} ${t("pricing.credits")} - ${t(`pricing.creditPack.${pack.id === "pro-topup" ? "proTopup" : pack.id}.idealFor`)}`,
      href: "/billing"
    }))
  ];
  const faqs = homeFaqKeys.map((key) => ({
    q: t(`home.faq.${key}.question`),
    a: t(`home.faq.${key}.answer`)
  }));
  const homeFaqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a
      }
    }))
  };

  return (
    <main className="bg-grid pb-16">
      <PageAnalytics eventName="home_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
      />
      <div className="mx-auto max-w-[1540px] px-3 pt-3 sm:px-4 sm:pt-4 md:px-8 md:pt-5">
        <TopNav />

        <Reveal>
          <HomeHeroCarousel />
        </Reveal>

        {galleryItems.length ? (
          <Reveal>
            <section className="section-shell mt-14 border-t border-black/10 pt-14 md:mt-24 md:pt-24">
              <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">{t("home.gallery.eyebrow")}</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#171719] sm:text-4xl md:text-5xl">
                    {t("home.gallery.title")}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374] sm:text-base">
                    {t("home.gallery.description")}
                  </p>
                </div>
                <Link
                  href="/gallery"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-black tracking-[-0.02em] text-white shadow-[0_14px_30px_rgba(13,18,35,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#343438]"
                >
                  {t("home.gallery.cta")} <span className="ml-2">-&gt;</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {galleryItems.map((item) => (
                  <Link
                    key={item.id}
                    href={galleryItemPath(item)}
                    className="card group overflow-hidden rounded-2xl bg-white"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-[#eef2f7]">
                      <img
                        src={item.thumbnailUrl || item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate rounded-full border border-black/10 bg-[#f8fbff] px-2.5 py-1 text-[10px] font-semibold text-[#4c5a70] sm:text-[11px]">
                          {item.category}
                        </span>
                        <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#8792a5] sm:inline">
                          {item.model}
                        </span>
                      </div>
                      <h3 className="mt-3 line-clamp-1 text-sm font-semibold tracking-tight text-[#1d1d1f] sm:text-base">
                        {item.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#687386]">{item.prompt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>
        ) : null}

        <Reveal>
          <section id="platform" className="section-shell mt-14 border-t border-black/10 pt-14 md:mt-24 md:pt-24">
            <div className="mx-auto max-w-5xl text-center">
              <h2 className="text-[clamp(2.55rem,12vw,4.8rem)] font-black leading-[0.96] tracking-[-0.055em] text-[#171719] md:text-[clamp(3rem,5.7vw,6.8rem)]">
                {t("home.platform.titleLine1")}
                <span className="block">{t("home.platform.titleLine2")}</span>
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-7 text-[#5c5f66] sm:text-lg md:mt-8 md:text-xl md:leading-8">
                {t("home.platform.description")}
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-[1260px] grid-cols-2 gap-3 sm:mt-16 sm:gap-5 lg:mt-24 lg:grid-cols-5">
              {[
                { title: t("home.platform.card.textToVideo"), href: "/studio?mode=video&workflow=text-to-video" },
                { title: t("home.platform.card.photoToVideo"), href: "/studio?mode=video&workflow=image-to-video" },
                { title: t("home.platform.card.productAds"), href: "/studio?mode=image&workflow=text-to-image" },
                { title: t("home.platform.card.ugcAds"), href: "/studio?mode=video&workflow=text-to-video" },
                { title: t("home.platform.card.aiModels"), href: "/studio?view=home" }
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex min-h-[112px] flex-col items-center justify-center rounded-[1.25rem] bg-[#f1f1f1] px-4 py-5 text-center transition duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-[0_22px_55px_rgba(18,22,33,0.1)] sm:min-h-[138px] sm:rounded-[1.7rem] sm:px-5 sm:py-7"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="mb-4 h-6 w-6 text-[#121214]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
                    <path d="m7 3 1.4 2.5M12 3l1.4 2.5M17 3l1.4 2.5" />
                  </svg>
                  <span className="text-base font-black tracking-[-0.04em] text-[#171719] sm:text-xl">{item.title}</span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-shell mt-16 border-t border-black/10 pt-16 md:mt-28 md:pt-28">
            <div className="grid items-center gap-9 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 text-xl font-black tracking-[-0.04em] text-[#11bff3] sm:text-2xl">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
                    <path d="m7 3 1.4 2.5M12 3l1.4 2.5M17 3l1.4 2.5" />
                  </svg>
                  {t("home.textToVideo.eyebrow")}
                </p>
                <h3 className="mt-4 text-[clamp(2.35rem,10vw,3.8rem)] font-black leading-[1.02] tracking-[-0.055em] text-[#141416] md:text-[clamp(2.3rem,3.7vw,4.6rem)]">
                  {t("home.textToVideo.title")}
                </h3>
                <p className="mt-5 text-base font-medium leading-7 text-[#292d35] sm:text-lg sm:leading-8 md:text-xl md:leading-9">
                  {t("home.textToVideo.description")}
                </p>
                <Link
                  href="/studio?mode=video&workflow=text-to-video"
                  className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#10bff3] px-6 py-4 text-base font-black tracking-[-0.04em] text-[#071116] shadow-[0_18px_36px_rgba(16,191,243,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#00afe6] sm:w-auto sm:text-xl md:mt-10"
                >
                  {t("home.textToVideo.cta")} <span className="ml-3">-&gt;</span>
                </Link>
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-[1.4rem] bg-white shadow-[0_22px_55px_rgba(16,27,48,0.14)] sm:rounded-[2rem] sm:shadow-[0_28px_80px_rgba(16,27,48,0.16)]">
                  <video
                    src="https://media.dreamface.io/videos/Text_to_Video.webm"
                    className="aspect-[16/9] w-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-shell mt-16 border-t border-black/10 pt-16 md:mt-28 md:pt-28">
            <div className="grid items-center gap-9 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 text-xl font-black tracking-[-0.04em] text-[#11bff3] sm:text-2xl">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
                    <path d="m7 3 1.4 2.5M12 3l1.4 2.5M17 3l1.4 2.5" />
                  </svg>
                  {t("home.photoToVideo.eyebrow")}
                </p>
                <h3 className="mt-4 text-[clamp(2.35rem,10vw,3.8rem)] font-black leading-[1.02] tracking-[-0.055em] text-[#141416] md:text-[clamp(2.3rem,3.7vw,4.6rem)]">
                  {t("home.photoToVideo.title")}
                </h3>
                <p className="mt-5 text-base font-medium leading-7 text-[#292d35] sm:text-lg sm:leading-8 md:text-xl md:leading-9">
                  {t("home.photoToVideo.description")}
                </p>
                <Link
                  href="/studio?mode=video&workflow=image-to-video"
                  className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#10bff3] px-6 py-4 text-base font-black tracking-[-0.04em] text-[#071116] shadow-[0_18px_36px_rgba(16,191,243,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#00afe6] sm:w-auto sm:text-xl md:mt-10"
                >
                  {t("home.photoToVideo.cta")} <span className="ml-3">-&gt;</span>
                </Link>
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-[1.4rem] bg-white shadow-[0_22px_55px_rgba(16,27,48,0.14)] sm:rounded-[2rem] sm:shadow-[0_28px_80px_rgba(16,27,48,0.16)]">
                  <video
                    src="https://media.dreamface.io/videos/Image_to_Video.mp4"
                    className="aspect-[16/9] w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
              </div>
            </div>
          </section>
        </Reveal>
        <section className="section-shell mt-14 md:mt-20" id="pricing">
          <Reveal>
            <div className="mb-6 flex items-end justify-between">
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">{t("home.pricing.title")}</h3>
              <Link href="/price" className="text-sm font-semibold text-[#1d1d1f]">{t("home.pricing.cta")} -&gt;</Link>
            </div>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((p, i) => (
              <Reveal key={p.name} delayMs={i * 60}>
                <article className={`card motion-smooth lift-soft rounded-2xl p-7 ${i === 0 ? "tone-blue" : i === 1 ? "tone-violet" : "tone-pink"}`}>
                  <p className="text-sm text-[#6e6e73]">{p.note}</p>
                  <h4 className="mt-2 text-3xl font-semibold tracking-tight">{p.name}</h4>
                  <p className="mt-4 text-4xl font-semibold tracking-tight">{p.price}</p>
                  <p className="mt-2 text-sm text-[#5a6070]">{p.credits}</p>
                  <div className="mt-6">
                    <AppButton href={p.href} variant="dark" size="md">{t("home.pricing.getCredits")}</AppButton>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section-shell mt-14 md:mt-20">
          <Reveal>
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#637084]">{t("home.faq.eyebrow")}</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">{t("home.faq.title")}</h3>
              <p className="mt-4 text-base leading-8 text-[#586579]">
                {t("home.faq.description")}
              </p>
            </div>
          </Reveal>
          <div className="mt-7 grid gap-3 lg:grid-cols-2">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delayMs={i * 60}>
                <article className={`card motion-smooth lift-soft h-full rounded-2xl p-6 ${i % 3 === 0 ? "tone-blue" : i % 3 === 1 ? "tone-peach" : "tone-mint"}`}>
                  <h4 className="text-lg font-semibold tracking-tight">{f.q}</h4>
                  <p className="mt-2 text-sm leading-7 text-[#606676]">{f.a}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-14 md:mt-20">
          <Reveal>
            <div className="card hero-sheen relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f3f7ff] via-white to-[#f5f0ff] px-7 py-10 text-center md:px-12">
              <div className="orb -left-8 bottom-2 h-24 w-24 bg-[#ffd5b6]" />
              <div className="orb right-0 top-0 h-28 w-28 bg-[#c6dbff]" />
              <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">{t("home.finalCta.title")}</h3>
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-[#6e6e73]">
                {t("home.finalCta.description")}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <AppButton href="/studio?mode=image&workflow=text-to-image" variant="primary">{t("home.finalCta.primary")}</AppButton>
                <AppButton href="/about#contact" variant="secondary">{t("home.finalCta.secondary")}</AppButton>
              </div>
            </div>
          </Reveal>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

