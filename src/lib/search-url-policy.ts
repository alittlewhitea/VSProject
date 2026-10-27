export type SearchParameters = Record<string, string | string[] | undefined>;

// Only discard parameters known to describe attribution, not page content or
// workbench state. Unknown keys remain uncanonicalized until traffic is audited.
export function hasOnlyTrackingParameters(params: SearchParameters) {
  return Object.keys(params).every((key) => /^utm_/i.test(key) || ["gclid", "dclid", "fbclid", "msclkid", "gbraid", "wbraid"].includes(key.toLowerCase()));
}

export function isPrivateStudioView(params: SearchParameters) {
  const views = Array.isArray(params.view) ? params.view : [params.view];
  return views.some((view) => view === "projects" || view === "referrals") || params.taskId !== undefined;
}
