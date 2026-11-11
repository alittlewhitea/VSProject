/** Mandatory server policy. H3's documented integration requires a fixed false
 * value; that exception does not grant the browser a safety bypass elsewhere. */
export function applyGenerationSafety<T extends { provider: string; enableSafetyChecker?: boolean; safetyTolerance?: string }>(body: T): T {
  body.enableSafetyChecker = !["minimax-h3-max-video", "minimax-h3-max-turbo-video"].includes(body.provider);
  body.safetyTolerance = "4";
  return body;
}
