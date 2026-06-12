import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "../i18n/routing";
import { LEGAL_DOCUMENTS } from "../lib/legal";

export async function SiteFooter() {
  const requestLocale = headers().get("x-dreamface-locale");
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const t = await getTranslations({ locale });

  return (
    <footer className="mt-16 rounded-3xl bg-gradient-to-br from-[#dff3fa] via-[#e8f8ff] to-[#efeefe] px-7 py-9">
      <div className="grid gap-7 border-b border-black/10 pb-7 md:grid-cols-5">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{t("footer.brand")}</p>
          <p className="mt-2 text-sm text-[#506170]">{t("footer.description")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.platform")}</p>
          <p className="mt-2 text-sm text-[#4f5a67]">{t("footer.imageStudio")}</p>
          <p className="text-sm text-[#4f5a67]">{t("footer.videoStudio")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{t("footer.platform")}</p>
          <p className="mt-2 text-sm text-[#4f5a67]">{t("footer.providerRouting")}</p>
          <p className="text-sm text-[#4f5a67]">{t("footer.creditsBilling")}</p>
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
