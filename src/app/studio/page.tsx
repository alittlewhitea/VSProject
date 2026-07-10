import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieKey } from "../../i18n/routing";
import { StudioPageClient } from "./studio-client";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const cookieLocale = (await cookies()).get(localeCookieKey)?.value;
  return <StudioPageClient initialLocale={isLocale(cookieLocale) ? cookieLocale : defaultLocale} />;
}
