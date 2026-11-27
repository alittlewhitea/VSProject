import { mediaFormats, type StudioMediaExtension, type StudioMediaKind } from "../../lib/studio-media";

export async function uploadStudioMedia(file: Blob, kind: StudioMediaKind, token: string, signal?: AbortSignal) {
  async function uploadRequest(data: object) {
    const response = await fetch("/api/media", {
      method: "POST", signal, credentials: "same-origin",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    const payload = await response.json();
    if (payload.code === "cloud_media_disabled") return null;
    if (!response.ok) throw new Error(payload.error || "Upload failed. Please try again.");
    return payload;
  }

  const extension = file instanceof File ? file.name.split(".").at(-1)?.toLowerCase() : undefined;
  const knownExtension = extension === "m4v" ? "mp4" : extension === "jpeg" ? "jpg" : extension;
  const type = file.type && file.type !== "application/octet-stream" ? file.type :
    knownExtension && Object.hasOwn(mediaFormats, knownExtension) ? mediaFormats[knownExtension as StudioMediaExtension].type : "";
  const upload = await uploadRequest({ action: "start", kind, type, size: file.size });
  if (!upload) return null;
  const result = await fetch(upload.uploadUrl, {
    method: "PUT", signal, credentials: "omit", headers: { "Content-Type": upload.contentType }, body: file
  });
  const etag = result.headers.get("ETag");
  if (!result.ok || !etag) throw new Error("Upload failed. Please try again.");
  const media = await uploadRequest({ action: "complete", id: upload.id, etag });
  if (typeof media?.url !== "string") throw new Error("Upload could not be verified. Please try again.");
  return media.url as string;
}

function dataUrlToBlob(value: string): Blob {
  const comma = value.indexOf(",");
  if (comma === -1) throw new Error("Upload failed. Please try again.");
  const header = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  const mime = header.replace(/;base64$/i, "").split(";")[0]?.trim() || "application/octet-stream";
  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function uploadStudioDataUrl(value: string, kind: StudioMediaKind, token: string, signal?: AbortSignal) {
  if (!value.startsWith(`data:${kind}/`)) return value;
  const file = dataUrlToBlob(value);
  return await uploadStudioMedia(file, kind, token, signal) ?? value;
}
