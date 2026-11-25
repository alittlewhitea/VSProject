"use client";

import { useState } from "react";
import { HEYGEN_REFERENCE_IMAGE_LIMIT, HEYGEN_REFERENCE_VIDEO_LIMIT, HEYGEN_REFERENCE_AUDIO_LIMIT, heygenReferenceMediaUrls, heygenReferenceValidationKey } from "../../lib/heygen-reference-video";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
import { StudioReferenceFileUpload, type ReferenceMediaUpload } from "./studio-reference-file-upload";
import styles from "./studio-video-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export function StudioVideoReferencePanel({ compact = false, videoUrl, images, photoUploadHint, audioUrls, onAudioUrlsChange, translate: t, onVideoUrlChange, onFiles, onRemove, onFileError, onMediaUpload, authenticated }: {
  compact?: boolean; videoUrl: string; images: string[]; translate: Translate; onVideoUrlChange: (url: string) => void;
  photoUploadHint?: string;
  audioUrls: string; onAudioUrlsChange: (value: string) => void;
  onMediaUpload?: ReferenceMediaUpload;
  authenticated: boolean;
  onFiles: (files: FileList | null) => Promise<void>; onRemove: (index: number) => void; onFileError: () => void;
}) {
  const id = "studio-video-reference";
  const [reading, setReading] = useState(false);
  const videos = heygenReferenceMediaUrls(videoUrl);
  const audio = heygenReferenceMediaUrls(audioUrls);
  const needsVisual = images.length === 0 && videos.length === 0;
  const videoError = heygenReferenceValidationKey(videos, undefined, undefined, { requireVisual: false });
  const audioError = heygenReferenceValidationKey(undefined, undefined, audio, { requireVisual: false });
  const imageHint = t("studio.heygen.reference.uploadHint");
  async function read(files: FileList | null) {
    if (!files?.length || reading) return;
    setReading(true);
    try { await onFiles(files); } catch { onFileError(); } finally { setReading(false); }
  }
  return <section data-video-reference-panel data-compact={compact || undefined} tabIndex={-1} aria-label={t("studio.referenceVideo.title")} className={styles.panel}>
    <h3>{t("studio.heygen.reference.title")}</h3>
    <div className={styles.slotsGrid}>
      <div className={styles.slotCard} data-required-slot={needsVisual || undefined}>
        <label htmlFor={`${id}-images`} className={`${styles.label} ${styles.mediaLabel}`}>{t("studio.heygen.reference.images")}{!photoUploadHint ? <span className={styles.requirement} data-required={needsVisual}>{t(needsVisual ? "studio.heygen.reference.imageOrVideo" : "studio.heygen.reference.optional")}</span> : null}<small>{images.length}/{HEYGEN_REFERENCE_IMAGE_LIMIT}</small></label>
        {images.length ? <div className={styles.previews}>{images.map((url, index) => {
          const name = `${t("studio.reference.image")} ${index + 1}`;
          return <StudioImagePreview key={`${url}-${index}`} src={url} alt={name} caption={`@Image${index + 1}`} index={index} disabled={reading} removeLabel={`${t("studio.action.clear")} ${name}`} onRemove={() => onRemove(index)} />;
        })}</div> : null}
        <div className={styles.uploadArea}>
          <StudioImageUpload compact={images.length > 0} disabled={reading || images.length >= HEYGEN_REFERENCE_IMAGE_LIMIT} onFiles={read}
            inputProps={{ id: `${id}-images`, accept: "image/jpeg,image/png,image/webp", multiple: true }}
            label={t(reading ? "studio.references.reading" : images.length ? "studio.references.addMore" : "studio.references.upload")}
            hint={images.length || reading ? imageHint : `${photoUploadHint ?? t("studio.references.uploadHint")} · ${imageHint}`} />
        </div>
        <span role="status" aria-live="polite" className="sr-only">{images.length}/{HEYGEN_REFERENCE_IMAGE_LIMIT} · {t("studio.reference.images")}</span>
      </div>
      <div className={styles.slotCard} data-required-slot={needsVisual || undefined}>
        <label htmlFor={`${id}-videos`} className={`${styles.label} ${styles.mediaLabel}`}>{t("studio.referenceMedia.title.video")}<span className={styles.requirement} data-required={needsVisual}>{t(needsVisual ? "studio.heygen.reference.imageOrVideo" : "studio.heygen.reference.optional")}</span><small>{videos.length}/{HEYGEN_REFERENCE_VIDEO_LIMIT}</small></label>
        <StudioReferenceFileUpload id={`${id}-videos`} kind="video" value={videoUrl} limit={HEYGEN_REFERENCE_VIDEO_LIMIT}
          authenticated={authenticated} translate={t} onUpload={onMediaUpload} onChange={onVideoUrlChange} />
        <a href="#studio-video-templates" data-choose-video-template className={styles.templateLink}>
          {t("studio.referenceVideo.chooseTemplate")}<span aria-hidden="true">↓</span>
        </a>
        {videoError ? <p role="alert" className={styles.error}>{t(videoError)}</p> : null}
      </div>
      <div className={styles.slotCard}>
        <label htmlFor={`${id}-audio`} className={`${styles.label} ${styles.mediaLabel}`}>{t("studio.referenceMedia.title.audio")}<span className={styles.requirement}>{t("studio.heygen.reference.optional")}</span><small>{audio.length}/{HEYGEN_REFERENCE_AUDIO_LIMIT}</small></label>
        <StudioReferenceFileUpload id={`${id}-audio`} kind="audio" value={audioUrls} limit={HEYGEN_REFERENCE_AUDIO_LIMIT}
          authenticated={authenticated} translate={t} onUpload={onMediaUpload} onChange={onAudioUrlsChange} />
        {audioError ? <p role="alert" className={styles.error}>{t(audioError)}</p> : null}
      </div>
    </div>
  </section>;
}
