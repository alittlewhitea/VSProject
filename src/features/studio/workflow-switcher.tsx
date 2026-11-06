"use client";

import { StudioSegmentedControl } from "./studio-primitives";

type Translate = (key: string, values?: Record<string, string | number>) => string;
export type ImageWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";
export type VideoWorkflow = "text-to-video" | "image-to-video" | "reference-to-video";
export type AudioWorkflow = "text-to-audio" | "text-to-music";
export type StudioWorkflow = ImageWorkflow | VideoWorkflow | AudioWorkflow | "avatar-video";
type StudioMode = "image" | "video" | "audio" | "avatar";

type WorkflowSwitcherProps = {
  t: Translate;
  mode: StudioMode;
  imageWorkflow: ImageWorkflow;
  videoWorkflow: VideoWorkflow | "avatar-video";
  audioWorkflow: AudioWorkflow;
  modern: boolean;
  imageRedesign: boolean;
  videoRedesign: boolean;
  audioRedesign: boolean;
  avatarRedesign: boolean;
  imageToImageRedesign: boolean;
  imageUtilityRedesign: boolean;
  hasReferenceImages: boolean;
  onWorkflowChange: (workflow: StudioWorkflow) => void;
};

export function WorkflowSwitcher({
  t,
  mode,
  imageWorkflow,
  videoWorkflow,
  audioWorkflow,
  modern,
  imageRedesign,
  videoRedesign,
  audioRedesign,
  avatarRedesign,
  imageToImageRedesign,
  imageUtilityRedesign,
  hasReferenceImages,
  onWorkflowChange
}: WorkflowSwitcherProps) {
  const description = imageToImageRedesign
    ? t("studio.imageImage.heroDescription")
    : imageUtilityRedesign
      ? t(imageWorkflow === "background-remove" ? "studio.utilityImage.backgroundHeroDescription" : "studio.utilityImage.enhanceHeroDescription")
      : videoRedesign
        ? t(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.imageHeroDescription" : "studio.videoWorkbench.textHeroDescription")
        : audioRedesign
          ? t(audioWorkflow === "text-to-music" ? "studio.audioWorkbench.musicHeroDescription" : "studio.audioWorkbench.voiceHeroDescription")
          : avatarRedesign
            ? t("studio.avatarWorkbench.heroDescription")
            : t("studio.textImage.heroDescription");

  if (modern) {
    if (mode === "avatar") return null;
    const workflows = mode === "image"
      ? (["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] as ImageWorkflow[])
      : mode === "video"
        ? (["text-to-video", "image-to-video", "reference-to-video"] as VideoWorkflow[])
        : (["text-to-audio", "text-to-music"] as AudioWorkflow[]);
    const active = mode === "image" ? imageWorkflow : mode === "video" ? videoWorkflow : audioWorkflow;
    return <div className="df-workflow-nav"><StudioSegmentedControl label={t(`studio.nav.${mode}`)} options={workflows.map(workflow => ({ value: workflow, label: t(`studio.workflow.${workflow}`) }))} value={active} onChange={onWorkflowChange} /></div>;
  }

  return (
    <>
      <h2 className={modern ? "mx-auto max-w-[900px] text-[34px] font-semibold leading-[0.98] tracking-[-0.06em] text-[var(--studio-text)] sm:text-[clamp(42px,4.15vw,66px)]" : "hidden text-3xl font-semibold tracking-tight text-[var(--studio-text)] sm:block md:text-5xl"}>{t("studio.heading.createToday")}</h2>
      {modern ? <p className="mx-auto mt-[15px] max-w-[690px] text-[15px] leading-[1.55] text-[var(--studio-muted)] sm:text-[17px]">{description}</p> : null}
      <div className={modern ? "mx-auto mt-6 flex justify-center" : "mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7"}>
        {mode === "image" ? (
          <>
            <div className={imageRedesign ? "flex w-full max-w-[900px] gap-1 overflow-x-auto rounded-[22px] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-1.5 shadow-none lg:grid lg:w-fit lg:grid-cols-4 lg:overflow-visible lg:rounded-full" : "grid w-full max-w-[720px] grid-cols-2 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-1 shadow-sm sm:inline-grid sm:w-auto sm:max-w-none sm:grid-cols-4 sm:rounded-full"}>
              {(["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] as ImageWorkflow[]).map((workflow) => (
                <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} className={`${imageRedesign ? "min-w-[132px] shrink-0 rounded-[17px] px-4 py-[13px] text-sm font-semibold lg:min-w-[142px] lg:rounded-full" : "rounded-full px-4 py-2.5 text-sm font-semibold sm:py-2"} transition ${imageWorkflow === workflow ? "bg-[var(--studio-primary)] text-white shadow-none" : "text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-text)]"}`}>{t(`studio.workflow.${workflow}`)}</button>
              ))}
            </div>
            <button type="button" onClick={() => onWorkflowChange(hasReferenceImages ? "image-to-image" : "text-to-image")} className="hidden rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-text)] shadow-sm">Image Studio / Text + Reference</button>
          </>
        ) : mode === "video" ? (
          <div className={videoRedesign ? "grid w-full max-w-[520px] grid-cols-2 gap-1 overflow-visible rounded-[22px] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-1.5 shadow-none sm:rounded-full" : "mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7"}>
            {(["text-to-video", "image-to-video", "reference-to-video"] as VideoWorkflow[]).map((workflow) => {
              const active = videoWorkflow === workflow;
              return <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} className={`${videoRedesign ? "min-w-0 rounded-[17px] px-4 py-[13px] text-sm font-semibold sm:rounded-full" : "rounded-full border px-4 py-2 text-sm font-semibold"} transition ${active ? videoRedesign ? "bg-[var(--studio-primary)] text-white shadow-none" : "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)] shadow-sm" : videoRedesign ? "text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-text)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-panel)] hover:text-[var(--studio-text)]"}`}>{t(`studio.workflow.${workflow}`)}</button>;
            })}
          </div>
        ) : mode === "audio" ? (
          <div className={audioRedesign ? "grid w-full max-w-[560px] grid-cols-2 gap-1 overflow-visible rounded-[22px] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-1.5 shadow-none sm:rounded-full" : "grid w-full max-w-[560px] grid-cols-2 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] p-1 shadow-sm sm:w-auto"}>
            {(["text-to-audio", "text-to-music"] as AudioWorkflow[]).map((workflow) => <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} className={`${audioRedesign ? "min-w-0 rounded-[17px] px-4 py-[13px] text-sm font-semibold sm:rounded-full" : "rounded-full px-5 py-2.5 text-sm font-semibold"} transition ${audioWorkflow === workflow ? "bg-[var(--studio-primary)] text-white shadow-none" : "text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-text)]"}`}>{t(`studio.workflow.${workflow}`)}</button>)}
          </div>
        ) : mode === "avatar" ? (
          <div className="inline-flex rounded-[22px] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-1.5 shadow-none"><button type="button" className="min-w-[172px] rounded-[17px] bg-[var(--studio-primary)] px-5 py-[13px] text-sm font-semibold text-white shadow-none">{t("studio.avatarWorkbench.tab")}</button></div>
        ) : null}
      </div>
    </>
  );
}
