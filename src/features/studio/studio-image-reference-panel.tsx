"use client";

import { useId, useRef, useState } from "react";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-image-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export function StudioImageReferencePanel({ compact = false, referenceImagesText, referenceImageUrls, templateReferenceUrl, translate: t, onTextChange, onFiles, onRemove, onClear, onError }: {
  compact?: boolean; referenceImagesText: string; referenceImageUrls: string[]; templateReferenceUrl?: string | null; translate: Translate;
  onTextChange: (value: string) => void; onFiles: (files: FileList | null) => Promise<void>;
  onRemove: (index: number) => void; onClear: () => void; onError: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const urlsId = useId();
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const hasTemplate = Boolean(templateReferenceUrl && referenceImageUrls[0] === templateReferenceUrl);
  const limit = showAll ? referenceImageUrls.length : 8;
  const subjects = referenceImageUrls.map((url, index) => ({ url, index })).slice(hasTemplate ? 1 : 0, limit);
  const choose = () => input.current?.click();
  const read = async (files: FileList | null) => {
    if (!files?.length || reading) return;
    if (Array.from(files).some(file => !file.type.startsWith("image/"))) { onError(); return; }
    setReading(true);
    try { await onFiles(files); } catch { onError(); } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };
  const removeLabel = (index: number) => `${t("studio.action.clear")} ${t("studio.reference.image")} ${index + 1}`;
  const preview = (url: string, index: number, primary = false) => <figure key={`${url}-${index}`} data-reference-index={index} className={`${styles.preview} ${primary ? styles.primaryPreview : ""}`}>
    <img src={url} alt={`${t("studio.reference.image")} ${index + 1}`} />
    <button type="button" disabled={reading} data-remove-reference={index} onClick={() => onRemove(index)} aria-label={removeLabel(index)} className={styles.remove}><StudioIcon name="x" className="h-3.5 w-3.5" /></button>
  </figure>;
  const upload = (compact = false) => <button type="button" data-upload-reference disabled={reading} onClick={choose} className={`${styles.upload} ${compact ? styles.compactUpload : ""}`}>
    {hasTemplate && !reading ? <small className={styles.optional}>{t("studio.textImage.optional")}</small> : null}
    <span className={styles.plus} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg></span>
    <strong>{t(reading ? "studio.references.reading" : "studio.references.upload")}</strong>
    <span>{t("studio.references.uploadHint")}</span>
  </button>;

  return <div data-reference-panel data-compact={compact || undefined} data-template-reference={hasTemplate ? "true" : undefined} tabIndex={-1} role="group" aria-label={t("studio.imageImage.referenceImages")} className={`${styles.panel} ${dragging ? styles.dragging : ""}`}
    onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) { setDragging(true); event.dataTransfer.dropEffect = "copy"; } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); void read(event.dataTransfer.files); }}>
    <div className={styles.heading}>
      <div><h3>{t(hasTemplate ? "studio.references.matchTitle" : "studio.imageImage.referenceImages")}</h3><p>{t(hasTemplate ? "studio.references.matchHint" : "studio.references.genericHint")}</p></div>
      {referenceImageUrls.length ? <button type="button" disabled={reading} className={styles.clear} onClick={onClear}>{t("studio.references.clearAll")}</button> : null}
    </div>
    <input ref={input} type="file" accept="image/*" multiple hidden disabled={reading} aria-label={t("studio.references.upload")} onChange={event => void read(event.currentTarget.files)} />
    {hasTemplate ? <div className={styles.matchGrid}>
      <div className={styles.slot}>
        <div className={styles.slotTitle}><span aria-hidden="true">1</span><h4>{t("studio.references.templateTitle")}</h4></div>
        {preview(referenceImageUrls[0], 0, true)}
        <p className={styles.caption}>{t("studio.references.templateHint")}</p>
      </div>
      <div className={styles.slot}>
        <div className={styles.slotTitle}><span aria-hidden="true">2</span><h4>{t("studio.references.subjectTitle")}</h4></div>
        {subjects.length ? preview(subjects[0].url, subjects[0].index, true) : upload()}
        <p className={styles.caption}>{t("studio.references.subjectHint")}</p>
        {subjects.length ? <button type="button" data-add-reference disabled={reading} className={styles.add} onClick={choose}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" strokeLinecap="round" strokeLinejoin="round" /></svg>{t("studio.references.addMore")}</button> : null}
      </div>
    </div> : <div className={referenceImageUrls.length ? styles.genericGrid : styles.empty}>
      {subjects.map(({ url, index }) => preview(url, index))}
      {upload(referenceImageUrls.length > 0)}
    </div>}
    {hasTemplate && subjects.length > 1 ? <div className={styles.additional} aria-label={t("studio.references.additional")}>
      {subjects.slice(1).map(({ url, index }) => preview(url, index))}
    </div> : null}
    {referenceImageUrls.length > 8 && !showAll ? <button type="button" className={styles.showMore} onClick={() => setShowAll(true)}>{t("studio.references.showAll")}</button> : null}
    <details className={styles.urls}>
      <summary><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)" strokeLinecap="round" /></svg><span>{t("studio.references.urlSummary")}</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.chevron}><path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <label htmlFor={urlsId}>{t("studio.references.urlLabel")}</label>
      <textarea id={urlsId} data-reference-urls dir="ltr" rows={3} value={referenceImagesText} onChange={event => onTextChange(event.target.value)} placeholder="https://.../image.jpg" />
      <p>{t("studio.references.urlHint")}</p>
    </details>
    <span className={styles.status} role="status" aria-live="polite">{reading ? t("studio.references.reading") : t("studio.reference.count", { count: referenceImageUrls.length, label: t(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images") })}</span>
  </div>;
}
