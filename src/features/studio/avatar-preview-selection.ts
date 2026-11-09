export type AvatarPreviewBounds = { key: string; top: number; bottom: number; left: number; right: number };

/** Only substantially visible cards compete for the two central preview slots. */
export function centralAvatarPreviews(cards: AvatarPreviewBounds[], viewport: { top: number; bottom: number; width: number }, preferred?: string | null) {
  const center = (viewport.top + viewport.bottom) / 2;
  const candidates = cards.filter(card => {
    const height = card.bottom - card.top;
    const visible = Math.min(card.bottom, viewport.bottom) - Math.max(card.top, viewport.top);
    return height > 0 && card.right > 0 && card.left < viewport.width && visible >= Math.min(height, viewport.bottom - viewport.top) * .45;
  }).sort((a, b) => Math.abs((a.top + a.bottom) / 2 - center) - Math.abs((b.top + b.bottom) / 2 - center));
  const preferredCard = candidates.find(card => card.key === preferred);
  return (preferredCard ? [preferredCard, ...candidates.filter(card => card !== preferredCard)] : candidates).slice(0, 2).map(card => card.key);
}
