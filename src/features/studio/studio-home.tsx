"use client";

import { StudioDeferredSection } from "./studio-deferred-section";
import { memo, useEffect, useRef, useState } from "react";
import { StudioButton, StudioSegmentedControl } from "./studio-primitives";
import type { Locale } from "../../i18n/routing";
import { StudioIcon } from "./studio-navigation";
import dynamic from "next/dynamic";

const HomeTemplateCarousel = dynamic(() => import("./studio-home-template-carousel"), { ssr: false });
const CombinedTemplateGallery = dynamic(() => import("./studio-combined-template-gallery"), { ssr: false });

type Translate = (key: string, values?: Record<string, string | number>) => string;
export type HomeCreationInput = { mode: "video" | "image" | "avatar" | "audio"; prompt: string; image?: string };

export const StudioHome = memo(function StudioHome({ t, locale, onCreate }: { t: Translate; locale: Locale; onCreate: (input: HomeCreationInput) => void }) {
  const [draft, setDraft] = useState("");
  const [intent, setIntent] = useState<"video" | "image" | "avatar" | "audio">("video");
  const [upload, setUpload] = useState<{ dataUrl: string; name: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const uploadSequence = useRef(0);
  useEffect(() => () => { uploadSequence.current++; }, []);
  const start = (mode = intent) => onCreate({ mode, prompt: draft.trim(), image: mode !== "audio" ? upload?.dataUrl : undefined });
  const readImage = async (file?: File) => {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    setUploadError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 30 * 1024 * 1024) {
      setReading(false);
      setUploadError(t("studio.videoWorkbench.uploadError", { count: 1 }));
      return;
    }
    setReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read"));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (sequence === uploadSequence.current) setUpload({ dataUrl, name: file.name });
    } catch {
      if (sequence === uploadSequence.current) setUploadError(t("studio.status.fileReadFailed"));
    } finally { if (sequence === uploadSequence.current) setReading(false); }
  };

  return (
    <div className="studio-home">
      <section className="df-home-create">
        <div className="df-home-masthead">
          <span className="df-eyebrow">DreamFace Creative Studio</span>
          <h2>{t("studio.workspace.heroTitle")} {t("studio.workspace.heroAccent")}</h2>
          <p>{t("studio.workspace.heroBody")}</p>
        </div>
        <StudioDeferredSection><HomeTemplateCarousel translate={t} /></StudioDeferredSection>
        <div className="studio-composer">
          {upload ? <div className="df-home-upload-preview"><img src={upload.dataUrl} alt={upload.name} /><span>{upload.name}</span><button type="button" onClick={() => { uploadSequence.current++; setUpload(null); setReading(false); }} aria-label={t("studio.action.clear")}><StudioIcon name="x" className="h-4 w-4" /></button></div> : null}
          <label htmlFor="studio-home-prompt" className="sr-only">{t("studio.field.prompt")}</label>
          <textarea
            id="studio-home-prompt"
            dir="auto"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && !event.nativeEvent.isComposing && !reading) {
                event.preventDefault();
                start();
              }
            }}
            placeholder={t(intent === "video" ? "studio.placeholder.video" : intent === "image" ? "studio.placeholder.image" : intent === "avatar" ? "studio.placeholder.avatar" : "studio.placeholder.audio")}
            rows={2}
          />
          <div className="studio-composer-actions">
            <input ref={fileInput} data-home-image-input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t("studio.action.chooseImage")} onChange={event => { void readImage(event.target.files?.[0]); event.target.value = ""; }} />
            <StudioButton className="studio-upload-link" disabled={reading} onClick={() => fileInput.current?.click()} aria-label={t("studio.action.chooseImage")} title={t("studio.action.chooseImage")}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg><span className="df-home-upload-label">{t("studio.action.chooseImage")}</span></StudioButton>
            <StudioSegmentedControl label={t("studio.workspace.intentTitle")} value={intent} onChange={mode => { if (reading) return; setIntent(mode); if (upload) start(mode); }} options={(["video", "image", "avatar", "audio"] as const).map(value => ({ value, label: t(`studio.nav.${value}`), icon: <StudioIcon name={value === "avatar" ? "user" : value} className="h-4 w-4" /> }))} />
            <StudioButton onClick={() => start()} disabled={reading} variant="primary" className="studio-start">{t("studio.workspace.start")}<StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" /></StudioButton>
          </div>
          {uploadError ? <p role="alert" className="mt-3 text-sm text-[var(--studio-error)]">{uploadError}</p> : null}
        </div>
      </section>

      <StudioDeferredSection><CombinedTemplateGallery translate={t} locale={locale} /></StudioDeferredSection>
    </div>
  );
});
