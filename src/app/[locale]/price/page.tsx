import { createLocalizedMetadata } from "../../../lib/i18n-metadata";

export function generateMetadata({ params }: { params: { locale: string } }) {
  return createLocalizedMetadata(params.locale, "price");
}

export { default } from "../../price/page";
