/** /studio is one client workspace; query changes do not require server data. */
export function studioNavigationTarget(href: string, currentUrl: string) {
  try {
    const current = new URL(currentUrl);
    const target = new URL(href, current);
    if (current.pathname !== "/studio" || target.pathname !== "/studio" || target.origin !== current.origin || target.hash) return null;
    return `${target.pathname}${target.search}`;
  } catch { return null; }
}

export function navigateStudio(href: string, options: { replace?: boolean; scroll?: boolean } = {}) {
  if (typeof window === "undefined") return false;
  const target = studioNavigationTarget(href, window.location.href);
  if (!target) return false;
  // Next 15 integrates native History with useSearchParams and back/forward.
  // Preserve its router state; do not fabricate a popstate event or fetch RSC.
  if (`${window.location.pathname}${window.location.search}` !== target) {
    if (options.replace) window.history.replaceState(null, "", target);
    else window.history.pushState(null, "", target);
  }
  if (options.scroll !== false) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  return true;
}
