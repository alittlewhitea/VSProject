"use client";

import { useState } from "react";
import { SEEDANCE_FLASH_AUDIO_BYTES, SEEDANCE_FLASH_IMAGE_LIMIT, SEEDANCE_FLASH_MEDIA_LIMIT, parseReferenceMediaUrls, type SeedanceFlashOptions } from "../../lib/seedance-flash";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
import { StudioReferenceFileUpload, type ReferenceMediaUpload } from "./studio-reference-file-upload";
import styles from "./studio-video-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export function SeedanceReferencePanel({ videoUrls, images, options, onOptionsChange, onVideoUrlsChange, onAudioUrlsChange, onFiles, onRemove, onFileError, onMediaUpload, authenticated, translate: t }: {
  videoUrls: string; images: string[]; options: SeedanceFlashOptions;
  onOptionsChange: (value: SeedanceFlashOptions) => void; onVideoUrlsChange: (value: string) => void;
  onAudioUrlsChange: (value: string) => void;
  onFiles: (files: FileList | null) => Promise<void>; onRemove: (index: number) => void; onFileError: () => void;
  translate: Translate;
  onMediaUpload?: ReferenceMediaUpload;
  authenticated: boolean;
}) {
  // Only one reference form is mounted in the workspace.
  const id = "studio-seedance-reference";
  const [reading, setReading] = useState(false);
  const needsVideo = options.task === "editing" || options.task === "extension";
  const videoCount = parseReferenceMediaUrls(videoUrls).length;
  const audioCount = parseReferenceMediaUrls(options.audioUrls).length;
  const imageHint = t("studio.seedance.imageHint");
  async function upload(files: FileList | null) {
    if (reading || !files?.length) return;
    setReading(true);
    try { await onFiles(files); } catch { onFileError(); } finally { setReading(false); }
  }
  return <section data-seedance-references className={styles.panel} aria-label={t("studio.seedance.references")}>
    <h3>{t("studio.seedance.references")}</h3>
    <label className={styles.label} htmlFor={`${id}-task`}>{t("studio.seedance.task")}</label>
    <select id={`${id}-task`} value={options.task} onChange={event => onOptionsChange({ ...options, task: event.target.value as SeedanceFlashOptions["task"] })} className={styles.taskSelect}>
      {["reference", "editing", "extension", "auto"].map(task => <option key={task} value={task}>{t(`studio.seedance.task.${task}`)}</option>)}
    </select>
    <div className={styles.slotsGrid}>
      <div className={styles.slotCard}>
        <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-images`}>
          <span className={styles.slotTitle}>{t("studio.seedance.images")}</span>
          <small>{images.length}/{SEEDANCE_FLASH_IMAGE_LIMIT}</small>
        </label>
        {images.length ? <div className={styles.previews}>{images.map((url, index) => {
          const name = `@Image${index + 1}`;
          return <StudioImagePreview key={`${url}-${index}`} src={url} alt={name} caption={name} index={index}
            disabled={reading} removeLabel={`${t("studio.action.clear")} ${name}`} onRemove={() => onRemove(index)} />;
        })}</div> : null}
        <div className={styles.uploadArea}>
          <StudioImageUpload compact={images.length > 0} disabled={reading || images.length >= SEEDANCE_FLASH_IMAGE_LIMIT} onFiles={upload}
            inputProps={{ id: `${id}-images`, accept: "image/jpeg,image/png,image/webp", multiple: true }}
            label={t(reading ? "studio.references.reading" : images.length ? "studio.references.addMore" : "studio.references.upload")}
            hint={imageHint} />
        </div>
      </div>
      <div className={styles.slotCard}>
        <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-videos`}>
          <span className={styles.slotTitle}>{t("studio.referenceMedia.title.video")}</span>
          {needsVideo ? <span className={styles.requirement} data-required="true">{t("studio.seedance.required")}</span> : null}
          <small>{videoCount}/{SEEDANCE_FLASH_MEDIA_LIMIT}</small>
        </label>
        <StudioReferenceFileUpload id={`${id}-videos`} kind="video" value={videoUrls} limit={SEEDANCE_FLASH_MEDIA_LIMIT}
          authenticated={authenticated} translate={t} onUpload={onMediaUpload} onChange={onVideoUrlsChange} />
      </div>
      <div className={styles.slotCard}>
        <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-audio`}>
          <span className={styles.slotTitle}>{t("studio.referenceMedia.title.audio")}</span>
          <small>{audioCount}/{SEEDANCE_FLASH_MEDIA_LIMIT}</small>
        </label>
        <StudioReferenceFileUpload id={`${id}-audio`} kind="audio" value={options.audioUrls} limit={SEEDANCE_FLASH_MEDIA_LIMIT}
          maxBytes={SEEDANCE_FLASH_AUDIO_BYTES} extensions={["mp3", "wav"]} hintKey="studio.seedance.audioHint"
          authenticated={authenticated} translate={t} onUpload={onMediaUpload} onChange={onAudioUrlsChange} />
      </div>
    </div>
    <details className={styles.mediaSpecs}>
      <summary>{t("studio.seedance.mediaSpecs")}</summary>
      <dl className={styles.mediaSpecList}>
        <div><dt>{t("studio.referenceMedia.title.video")}</dt><dd>{t("studio.seedance.videoHint")}</dd></div>
      </dl>
    </details>
  </section>;
}
