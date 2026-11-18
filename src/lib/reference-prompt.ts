export type ReferenceAsset = {
  token: string;
  kind: "image" | "video" | "audio";
  index: number;
  url: string;
};

export type ReferenceMentionQuery = { start: number; end: number; query: string };

export function referencePromptAssets(images: string[], videos: string[] = [], audio: string[] = []): ReferenceAsset[] {
  return [
    ...images.map((url, index) => ({ token: `@Image${index + 1}`, kind: "image" as const, index: index + 1, url })),
    ...videos.map((url, index) => ({ token: `@Video${index + 1}`, kind: "video" as const, index: index + 1, url })),
    ...audio.map((url, index) => ({ token: `@Audio${index + 1}`, kind: "audio" as const, index: index + 1, url })),
  ];
}

// Complete only the token at a collapsed caret, never an email address or URL.
export function referenceMentionQuery(text: string, start: number, end = start): ReferenceMentionQuery | null {
  if (start !== end) return null;
  const before = text.slice(0, start);
  const match = /@([a-z0-9]*)$/i.exec(before);
  if (!match || (match.index > 0 && /[a-z0-9_@./%+\-]/i.test(before[match.index - 1]))) return null;
  const suffix = /^[a-z0-9]*/i.exec(text.slice(start))![0];
  return { start: match.index, end: start + suffix.length, query: match[1] };
}

export function filterReferenceAssets(assets: ReferenceAsset[], query: string) {
  return assets.filter(asset => asset.token.slice(1).toLowerCase().includes(query.toLowerCase()));
}

export function referencePromptParts(text: string, assets: ReferenceAsset[]) {
  const byToken = new Map(assets.map(asset => [asset.token.toLowerCase(), asset]));
  const parts: { text: string; asset?: ReferenceAsset; missing?: boolean }[] = [];
  let offset = 0;
  for (const match of text.matchAll(/@(Image|Video|Audio)[1-9]\d*(?![a-z0-9_])/gi)) {
    const start = match.index!;
    if (start > 0 && /[a-z0-9_@./%+\-]/i.test(text[start - 1])) continue;
    if (start > offset) parts.push({ text: text.slice(offset, start) });
    const asset = byToken.get(match[0].toLowerCase());
    parts.push({ text: match[0], asset, missing: !asset });
    offset = start + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}

export function insertReferenceToken(text: string, start: number, end: number, token: string) {
  const suffix = text.slice(end);
  const insertion = token + (/^[\s.,!?;:，。！？；：、)\]}]/.test(suffix) ? "" : " ");
  return { value: text.slice(0, start) + insertion + suffix, insertion, caret: start + insertion.length };
}

/** A single in-place URL edit keeps its slot. Reordering or dropping lines follows the original URLs. */
export function remapReferenceUrlsInPrompt(text: string, kind: "video" | "audio", previousUrls: string[], nextUrls: string[]) {
  if (previousUrls.length === nextUrls.length && previousUrls.filter((url, index) => url !== nextUrls[index]).length <= 1) return text;
  const previousAssets = kind === "video" ? referencePromptAssets([], previousUrls) : referencePromptAssets([], [], previousUrls);
  const taken = new Set<number>();
  const indices = previousUrls.map(url => {
    const index = nextUrls.findIndex((nextUrl, position) => nextUrl === url && !taken.has(position));
    if (index !== -1) taken.add(index);
    return index + 1;
  });
  const prefix = kind === "video" ? "@Video" : "@Audio";
  return referencePromptParts(text, previousAssets).map(part => {
    if (!part.asset) return part.text;
    const index = indices[part.asset.index - 1];
    if (index === part.asset.index) return part.text;
    return index ? `${prefix}${index}` : "";
  }).join("");
}

/** Keep surviving mentions attached to the same image when an earlier image is removed. */
export function removeReferenceImageFromPrompt(text: string, removedIndex: number, imageCount: number) {
  return text.replace(/@Image([1-9]\d*)(?![a-z0-9_])/gi, (token: string, number: string, offset: number) => {
    if (offset > 0 && /[a-z0-9_@./%+\-]/i.test(text[offset - 1])) return token;
    const index = Number(number) - 1;
    if (index >= imageCount) return token;
    if (index === removedIndex) return "";
    return index > removedIndex ? `${token.slice(0, 6)}${index}` : token;
  });
}
