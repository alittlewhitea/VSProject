import { createLocalizedMetadata } from "../../../lib/i18n-metadata";

export function generateMetadata({ params }: { params: { locale: string } }) {
  return createLocalizedMetadata(params.locale, "auth");
}

export { default } from "../../auth/page";
