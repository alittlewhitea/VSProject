"use client";

import { useEffect, useRef, useState } from "react";
import { mediaFormats, type StudioMediaKind } from "../../lib/studio-media";
import { parseReferenceMediaUrls } from "../../lib/seedance-flash";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-video-reference-panel.module.css";

export type ReferenceMediaUpload = (file: File, kind: StudioMediaKind, signal?: AbortSignal) => Promise<string>;

export function StudioReferenceFileUpload({ kind, value, limit, label, translate, onUpload, onChange }: {
  kind: "video" | "audio"; value: string; limit: number; label: string; translate: (key: string) => string;
  onUpload: ReferenceMediaUpload; onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const latest = useRef({ value, onChange });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  useEffect(() => () => pending.current?.abort(), []);

  async function upload(file: File | undefined) {
    if (!file || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const url = await onUpload(file, kind, controller.signal);
      if (controller.signal.aborted) return;
      const urls = parseReferenceMediaUrls(latest.current.value);
      if (urls.length < limit) latest.current.onChange([...urls, url].join("\n"));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Upload failed. Please try again.");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const types = Object.values(mediaFormats).filter(format => format.kind === kind).map(format => format.type).join(",");
  return <div className={styles.referenceUploadAction}>
    <button type="button" className={styles.fileUploadButton} aria-label={label} aria-busy={busy}
      disabled={busy || parseReferenceMediaUrls(value).length >= limit} onClick={() => input.current?.click()}>
      <StudioIcon name="upload" className="h-4 w-4 shrink-0" />
      <span>{translate(busy ? "studio.status.submitting" : "studio.action.choose")}</span>
    </button>
    <input type="file" ref={input} accept={types} hidden onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      void upload(file);
    }} />
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  </div>;
}
