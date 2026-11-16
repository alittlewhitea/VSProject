"use client";

import { useId, useState } from "react";
import { parseReferenceMediaUrls, type SeedanceFlashOptions } from "../../lib/seedance-flash";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-video-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export function SeedanceReferencePanel({ videoUrls, images, options, onOptionsChange, onVideoUrlsChange, onFiles, onRemove, onFileError, translate: t }: {
  videoUrls: string; images: string[]; options: SeedanceFlashOptions;
  onOptionsChange: (value: SeedanceFlashOptions) => void; onVideoUrlsChange: (value: string) => void;
  onFiles: (files: FileList | null) => Promise<void>; onRemove: (index: number) => void; onFileError: () => void;
  translate: Translate;
}) {
  const id = useId();
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
    <p className={styles.hint}>{t("studio.seedance.referenceHint")}</p>
    <label className={styles.label} htmlFor={`${id}-task`}>{t("studio.seedance.task")}</label>
    <select id={`${id}-task`} value={options.task} onChange={event => onOptionsChange({ ...options, task: event.target.value as SeedanceFlashOptions["task"] })} className={styles.url}>
      {["reference", "editing", "extension", "auto"].map(task => <option key={task} value={task}>{t(`studio.seedance.task.${task}`)}</option>)}
    </select>
    <p className={styles.taskHelp} role="status">{t(needsVideo ? "studio.seedance.taskHelp.videoRequired" : options.task === "auto" ? "studio.seedance.taskHelp.auto" : "studio.seedance.taskHelp.reference")}</p>
    <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-videos`}>
      {t("studio.seedance.videos")}<span className={styles.requirement} data-required={needsVideo}>{t(needsVideo ? "studio.seedance.required" : "studio.seedance.optional")}</span><small>{videoCount}/5</small>
    </label>
    <textarea id={`${id}-videos`} rows={2} maxLength={40960} dir="ltr" value={videoUrls} required={needsVideo} aria-required={needsVideo} aria-describedby={`${id}-video-help`} onChange={event => onVideoUrlsChange(event.target.value)} placeholder="https://…/video.mp4" className={`${styles.url} w-full resize-y`} />
    <p id={`${id}-video-help`} className={styles.hint}>{t(needsVideo ? "studio.seedance.videoRequiredHint" : "studio.seedance.videoOptionalHint")}</p>
    <details className={styles.mediaSpecs}><summary>{t("studio.seedance.mediaSpecs")}</summary><p className={styles.hint}>{t("studio.seedance.videoHint")}</p></details>
    <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-audio`}>
      {t("studio.seedance.audio")}<span className={styles.requirement}>{t("studio.seedance.optional")}</span><small>{audioCount}/5</small>
    </label>
    <textarea id={`${id}-audio`} rows={2} maxLength={40960} dir="ltr" value={options.audioUrls} aria-describedby={`${id}-audio-help`} onChange={event => onOptionsChange({ ...options, audioUrls: event.target.value })} placeholder="https://…/audio.mp3" className={`${styles.url} w-full resize-y`} />
    <p id={`${id}-audio-help`} className={styles.hint}>{t("studio.seedance.audioOptionalHint")}</p>
    <details className={styles.mediaSpecs}><summary>{t("studio.seedance.mediaSpecs")}</summary><p className={styles.hint}>{t("studio.seedance.audioHint")}</p></details>
    <label className={`${styles.label} ${styles.mediaLabel}`} htmlFor={`${id}-images`}>
      {t("studio.seedance.images")}<span className={styles.requirement}>{t("studio.seedance.optional")}</span><small>{images.length}/10</small>
    </label>
    <p className={styles.hint}>{t("studio.seedance.imagesOptionalHint")}</p>
    <label className={`${styles.chooseTemplate} relative my-2 cursor-pointer focus-within:ring-2 focus-within:ring-[var(--studio-accent-border)] ${reading || images.length >= 10 ? "opacity-50" : ""}`}>
      {t(reading ? "studio.references.reading" : "studio.references.upload")}
      <input id={`${id}-images`} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={reading || images.length >= 10} onChange={event => { void upload(event.currentTarget.files); event.currentTarget.value = ""; }} className="sr-only" />
    </label>
    {images.length ? <div className={styles.images}>{images.map((url, index) => <figure key={`${url}-${index}`}>
      <img src={url} alt={`@Image${index + 1}`} />
      <button type="button" disabled={reading} aria-label={`${t("studio.action.clear")} @Image${index + 1}`} onClick={() => onRemove(index)}><StudioIcon name="x" className="h-4 w-4" /></button>
      <figcaption className="absolute bottom-1 start-1 rounded bg-[var(--studio-panel)] px-1 text-xs text-[var(--studio-text)]">@Image{index + 1}</figcaption>
    </figure>)}</div> : null}
    {videoCount ? <p className={styles.hint}>{t("studio.seedance.videoQuote")}</p> : null}
  </section>;
}
