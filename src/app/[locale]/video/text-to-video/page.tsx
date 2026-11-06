import { TextVideoPage, textVideoMetadata } from "../../../../features/landing-pages/text-video-page";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) { return textVideoMetadata((await params).locale); }
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (locale !== "es" && locale !== "pt-BR") notFound();
  return <TextVideoPage locale={locale} />;
}
