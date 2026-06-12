import { createLocalizedMetadata } from "../../../lib/i18n-metadata";

export function generateMetadata({ params }: { params: { locale: string } }) {
  return createLocalizedMetadata(params.locale, "billing");
}

export { default } from "../../billing/page";
