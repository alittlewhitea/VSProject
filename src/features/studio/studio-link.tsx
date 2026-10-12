"use client";

import NextLink from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { navigateStudio, studioNavigationTarget } from "../../lib/studio-navigation";

/** Normal link semantics, with immediate navigation inside an open workspace. */
export default function StudioLink({ href, onClick, prefetch, scroll, ...props }: ComponentProps<typeof NextLink>) {
  const studioHref = typeof href === "string" && /^\/studio(?:\?|$)/.test(href);
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      (props.target && props.target !== "_self") || (props.download !== undefined && props.download !== false) || props.onNavigate || typeof href !== "string") return;
    if (!studioNavigationTarget(href, window.location.href)) return;
    if (navigateStudio(href, { scroll })) event.preventDefault();
  }
  return <NextLink {...props} href={href} scroll={scroll} prefetch={studioHref ? false : prefetch} onClick={handleClick} />;
}
