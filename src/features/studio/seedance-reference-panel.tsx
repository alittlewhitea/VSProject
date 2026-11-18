"use client";

import { useState } from "react";
import { SEEDANCE_FLASH_IMAGE_LIMIT, SEEDANCE_FLASH_MEDIA_LIMIT, parseReferenceMediaUrls, type SeedanceFlashOptions } from "../../lib/seedance-flash";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
import styles from "./studio-video-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export function SeedanceReferencePanel({ videoUrls, images, options, onOptionsChange, onVideoUrlsChange, onFiles, onRemove, onFileError, translate: t }: {
  videoUrls: string; images: string[]; options: SeedanceFlashOptions;
  onOptionsChange: (value: SeedanceFlashOptions) => void; onVideoUrlsChange: (value: string) => void;
  onFiles: (files: FileList | null) => Promise<void>; onRemove: (index: number) => void; onFileError: () => void;
  translate: Translate;
}) {
  // Only one reference form is mounted in the workspace.
  const id = "studio-seedance-reference";
  const [reading, setReading] = useState(false);
  const needsVideo = options.task === "editing" || options.task === "extension";
  const videoCount = parseReferenceMediaUrls(videoUrls).length;
  const audioCount = parseReferenceMediaUrls(options.audioUrls).length;
  async function upload(files: FileList | null) {
    if (reading || !files?.length) return;
    setReading(true);
    try { await onFiles(files); } catch { onFileError(); } finally { setReading(false); }
  }
  return <section data-seedance-references className={styles.panel} aria-label={t("studio.seedance.references")}>
    <h3>{t("studio.seedance.references")}</h3>
    <label className={styles.label} htmlFor={`${id}-task`}>{t("studio.seedance.task")}</label>
    <select id={`${id}-task`} value={options.task} onChange={event => onOptionsChange({ ...options, task: event.target.value as SeedanceFlashOptions["task"] })} className={styles.url}>
      {["reference", "editing", "extension", "auto"].map(task => <option key={task} value={task}>{t(`studio.seedance.task.${task}`)}</option>)}
    </select>
    <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-images`}>
      {t("studio.seedance.images")}<span className={styles.requirement}>{t("studio.seedance.optional")}</span><small>{images.length}/{SEEDANCE_FLASH_IMAGE_LIMIT}</small>
    </label>
    <p className={styles.hint}>{t("studio.seedance.imageHint")}</p>
    {images.length ? <div className={styles.images}>{images.map((url, index) => {
      const name = `@Image${index + 1}`;
      return <StudioImagePreview key={`${url}-${index}`} src={url} alt={name} caption={name} index={index}
        disabled={reading} removeLabel={`${t("studio.action.clear")} ${name}`} onRemove={() => onRemove(index)} />;
    })}</div> : null}
    <div className={styles.imageUpload}>
      <StudioImageUpload compact={images.length > 0} disabled={reading || images.length >= SEEDANCE_FLASH_IMAGE_LIMIT} onFiles={upload}
        inputProps={{ id: `${id}-images`, accept: "image/jpeg,image/png,image/webp", multiple: true }}
        label={t(reading ? "studio.references.reading" : images.length ? "studio.references.addMore" : "studio.references.upload")}
        hint={images.length ? undefined : t("studio.references.uploadHint")} />
    </div>
    <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-videos`}>
      {t("studio.seedance.videos")}<span className={styles.requirement} data-required={needsVideo}>{t(needsVideo ? "studio.seedance.required" : "studio.seedance.optional")}</span><small>{videoCount}/{SEEDANCE_FLASH_MEDIA_LIMIT}</small>
    </label>
    <textarea id={`${id}-videos`} rows={2} maxLength={40960} dir="ltr" value={videoUrls} required={needsVideo} aria-required={needsVideo} aria-describedby={`${id}-video-help`} onChange={event => onVideoUrlsChange(event.target.value)} placeholder="https://…/video.mp4" className={`${styles.url} w-full resize-y`} />
    <p id={`${id}-video-help`} className={styles.hint}>{t("studio.seedance.linkHint")}</p>
    <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-audio`}>
      {t("studio.seedance.audio")}<span className={styles.requirement}>{t("studio.seedance.optional")}</span><small>{audioCount}/{SEEDANCE_FLASH_MEDIA_LIMIT}</small>
    </label>
    <textarea id={`${id}-audio`} rows={2} maxLength={40960} dir="ltr" value={options.audioUrls} aria-describedby={`${id}-audio-help`} onChange={event => onOptionsChange({ ...options, audioUrls: event.target.value })} placeholder="https://…/audio.mp3" className={`${styles.url} w-full resize-y`} />
    <p id={`${id}-audio-help`} className={styles.hint}>{t("studio.seedance.linkHint")}</p>
    <details className={styles.mediaSpecs}>
      <summary>{t("studio.seedance.mediaSpecs")}</summary>
      <dl className={styles.mediaSpecList}>
        <div><dt>{t("studio.seedance.videos")}</dt><dd>{t("studio.seedance.videoHint")}</dd></div>
        <div><dt>{t("studio.seedance.audio")}</dt><dd>{t("studio.seedance.audioHint")}</dd></div>
      </dl>
    </details>
  </section>;
}
