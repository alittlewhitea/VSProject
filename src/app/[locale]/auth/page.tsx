import { createLocalizedMetadata } from "../../../lib/i18n-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return createLocalizedMetadata((await params).locale, "auth");
}

export { default } from "../../auth/page";
