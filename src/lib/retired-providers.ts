// Tombstones reject old bookmarked requests; no provider integration remains.
export const RETIRED_PROVIDERS = ["dreamface-io-video", "mischief-video"] as const;
export const REMOVED_PROVIDER_IDS = ["dreamface-io-video"] as const;
export function hasProviderIntegration(provider: unknown) {
  return typeof provider==="string" && !(REMOVED_PROVIDER_IDS as readonly string[]).includes(provider);
}
export function isRetiredProvider(provider: unknown) {
  return typeof provider === "string" && (RETIRED_PROVIDERS as readonly string[]).includes(provider);
}
