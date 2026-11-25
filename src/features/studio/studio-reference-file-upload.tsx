"use client";

import { useEffect, useRef, useState } from "react";
import { mediaExtension, mediaFormats, mediaUploadLimits, type StudioMediaExtension, type StudioMediaKind } from "../../lib/studio-media";
import { parseReferenceMediaUrls } from "../../lib/seedance-flash";
import { AuthLink } from "../../components/auth-link";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-video-reference-panel.module.css";

export type ReferenceMediaUpload = (file: File, kind: StudioMediaKind, signal?: AbortSignal) => Promise<string>;

function ReferenceMediaPlayer({ kind, url, errorMessage }: { kind: "video" | "audio"; url: string; errorMessage: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = container.current?.querySelector<HTMLMediaElement>("video, audio");
    return () => { if (player) { player.pause(); player.removeAttribute("src"); player.load(); } };
  }, []);
  return <div ref={container} className={styles.mediaPlayer}>
    {failed ? <p role="status" className={styles.hint}>{errorMessage}</p> : kind === "video"
      ? <video src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} />
      : <audio src={url} controls preload="metadata" onError={() => setFailed(true)} />}
  </div>;
}

export function StudioReferenceFileUpload({ id, kind, value, limit, maxBytes = mediaUploadLimits[kind], extensions, hintKey = `studio.referenceMedia.${kind}SizeLimit`, authenticated, translate, onUpload, onChange }: {
  id: string; kind: "video" | "audio"; value: string; limit: number; authenticated: boolean;
  maxBytes?: number; extensions?: readonly StudioMediaExtension[]; hintKey?: string;
  translate: (key: string, values?: Record<string, string | number>) => string;
  onUpload?: ReferenceMediaUpload; onChange: (value: string) => void;
}) {
  const pending = useRef<AbortController | null>(null);
  const latest = useRef({ value, onChange });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const urls = parseReferenceMediaUrls(value);
  const previewUrl = urls.find((url, index) => preview === `${url}-${index}`);
  const uploadHint = translate(hintKey, { size: maxBytes / (1024 * 1024) });
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  useEffect(() => () => pending.current?.abort(), []);

  async function upload(files: FileList) {
    const remaining = limit - parseReferenceMediaUrls(latest.current.value).length;
    const selection = Array.from(files).slice(0, Math.max(0, remaining));
    if (!onUpload || !selection.length || pending.current) return;
    const controller = new AbortController();
    const added: string[] = [];
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      for (const file of selection) {
        if (file.size > maxBytes) throw new Error(uploadHint);
        if (extensions) {
          const extension = mediaExtension(kind, file.type) ?? file.name.split(".").at(-1)?.toLowerCase();
          if (!extensions.some(allowed => allowed === extension)) throw new Error(uploadHint);
        }
        added.push(await onUpload(file, kind, controller.signal));
        if (controller.signal.aborted) return;
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : translate("studio.referenceMedia.unavailable"));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) {
        const current = parseReferenceMediaUrls(latest.current.value);
        if (added.length && current.length < limit) latest.current.onChange([...current, ...added].slice(0, limit).join("\n"));
        setBusy(false);
      }
    }
  }

  const acceptedExtensions = extensions ?? (Object.keys(mediaFormats) as StudioMediaExtension[]).filter(extension => mediaFormats[extension].kind === kind);
  const accept = acceptedExtensions.flatMap(extension => [mediaFormats[extension].type, `.${extension}`]).join(",");
  const label = translate(`studio.referenceMedia.upload.${kind}`);
  return <div className={styles.uploadArea} data-local-reference={kind} aria-busy={busy}>
    {urls.length ? <div className={styles.previews}>{urls.map((url, index) => {
      const key = `${url}-${index}`;
      const tag = `@${kind === "video" ? "Video" : "Audio"}${index + 1}`;
      return <StudioImagePreview key={key} src={url} alt={tag} caption={tag} index={index} disabled={busy}
        removeLabel={`${translate("studio.action.clear")} ${tag}`} onRemove={() => {
          setPreview(null);
          setError("");
          onChange(urls.filter((_, itemIndex) => itemIndex !== index).join("\n"));
        }}>
        <button type="button" className={styles.mediaTile} aria-label={translate("studio.referenceMedia.preview", { reference: tag })}
          aria-expanded={preview === key} aria-controls={preview === key ? `${id}-preview` : undefined}
          onClick={() => setPreview(current => current === key ? null : key)}>
          <StudioIcon name={kind} />
        </button>
      </StudioImagePreview>;
    })}</div> : null}
    {previewUrl ? <div key={preview} id={`${id}-preview`}>
      <ReferenceMediaPlayer kind={kind} url={previewUrl} errorMessage={translate("studio.referenceMedia.previewError")} />
    </div> : null}
    <StudioImageUpload compact={urls.length > 0} disabled={busy || !onUpload || urls.length >= limit}
      label={busy ? translate("studio.referenceMedia.uploading") : label}
      hint={uploadHint}
      inputProps={{ id, accept, multiple: limit > 1, "aria-label": label, "data-reference-file": kind }}
      onFiles={upload} />
    {!authenticated ? <AuthLink href="/auth" className={styles.templateLink}>{translate("studio.referenceMedia.signIn")}</AuthLink> :
      !onUpload ? <p role="status" className={styles.hint}>{translate("studio.referenceMedia.unavailable")}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  </div>;
}
