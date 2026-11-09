"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { requestGoogleSignIn, requestSignIn, type SignInRequest } from "../lib/auth-navigation";

/** Keep normal link behavior for new tabs and as a no-JavaScript fallback. */
export function AuthLink({ onClick, authOptions, provider, ...props }: ComponentProps<typeof Link> & { authOptions?: SignInRequest; provider?: "google" }) {
  return <Link {...props} prefetch={false} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      (props.target && props.target !== "_self") || props.download) return;
    event.preventDefault();
    const url = new URL(String(props.href), window.location.origin);
    const open = provider === "google" ? requestGoogleSignIn : requestSignIn;
    open({ referral: url.searchParams.get("referral"), ...authOptions });
  }} />;
}
