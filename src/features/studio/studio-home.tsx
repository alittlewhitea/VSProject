"use client";
import {StudioDeferredSection} from "./studio-deferred-section";

import Link from "./studio-link";
import { useEffect, useRef, useState } from "react";
import { StudioButton, StudioSectionHeading, StudioSegmentedControl } from "./studio-primitives";
import type { Locale } from "../../i18n/routing";
import { StudioIcon } from "./studio-navigation";
import { ViewportVideo } from "../../components/viewport-video";
import dynamic from "next/dynamic";

const HomeTemplateCarousel = dynamic(() => import("./studio-home-template-carousel"), { ssr: false });
const CombinedTemplateGallery = dynamic(() => import("./studio-combined-template-gallery"), { ssr: false });

type Translate = (key: string, values?: Record<string, string | number>) => string;
export type HomeCreationInput = { mode: "video" | "image" | "audio"; prompt: string; image?: string };
const VIDEO_BASE_URL = "https://media.dreamface.io/ai_video";
const SHOWCASES: Array<{
  key: "baseball" | "cgi" | "tokyo" | "spectator";
  file: string;
  prompt: string;
  labelKey: string;
  titleKey: string;
  metaKey: string;
  desktopRatio?: "16x9" | "1x1";
}> = [
  { key: "baseball", file: "baseball-game-broadcast-shot", prompt: "A baseball game broadcast shot - person sits in stadium stands in a team jersey, watching the field and posing softly like a viral stargirl moment caught on live TV.", labelKey: "studio.workspace.showcase.baseball.label", titleKey: "studio.workspace.showcase.baseball.title", metaKey: "studio.workspace.showcase.baseball.meta" },
  { key: "cgi", file: "cgi-breakdown-reveal", prompt: "CGI breakdown reveal - mesh to beauty pass, each render layer cuts in sequence, turntable camera, ending on the final polished visual.", labelKey: "studio.workspace.showcase.cgi.label", titleKey: "studio.workspace.showcase.cgi.title", metaKey: "studio.workspace.showcase.cgi.meta" },
  { key: "tokyo", file: "tokyo-night-street-racing", prompt: "Tokyo night street racing - cars drift and donut around the character, low angles and 35mm film grain, blockbuster reveal.", labelKey: "studio.workspace.showcase.tokyo.label", titleKey: "studio.workspace.showcase.tokyo.title", metaKey: "studio.workspace.showcase.tokyo.meta" },
  { key: "spectator", file: "spectator-sprints-from-the-stands", prompt: "Spectator sprints from the stands, jumps fences, evades security, charges onto the pitch and strikes - all in one continuous telephoto take.", labelKey: "studio.workspace.showcase.spectator.label", titleKey: "studio.workspace.showcase.spectator.title", metaKey: "studio.workspace.showcase.spectator.meta", desktopRatio: "1x1" }
];

function showcaseHref(prompt: string) {
  return `/studio?mode=video&workflow=text-to-video&duration=5s&prompt=${encodeURIComponent(prompt)}`;
}

function ShowcaseVideo({ file, desktopRatio = "16x9", mobileRatio = "1x1", className = "" }: { file: string; desktopRatio?: "16x9" | "1x1"; mobileRatio?: "16x9" | "1x1"; className?: string }) {
  return (
    <ViewportVideo
      muted loop playsInline className={className}
      mobileSrc={`${VIDEO_BASE_URL}/${mobileRatio}/${file}-${mobileRatio}.mp4`}
      src={`${VIDEO_BASE_URL}/${desktopRatio}/${file}-${desktopRatio}.mp4`}
    />
  );
}

export function StudioHome({ t, locale, onCreate }: { t: Translate; locale: Locale; onCreate: (input: HomeCreationInput) => void }) {
  const [videoTemplatesRequest, setVideoTemplatesRequest] = useState(0);
  const [draft, setDraft] = useState("");
  const [intent, setIntent] = useState<"video" | "image" | "audio">("video");
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
          <textarea id="studio-home-prompt" dir="auto" value={draft} onChange={event => setDraft(event.target.value)} placeholder={t(intent === "video" ? "studio.placeholder.video" : intent === "image" ? "studio.placeholder.image" : "studio.placeholder.audio")} rows={2} />
          <div className="studio-composer-actions">
            <input ref={fileInput} data-home-image-input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t("studio.action.chooseImage")} onChange={event => { void readImage(event.target.files?.[0]); event.target.value = ""; }} />
            <StudioButton className="studio-upload-link" disabled={reading} onClick={() => fileInput.current?.click()} aria-label={t("studio.action.chooseImage")} title={t("studio.action.chooseImage")}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg><span className="df-home-upload-label">{t("studio.action.chooseImage")}</span></StudioButton>
            <StudioSegmentedControl label={t("studio.workspace.intentTitle")} value={intent} onChange={mode => { if (reading) return; setIntent(mode); if (upload) start(mode); }} options={(["video", "image", "audio"] as const).map(value => ({ value, label: t(`studio.nav.${value}`), icon: <StudioIcon name={value} className="h-4 w-4" /> }))} />
            <StudioButton onClick={() => start()} disabled={reading} variant="primary" className="studio-start">{t("studio.workspace.start")}<StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" /></StudioButton>
          </div>
          {uploadError ? <p role="alert" className="mt-3 text-sm text-[var(--studio-error)]">{uploadError}</p> : null}
        </div>
      </section>

      <section className="df-home-gallery" aria-labelledby="studio-featured-title">
        <StudioSectionHeading id="studio-featured-title" title={t("studio.workspace.featuredTitle")} description={t("studio.workspace.featuredHint")} action={<StudioButton variant="ghost" data-open-video-templates onClick={() => setVideoTemplatesRequest(value => value + 1)}>{t("studio.templates.viewVideos")}<StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" /></StudioButton>} />
        <div className="studio-showcase-grid">
          {SHOWCASES.map(item => <Link key={item.key} href={showcaseHref(item.prompt)} className="studio-showcase">
            <ShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} />
            <span className="df-tile-type"><StudioIcon name="video" className="h-3 w-3" />{t("studio.workbench.sampleVideo")}</span>
            <span className="studio-showcase-caption"><strong>{t(item.titleKey)}</strong><small>{t(item.labelKey)}<span className="inline-flex items-center gap-1">{t("studio.workspace.start")}<StudioIcon name="chevron-right" className="h-3 w-3 rtl:rotate-180" /></span></small></span>
          </Link>)}
        </div>
      </section>

      <StudioDeferredSection><CombinedTemplateGallery translate={t} locale={locale} videoFocusRequest={videoTemplatesRequest} /></StudioDeferredSection>
    </div>
  );
}
