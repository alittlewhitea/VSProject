import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "../i18n/routing";
import { LEGAL_DOCUMENTS } from "../lib/legal";

export async function SiteFooter() {
  const requestLocale = (await headers()).get("x-dreamface-locale");
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const t = await getTranslations({ locale });

  return (
    <footer className="mt-16 rounded-3xl bg-gradient-to-br from-[#dff3fa] via-[#e8f8ff] to-[#efeefe] px-7 py-9">
      <div className="grid gap-7 border-b border-black/10 pb-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.25fr_0.75fr_1.2fr_0.8fr_1.1fr]">
        <div>
          <img
            src="/icons/icon-512x512.png"
            alt={t("footer.brand")}
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-cover shadow-[0_10px_24px_rgba(16,130,101,0.16)]"
          />
          <p className="mt-2 text-sm text-[#506170]">{t("footer.description")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://www.youtube.com/@DreamfaceLTD"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-black/10 bg-white/45 px-3 py-1 text-xs font-medium text-[#4f5a67] transition hover:border-black/20 hover:bg-white/70 hover:text-[#1d1d1f]"
            >
              YouTube
            </a>
            <a
              href="https://www.linkedin.com/company/dreamface/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-black/10 bg-white/45 px-3 py-1 text-xs font-medium text-[#4f5a67] transition hover:border-black/20 hover:bg-white/70 hover:text-[#1d1d1f]"
            >
              LinkedIn
            </a>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Video</p>
          <Link href="/video/gemini-omni" className="mt-2 block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">Gemini Omni</Link>
          <Link href="/video/seedance-2" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">Seedance 2.0</Link>
        </div>
        <div>
          <Link href="/compare" className="block text-sm font-semibold hover:text-[#1d1d1f]">Compare</Link>
          <Link href="/compare/dreamface-vs-higgsfield" className="mt-2 block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">DreamFace vs Higgsfield</Link>
          <Link href="/compare/dreamface-vs-runway" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">DreamFace vs Runway</Link>
          <Link href="/compare/dreamface-vs-kling-ai" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">DreamFace vs Kling AI</Link>
          <Link href="/compare/dreamface-vs-pika" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">DreamFace vs Pika</Link>
          <Link href="/compare/dreamface-vs-artlist" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">DreamFace vs Artlist</Link>
          <Link href="/compare/dreamface-vs-heygen" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">DreamFace vs HeyGen</Link>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.company")}</p>
          <Link href="/about" className="mt-2 block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">{t("footer.about")}</Link>
          <p className="text-sm text-[#4f5a67]">{t("footer.documentation")}</p>
          <Link href="/about#contact" className="block text-sm text-[#4f5a67] hover:text-[#1d1d1f]">{t("footer.contact")}</Link>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.licenseTerms")}</p>
          <div className="mt-2 grid gap-1">
            {LEGAL_DOCUMENTS.map((document) => (
              <Link key={document.slug} href={`/legal/${document.slug}`} className="text-sm text-[#4f5a67] hover:text-[#1d1d1f]">
                {t(`footer.legal.${document.slug}`)}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <p className="pt-5 text-xs text-[#667180]">{t("footer.copyright")}</p>
    </footer>
  );
}
