"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HEYGEN_REFERENCE_IMAGE_LIMIT, HEYGEN_REFERENCE_VIDEO_LIMIT, HEYGEN_REFERENCE_AUDIO_LIMIT, heygenReferenceMediaUrls, heygenReferenceValidationKey } from "../../lib/heygen-reference-video";
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

export function StudioVideoReferencePanel({ compact = false, videoUrl, images, audioUrls = "", onAudioUrlsChange, translate: t, onVideoUrlChange, onFiles, onRemove, onFileError }: {
  compact?: boolean; videoUrl: string; images: string[]; translate: Translate; onVideoUrlChange: (url: string) => void;
  audioUrls?: string; onAudioUrlsChange?: (value: string) => void;
  onFiles: (files: FileList | null) => Promise<void>; onRemove: (index: number) => void; onFileError: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);
  const videos = heygenReferenceMediaUrls(videoUrl);
  const audio = heygenReferenceMediaUrls(audioUrls);
  const videoError = heygenReferenceValidationKey(videos, undefined);
  const audioError = heygenReferenceValidationKey(undefined, undefined, audio);
  useEffect(() => setPreviewOpen(null), [videoUrl]);
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
    <h3>{t("studio.heygen.reference.title")}</h3>
    <label htmlFor={`${id}-images`} className={`${styles.label} ${styles.mediaLabel}`}>{t("studio.heygen.reference.images")}<span className={styles.requirement}>{t("studio.heygen.reference.optional")}</span><small>{images.length}/{HEYGEN_REFERENCE_IMAGE_LIMIT}</small></label>
    <p className={styles.hint}>{t("studio.heygen.reference.uploadHint")}</p>
    {images.length ? <div className={styles.images}>{images.map((url, index) => <figure key={`${url}-${index}`} data-reference-subject={index}>
      <img src={url} alt={`${t("studio.reference.image")} ${index + 1}`} />
      <button type="button" disabled={reading} data-remove-reference={index} aria-label={`${t("studio.action.clear")} ${t("studio.reference.image")} ${index + 1}`} onClick={() => onRemove(index)}><StudioIcon name="x" className="h-4 w-4" /></button>
    </figure>)}</div> : null}
    <div className={`${styles.drop} ${dragging ? styles.dragging : ""}`} onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void read(event.dataTransfer.files); }}>
      <button data-upload-reference type="button" disabled={reading || images.length >= HEYGEN_REFERENCE_IMAGE_LIMIT} onClick={() => input.current?.click()}>
        <span aria-hidden="true" className={styles.plus}>＋</span><strong>{t(reading ? "studio.references.reading" : images.length ? "studio.references.addMore" : "studio.references.upload")}</strong>
        <span>{t("studio.references.uploadHint")}</span>
      </button>
      <input id={`${id}-images`} ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={reading || images.length >= HEYGEN_REFERENCE_IMAGE_LIMIT} onChange={event => void read(event.currentTarget.files)} />
    </div>
    <span role="status" aria-live="polite" className="sr-only">{images.length}/{HEYGEN_REFERENCE_IMAGE_LIMIT} · {t("studio.reference.images")}</span>
    <div className={styles.referenceMediaGroup}>
      <label htmlFor={id} className={`${styles.label} ${styles.mediaLabel}`}>{t("studio.heygen.reference.videos")}<span className={styles.requirement}>{t("studio.heygen.reference.optional")}</span><small>{videos.length}/{HEYGEN_REFERENCE_VIDEO_LIMIT}</small></label>
      <div className={`${styles.urlRow} ${styles.mediaUrlRow}`}>
        <textarea id={id} data-reference-video-url rows={2} dir="ltr" maxLength={8192 * HEYGEN_REFERENCE_VIDEO_LIMIT + 2} value={videoUrl} onChange={event => onVideoUrlChange(event.target.value)} placeholder="https://…/video.mp4" aria-invalid={videoError ? true : undefined} aria-describedby={`${id}-source-hint${videoError ? ` ${id}-error` : ""}`} className={`${styles.url} ${styles.mediaUrls}`} />
        <button type="button" data-choose-video-template aria-controls="video-template-gallery" onClick={chooseTemplate} className={styles.chooseTemplate}><StudioIcon name="gallery" className="h-4 w-4 shrink-0" /><span>{t("studio.referenceVideo.chooseTemplate")}</span><span aria-hidden="true">↓</span></button>
      </div>
      <p id={`${id}-source-hint`} className={styles.hint}>{t("studio.heygen.reference.videoHint")}</p>
      {videoError ? <p id={`${id}-error`} role="alert" className={styles.error}>{t(videoError)}</p> : null}
      {!videoError ? videos.map((url, index) => <details key={url + index} className={styles.preview} open={previewOpen === String(index)} onToggle={event => { const open = event.currentTarget.open; setPreviewOpen(current => open ? String(index) : current === String(index) ? null : current); }}>
        <summary>{t("studio.referenceVideo.preview")} {index + 1}</summary>
        {previewOpen === String(index) ? <ReferencePreview url={url} translate={t} /> : null}
      </details>) : null}
    </div>
    <div className={styles.referenceMediaGroup}>
      <label htmlFor={`${id}-audio`} className={`${styles.label} ${styles.mediaLabel}`}>{t("studio.heygen.reference.audio")}<span className={styles.requirement}>{t("studio.heygen.reference.optional")}</span><small>{audio.length}/{HEYGEN_REFERENCE_AUDIO_LIMIT}</small></label>
      <textarea id={`${id}-audio`} data-reference-audio-urls rows={2} dir="ltr" maxLength={8192 * HEYGEN_REFERENCE_AUDIO_LIMIT + 2} value={audioUrls} onChange={event => onAudioUrlsChange?.(event.target.value)} placeholder="https://…/audio.mp3" aria-invalid={audioError ? true : undefined} aria-describedby={`${id}-audio-hint${audioError ? ` ${id}-audio-error` : ""}`} className={`${styles.url} ${styles.mediaUrls}`} />
      <p id={`${id}-audio-hint`} className={styles.hint}>{t("studio.heygen.reference.audioHint")}</p>
      {audioError ? <p id={`${id}-audio-error`} role="alert" className={styles.error}>{t(audioError)}</p> : null}
    </div>
  </section>;
}
