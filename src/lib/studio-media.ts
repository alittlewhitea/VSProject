export const mediaFormats = {
  jpg: { kind: "image", type: "image/jpeg" },
  png: { kind: "image", type: "image/png" },
  webp: { kind: "image", type: "image/webp" },
  gif: { kind: "image", type: "image/gif" },
  avif: { kind: "image", type: "image/avif" },
  bmp: { kind: "image", type: "image/bmp" },
  tiff: { kind: "image", type: "image/tiff" },
  heic: { kind: "image", type: "image/heic" },
  heif: { kind: "image", type: "image/heif" },
  mp4: { kind: "video", type: "video/mp4" },
  mov: { kind: "video", type: "video/quicktime" },
  webm: { kind: "video", type: "video/webm" },
  wav: { kind: "audio", type: "audio/wav" },
  mp3: { kind: "audio", type: "audio/mpeg" },
  m4a: { kind: "audio", type: "audio/mp4" },
  aac: { kind: "audio", type: "audio/aac" },
  ogg: { kind: "audio", type: "audio/ogg" },
  flac: { kind: "audio", type: "audio/flac" },
  weba: { kind: "audio", type: "audio/webm" }
} as const;

export type StudioMediaKind = "image" | "video" | "audio";
export type StudioMediaExtension = keyof typeof mediaFormats;
export const mediaUploadLimits: Record<StudioMediaKind, number> = {
  image: 30 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 20 * 1024 * 1024
};

export function mediaExtension(kind: StudioMediaKind, type: string) {
  const normalizedType = ({
    "audio/x-wav": "audio/wav", "audio/wave": "audio/wav",
    "audio/x-m4a": "audio/mp4", "audio/x-flac": "audio/flac",
    "audio/mp3": "audio/mpeg", "application/ogg": "audio/ogg", "video/x-m4v": "video/mp4"
  } as Record<string, string>)[type] ?? type;
  return (Object.keys(mediaFormats) as StudioMediaExtension[]).find(extension => {
    const format = mediaFormats[extension];
    return format.kind === kind && format.type === normalizedType;
  });
}

export const studioMediaPath = "/api/media/";
export const studioMediaIdPattern = /^([a-f0-9-]{36})-([1-9]\d{0,8})(?:-([a-f0-9]{32}))?\.([a-z0-9]{3,4})$/;

export function studioMediaBytes(value: string, kind: StudioMediaKind) {
  try {
    const url = new URL(value);
    if (!url.pathname.startsWith(studioMediaPath)) return 0;
    const asset = studioMediaIdPattern.exec(url.pathname.slice(studioMediaPath.length));
    if (asset?.[3] && Object.hasOwn(mediaFormats, asset[4]) && mediaFormats[asset[4] as StudioMediaExtension].kind === kind) {
      return Number(asset[2]);
    }
  } catch { /* Other reference URLs do not encode the original upload size. */ }
  return 0;
}
