"use client";
import Link from "next/link";
import { persistLocalePreference, type Locale } from "../../i18n/routing";
import type { ReactNode } from "react";

export function LocalizedStudioLink({locale,href,className,children}:{locale:Locale;href:string;className:string;children:ReactNode}) {
  return <Link href={href} onClick={()=>persistLocalePreference(locale)} className={className}>{children}</Link>;
}
