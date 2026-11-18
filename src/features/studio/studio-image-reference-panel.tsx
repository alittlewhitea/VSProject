"use client";

import { useId, useState } from "react";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
import styles from "./studio-image-reference-panel.module.css";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
export function StudioImageReferencePanel({ referenceImagesText, referenceImageUrls, templateReferenceUrl, hintKey, multiple = true, translate: t, onTextChange, onFiles, onRemove, onClear, onError }: {
  referenceImagesText: string; referenceImageUrls: string[]; templateReferenceUrl?: string | null; hintKey?: string; multiple?: boolean; translate: Translate;
  onTextChange: (value: string) => void; onFiles: (files: FileList | null) => Promise<void>;
  onRemove: (index: number) => void; onClear: () => void; onError: () => void;
}) {
  const urlsId = useId();
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const hasTemplate = Boolean(templateReferenceUrl && referenceImageUrls[0] === templateReferenceUrl);
  const limit = multiple ? showAll ? referenceImageUrls.length : 8 : 1;
  const subjects = referenceImageUrls.map((url, index) => ({ url, index })).slice(hasTemplate ? 1 : 0, limit);
  const read = async (files: FileList | null) => {
    if (!files?.length || reading) return;
    if (Array.from(files).some(file => !file.type.startsWith("image/"))) { onError(); return; }
    setReading(true);
    try { await onFiles(files); } catch { onError(); } finally { setReading(false); }
  };
  const removeLabel = (index: number) => `${t("studio.action.clear")} ${t("studio.reference.image")} ${index + 1}`;
  const preview = (url: string, index: number, primary = false) => (
    <StudioImagePreview key={`${url}-${index}`} src={url} index={index} alt={`${t("studio.reference.image")} ${index + 1}`}
      className={primary ? styles.primaryPreview : undefined} disabled={reading} removeLabel={removeLabel(index)} onRemove={() => onRemove(index)} />
  );
  const hasImages = referenceImageUrls.length > 0;
  const upload = (compact: boolean, addMore = false) => (
    <StudioImageUpload compact={compact} disabled={reading} onFiles={read} inputProps={{ accept: "image/*", multiple }}
      label={t(reading ? "studio.references.reading" : addMore ? "studio.references.addMore" : "studio.references.upload")}
      hint={compact ? undefined : t("studio.references.uploadHint")} />
  );

  return <div data-reference-panel data-template-reference={hasTemplate ? "true" : undefined} tabIndex={-1} role="group" aria-label={t("studio.imageImage.referenceImages")} className={`${styles.panel} ${dragging ? styles.dragging : ""}`}
    onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) { setDragging(true); event.dataTransfer.dropEffect = "copy"; } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDropCapture={() => setDragging(false)}
    onDrop={event => { event.preventDefault(); void read(event.dataTransfer.files); }}>
    <div className={styles.heading}>
      <div><h3>{t(hasTemplate ? "studio.references.matchTitle" : "studio.imageImage.referenceImages")}</h3>{hintKey ? <p>{t(hintKey)}</p> : null}</div>
      {referenceImageUrls.length ? <button type="button" disabled={reading} className={styles.clear} onClick={onClear}>{t("studio.references.clearAll")}</button> : null}
    </div>
    {hasTemplate ? <div className={styles.matchGrid}>
      <div className={styles.slot}>
        <h4 className={styles.slotTitle}>{t("studio.references.templateTitle")}</h4>
        {preview(referenceImageUrls[0], 0, true)}
        <p className={styles.caption}>{t("studio.references.templateHint")}</p>
      </div>
      <div className={styles.slot}>
        <h4 className={styles.slotTitle}>{t("studio.references.subjectTitle")} {!subjects.length ? <small>{t("studio.textImage.optional")}</small> : null}</h4>
        {subjects.length ? preview(subjects[0].url, subjects[0].index, true) : upload(false)}
        <p className={styles.caption}>{t("studio.references.subjectHint")}</p>
      </div>
    </div> : hasImages ? <div className={styles.genericGrid}>
      {subjects.map(({ url, index }) => preview(url, index))}
    </div> : null}
    {hasTemplate && subjects.length > 1 ? <div className={styles.additional} aria-label={t("studio.references.additional")}>
      {subjects.slice(1).map(({ url, index }) => preview(url, index))}
    </div> : null}
    {!hasTemplate || subjects.length ? <div className={hasImages ? styles.add : undefined}>{upload(hasImages, hasImages && multiple)}</div> : null}
    {multiple && referenceImageUrls.length > 8 && !showAll ? <button type="button" className={styles.showMore} onClick={() => setShowAll(true)}>{t("studio.references.showAll")}</button> : null}
    <details className={styles.urls}>
      <summary><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)" strokeLinecap="round" /></svg><span>{t("studio.references.urlSummary")}</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.chevron}><path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <label htmlFor={urlsId}>{t("studio.references.urlLabel")}</label>
      <textarea id={urlsId} data-reference-urls dir="ltr" rows={multiple ? 3 : 1} value={referenceImagesText} onChange={event => onTextChange(event.target.value)} placeholder="https://.../image.jpg" />
      <p>{t("studio.references.urlHint")}</p>
    </details>
    <span className="sr-only" role="status" aria-live="polite">{reading ? t("studio.references.reading") : t("studio.reference.count", { count: referenceImageUrls.length, label: t(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images") })}</span>
  </div>;
}
