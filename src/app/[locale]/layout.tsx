import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale, locales, type Locale } from "../../i18n/routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function loadMessages(locale: Locale) {
  return (await import(`../../../messages/${locale}.json`)).default;
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={params.locale} messages={await loadMessages(params.locale)}>
      {children}
    </NextIntlClientProvider>
  );
}
