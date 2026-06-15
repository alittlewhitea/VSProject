import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { loadMessages } from "../../i18n/messages";
import { isLocale, locales } from "../../i18n/routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
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
