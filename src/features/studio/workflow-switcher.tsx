"use client";

type Translate = (key: string, values?: Record<string, string | number>) => string;
export type ImageWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";
export type VideoWorkflow = "text-to-video" | "image-to-video";
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
        ? (["text-to-video", "image-to-video"] as VideoWorkflow[])
        : (["text-to-audio", "text-to-music"] as AudioWorkflow[]);
    return (
      <div className="mb-3 flex w-full justify-start px-0.5 pb-1">
        <div className={`grid w-full gap-1 rounded-[14px] border border-[#eaecf0] bg-white p-1 shadow-sm ${mode === "image" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:w-auto sm:min-w-[360px]"}`}>
          {workflows.map((workflow) => {
            const active = mode === "image" ? imageWorkflow === workflow : mode === "video" ? videoWorkflow === workflow : audioWorkflow === workflow;
            return <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} aria-pressed={active} className={`min-h-11 min-w-0 rounded-[10px] px-2 py-2 text-xs font-bold leading-[1.3] transition sm:px-4 ${active ? "bg-[#f1efff] text-[#6a5af9] shadow-[inset_0_0_0_1px_#ddd8ff]" : "text-[#667085] hover:bg-[#f8f8fb] hover:text-[#344054]"}`}>{t(`studio.workflow.${workflow}`)}</button>;
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <h2 className={modern ? "mx-auto max-w-[900px] text-[34px] font-black leading-[0.98] tracking-[-0.06em] text-[#151827] sm:text-[clamp(42px,4.15vw,66px)]" : "hidden text-3xl font-semibold tracking-tight text-[#202633] sm:block md:text-5xl"}>{t("studio.heading.createToday")}</h2>
      {modern ? <p className="mx-auto mt-[15px] max-w-[690px] text-[15px] leading-[1.55] text-[#7d8aa0] sm:text-[17px]">{description}</p> : null}
      <div className={modern ? "mx-auto mt-6 flex justify-center" : "mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7"}>
        {mode === "image" ? (
          <>
            <div className={imageRedesign ? "flex w-full max-w-[900px] gap-1 overflow-x-auto rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)] lg:grid lg:w-fit lg:grid-cols-4 lg:overflow-visible lg:rounded-full" : "grid w-full max-w-[720px] grid-cols-2 rounded-2xl border border-black/[0.06] bg-white/82 p-1 shadow-sm sm:inline-grid sm:w-auto sm:max-w-none sm:grid-cols-4 sm:rounded-full"}>
              {(["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] as ImageWorkflow[]).map((workflow) => (
                <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} className={`${imageRedesign ? "min-w-[132px] shrink-0 rounded-[17px] px-4 py-[13px] text-sm font-black lg:min-w-[142px] lg:rounded-full" : "rounded-full px-4 py-2.5 text-sm font-semibold sm:py-2"} transition ${imageWorkflow === workflow ? "bg-[#202633] text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]" : "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"}`}>{t(`studio.workflow.${workflow}`)}</button>
              ))}
            </div>
            <button type="button" onClick={() => onWorkflowChange(hasReferenceImages ? "image-to-image" : "text-to-image")} className="hidden rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#354052] shadow-sm">Image Studio / Text + Reference</button>
          </>
        ) : mode === "video" ? (
          <div className={videoRedesign ? "grid w-full max-w-[520px] grid-cols-2 gap-1 overflow-visible rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)] sm:rounded-full" : "mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7"}>
            {(["text-to-video", "image-to-video"] as VideoWorkflow[]).map((workflow) => {
              const active = videoWorkflow === workflow;
              return <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} className={`${videoRedesign ? "min-w-0 rounded-[17px] px-4 py-[13px] text-sm font-black sm:rounded-full" : "rounded-full border px-4 py-2 text-sm font-semibold"} transition ${active ? videoRedesign ? "bg-[#202633] text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]" : "border-[#bae6fd] bg-[#e8f7ff] text-[#0284c7] shadow-sm" : videoRedesign ? "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]" : "border-black/[0.06] bg-white/78 text-[#667085] hover:bg-white hover:text-[#202633]"}`}>{t(`studio.workflow.${workflow}`)}</button>;
            })}
          </div>
        ) : mode === "audio" ? (
          <div className={audioRedesign ? "grid w-full max-w-[560px] grid-cols-2 gap-1 overflow-visible rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)] sm:rounded-full" : "grid w-full max-w-[560px] grid-cols-2 rounded-full border border-black/[0.06] bg-white/82 p-1 shadow-sm sm:w-auto"}>
            {(["text-to-audio", "text-to-music"] as AudioWorkflow[]).map((workflow) => <button key={workflow} type="button" onClick={() => onWorkflowChange(workflow)} className={`${audioRedesign ? "min-w-0 rounded-[17px] px-4 py-[13px] text-sm font-black sm:rounded-full" : "rounded-full px-5 py-2.5 text-sm font-semibold"} transition ${audioWorkflow === workflow ? "bg-[#202633] text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]" : "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"}`}>{t(`studio.workflow.${workflow}`)}</button>)}
          </div>
        ) : mode === "avatar" ? (
          <div className="inline-flex rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)]"><button type="button" className="min-w-[172px] rounded-[17px] bg-[#202633] px-5 py-[13px] text-sm font-black text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]">{t("studio.avatarWorkbench.tab")}</button></div>
        ) : null}
      </div>
    </>
  );
}
