import { createHash, randomUUID } from "node:crypto";
import {
  CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mediaExtension, mediaFormats, mediaUploadLimits, studioMediaIdPattern, studioMediaPath, type StudioMediaExtension, type StudioMediaKind } from "./studio-media";
import { siteUrl } from "./site-url";

const uploadExpirySeconds = 900;
type MediaAsset = { id: string; size: number; extension: StudioMediaExtension };
let r2Storage: { client: S3Client; bucket: string } | undefined;

export class StudioMediaError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function configuration() {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  return account && /^[a-f\d]{32}$/i.test(account) && bucket && accessKeyId && secretAccessKey
    ? { account, bucket, accessKeyId, secretAccessKey } : null;
}

export function r2MediaEnabled() {
  return configuration() !== null;
}

function storage() {
  const config = configuration();
  if (!config) throw new StudioMediaError("Cloud storage is unavailable.", 503);
  return r2Storage ??= {
    client: new S3Client({
      region: "auto", endpoint: `https://${config.account}.r2.cloudflarestorage.com`, forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED"
    }),
    bucket: config.bucket
  };
}

function asset(id: string, finalized: boolean): MediaAsset {
  const match = studioMediaIdPattern.exec(id);
  if (match && Boolean(match[3]) === finalized && Object.hasOwn(mediaFormats, match[4])) {
    const extension = match[4] as StudioMediaExtension;
    const size = Number(match[2]);
    if (size <= mediaUploadLimits[mediaFormats[extension].kind]) return { id, size, extension };
  }
  throw new StudioMediaError("Invalid media reference.", 400);
}

function objectKey(userId: string, mediaId: string, pending = false) {
  const owner = createHash("sha256").update(userId).digest("hex");
  return `${pending ? "pending" : "media"}/${owner}/${mediaId}`;
}

export function studioMediaUrl(id: string) {
  return `${siteUrl()}${studioMediaPath}${id}`;
}

export function ownStudioMediaId(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(siteUrl()).origin || !url.pathname.startsWith(studioMediaPath)) return null;
    if (url.search || url.hash || url.username || url.password) throw new StudioMediaError("Invalid media reference.", 400);
    return asset(url.pathname.slice(studioMediaPath.length), true).id;
  } catch (error) {
    if (error instanceof StudioMediaError) throw error;
    return null;
  }
}

export async function beginStudioMediaUpload(userId: string, kind: StudioMediaKind, type: string, size: number) {
  const extension = mediaExtension(kind, type);
  if (!extension || !Number.isSafeInteger(size) || size <= 0 || size > mediaUploadLimits[kind]) {
    throw new StudioMediaError("Choose a supported file within the upload size limit.", 400);
  }
  const { client, bucket } = storage();
  const id = `${randomUUID()}-${size}.${extension}`;
  const contentType = mediaFormats[extension].type;
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket, Key: objectKey(userId, id, true), ContentType: contentType, ContentLength: size
  }), {
    expiresIn: uploadExpirySeconds,
    signableHeaders: new Set(["content-type", "content-length"])
  });
  return { id, uploadUrl, contentType };
}

function isMissing(error: unknown) {
  return typeof error === "object" && error !== null &&
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404;
}

export async function finishStudioMediaUpload(userId: string, uploadId: string, etag: string) {
  const upload = asset(uploadId, false);
  if (!/^"[a-f\d]{32}"$/i.test(etag)) throw new StudioMediaError("Missing upload verification. Try uploading again.", 400);
  const hash = createHash("sha256").update(etag).digest("hex").slice(0, 32);
  const id = upload.id.replace(".", `-${hash}.`);
  const { client, bucket } = storage();
  const key = objectKey(userId, id);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return studioMediaUrl(id);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  const pendingKey = objectKey(userId, upload.id, true);
  try {
    const metadata = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: pendingKey }));
    if (metadata.ETag !== etag || metadata.ContentType !== mediaFormats[upload.extension].type || metadata.ContentLength !== upload.size) {
      throw new StudioMediaError("The uploaded file does not match the request. Try uploading again.", 400);
    }
    await client.send(new CopyObjectCommand({
      Bucket: bucket, Key: key, CopySource: `${bucket}/${pendingKey}`, CopySourceIfMatch: etag
    }));
  } catch (error) {
    if (isMissing(error)) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return studioMediaUrl(id);
      } catch (checkError) {
        if (!isMissing(checkError)) throw checkError;
      }
      throw new StudioMediaError("Upload could not be found. Try uploading again.", 404);
    }
    throw error;
  }
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pendingKey })).catch(() => null);
  return studioMediaUrl(id);
}

export async function signStudioMediaRead(userId: string, id: string, expiresIn: number, kind?: StudioMediaKind) {
  const media = asset(id, true);
  if (kind && mediaFormats[media.extension].kind !== kind) throw new StudioMediaError("Use the correct file type for this reference.", 400);
  const { client, bucket } = storage();
  const key = objectKey(userId, media.id);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isMissing(error)) throw new StudioMediaError("Media not found.", 404);
    throw new StudioMediaError("Media storage is temporarily unavailable. Please try again.", 503);
  }
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket, Key: key, ResponseCacheControl: "private, no-store"
  }), { expiresIn });
}

export function signGenerationMedia(userId: string, value: string, kind: StudioMediaKind) {
  if (typeof value !== "string") return value;
  const id = ownStudioMediaId(value);
  return id ? signStudioMediaRead(userId, id, 86400, kind) : value;
}

export async function readStudioVideo(userId: string, id: string) {
  const media = asset(id, true);
  if (mediaFormats[media.extension].kind !== "video") throw new StudioMediaError("Upload a video file.", 400);
  const { client, bucket } = storage();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(userId, id) }), {
      abortSignal: AbortSignal.timeout(45_000)
    });
    if (!object.Body || object.ContentLength !== media.size) throw new StudioMediaError("Video could not be read.", 400);
    return object.Body as AsyncIterable<Uint8Array>;
  } catch (error) {
    if (error instanceof StudioMediaError) throw error;
    if (isMissing(error)) throw new StudioMediaError("Media not found.", 404);
    throw new StudioMediaError("Media storage is temporarily unavailable.", 503);
  }
}

export async function saveStudioWav(userId: string, wav: Buffer, digest: string) {
  const { client, bucket } = storage();
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}-${wav.length}-${digest.slice(32)}.wav`;
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: objectKey(userId, id), ContentType: "audio/wav", Body: wav
  }));
  return studioMediaUrl(id);
}
