"use client";

import type { Locale } from "../../i18n/routing";
import { StudioTemplateGallery } from "./studio-template-gallery";

export default function StudioCombinedTemplateGallery(props: { locale?: Locale; translate: (key: string) => string }) {
  return <StudioTemplateGallery kind="combined" {...props} />;
}
