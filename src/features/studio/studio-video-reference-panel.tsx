"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HEYGEN_REFERENCE_IMAGE_LIMIT, isPublicReferenceUrl } from "../../lib/heygen-reference-video";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-video-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
function ReferencePreview({ url, translate: t }: { url: string; translate: Translate }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = ref.current;
    return () => { if (player) { player.pause(); player.removeAttribute("src"); player.load(); } };
  }, []);
  return failed ? <p role="status" className={styles.hint}>{t("studio.referenceVideo.previewError")}</p> :
    <video ref={ref} src={url} controls playsInline preload="metadata" className={styles.video} onError={() => setFailed(true)} />;
}

export function StudioVideoReferencePanel({ compact = false, videoUrl, images, translate: t, onVideoUrlChange, onFiles, onRemove, onFileError }: {
  compact?: boolean; videoUrl: string; images: string[]; translate: Translate; onVideoUrlChange: (url: string) => void;
  onFiles: (files: FileList | null) => Promise<void>; onRemove: (index: number) => void; onFileError: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const valid = isPublicReferenceUrl(videoUrl);
  useEffect(() => setPreviewOpen(false), [videoUrl]);
  function chooseTemplate() {
    const gallery=document.querySelector<HTMLElement>('[data-studio-video-templates]');
    if(!gallery)return;
    gallery.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    gallery.querySelector<HTMLButtonElement>('[data-template-category][aria-pressed="true"]')?.focus({preventScroll:true});
  }
  async function read(files: FileList | null) {
    if (!files?.length || reading) return;
    setReading(true);
    try { await onFiles(files); } catch { onFileError(); } finally { setReading(false); if (input.current) input.current.value = ""; }
  }
  return <section data-video-reference-panel data-compact={compact || undefined} tabIndex={-1} aria-label={t("studio.referenceVideo.title")} className={styles.panel}>
    <h3>{t("studio.referenceVideo.title")}</h3>
    <p className={styles.hint}>{t("studio.referenceVideo.hint")}</p>
    <label htmlFor={id} className={styles.label}>{t("studio.referenceVideo.url")} <span aria-hidden="true">*</span></label>
    <div className={styles.urlRow}>
      <input id={id} data-reference-video-url type="url" dir="ltr" required maxLength={8192} value={videoUrl} onChange={event => onVideoUrlChange(event.target.value)} placeholder="https://…/video.mp4" aria-invalid={videoUrl.trim() && !valid ? true : undefined} aria-describedby={`${id}-source-hint${videoUrl.trim() && !valid ? ` ${id}-error` : ""}`} className={styles.url} />
      <button type="button" data-choose-video-template aria-controls="video-template-gallery" onClick={chooseTemplate} className={styles.chooseTemplate}><StudioIcon name="gallery" className="h-4 w-4 shrink-0" /><span>{t("studio.referenceVideo.chooseTemplate")}</span><span aria-hidden="true">↓</span></button>
    </div>
    <p id={`${id}-source-hint`} className={styles.hint}>{t("studio.referenceVideo.linkOnlyHint",{action:t("studio.templates.createLike")})}</p>
    {videoUrl.trim() && !valid ? <p id={`${id}-error`} role="alert" className={styles.error}>{t("studio.referenceVideo.invalid")}</p> : null}
    {valid ? <details className={styles.preview} open={previewOpen} onToggle={event => setPreviewOpen(event.currentTarget.open)}>
      <summary>{t("studio.referenceVideo.preview")}</summary>
      {previewOpen ? <ReferencePreview key={videoUrl.trim()} url={videoUrl.trim()} translate={t} /> : null}
    </details> : null}
    <div className={styles.subjectHeading}><h4>{t("studio.referenceVideo.subject")}</h4><span>{t("studio.textImage.optional")}</span></div>
    <p className={styles.hint}>{t("studio.referenceVideo.subjectHint")}</p>
    {images.length ? <div className={styles.images}>{images.map((url, index) => <figure key={`${url}-${index}`} data-reference-subject={index}>
      <img src={url} alt={`${t("studio.reference.image")} ${index + 1}`} />
      <button type="button" disabled={reading} data-remove-reference={index} aria-label={`${t("studio.action.clear")} ${t("studio.reference.image")} ${index + 1}`} onClick={() => onRemove(index)}><StudioIcon name="x" className="h-4 w-4" /></button>
    </figure>)}</div> : null}
    <div className={`${styles.drop} ${dragging ? styles.dragging : ""}`} onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void read(event.dataTransfer.files); }}>
      <button data-upload-reference type="button" disabled={reading || images.length >= HEYGEN_REFERENCE_IMAGE_LIMIT} onClick={() => input.current?.click()}>
        <span aria-hidden="true" className={styles.plus}>＋</span><strong>{t(reading ? "studio.references.reading" : images.length ? "studio.references.addMore" : "studio.references.upload")}</strong>
        <span>{t("studio.references.uploadHint")}</span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={reading || images.length >= HEYGEN_REFERENCE_IMAGE_LIMIT} onChange={event => void read(event.currentTarget.files)} />
    </div>
    <span role="status" aria-live="polite" className={styles.count}>{images.length}/{HEYGEN_REFERENCE_IMAGE_LIMIT} · {t("studio.reference.images")}</span>
  </section>;
}
