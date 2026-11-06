"use client";

import type { Locale } from "../../i18n/routing";
import { StudioTemplateGallery } from "./studio-template-gallery";

export default function StudioImageTemplateGallery(props: { locale?: Locale; translate: (key: string, values?: Record<string, string | number | null | undefined>) => string }) {
  return <StudioTemplateGallery kind="image" {...props} />;
}
