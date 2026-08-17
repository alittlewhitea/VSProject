"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { formatApproximateCreditValue } from "../../lib/billing";
import { GenerationCostSummary } from "./generation-cost-summary";
import type { TaskItem } from "./studio-storage";
import type { StudioVideoWorkflow } from "./video-models";
import { ModelPicker, type ModelPickerOption } from "./model-picker";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type PromptShowcase = {
  videoUrl: string;
  posterUrl: string;
  prompt: string;
  duration: string;
};

type VideoSettingsProps = {
  workflow: StudioVideoWorkflow;
  prompt: string;
  referenceImageUrls: string[];
  provider: string;
  providerOptions: ModelPickerOption[];
  duration: string;
  durationOptions: string[];
  ratio: string;
  ratioOptions: string[];
  ratioDisabled: boolean;
  showResolutionControl: boolean;
  resolution: string;
  resolutionOptions: string[];
  showAudioControl: boolean;
  generateAudio: boolean;
  seed: string;
  estimatedCredits: number;
  creditBalance: number | null;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  promptShowcases: PromptShowcase[];
  recentTasks: TaskItem[];
  translate: Translate;
  onPromptChange: (value: string) => void;
  onReferenceClear: () => void;
  onReferenceFiles: (files: FileList | null) => Promise<void>;
  onFileError: () => void;
  onProviderChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onGenerateAudioChange: (value: boolean) => void;
  onSeedChange: (value: string) => void;
  onUsePromptShowcase: (showcase: PromptShowcase) => void;
  onGenerate: () => void;
};

const PRESETS = [
  { id: "cinematic", label: "Cinematic", icon: "\uD83C\uDFAC", ratio: "16:9", showcaseIndex: 0, title: "Urban Dance", prompt: "A young woman adjusts her hair on a rooftop at golden hour, cinematic framing, soft handheld motion, warm sunlight, natural skin texture, shallow depth of field, subtle film grain, realistic mood." },
  { id: "product", label: "Product Promo", icon: "\uD83E\uDDF4", ratio: "4:3", showcaseIndex: 1, title: "Product Promo", prompt: "A premium skincare bottle on a stone pedestal, soft studio daylight, elegant camera dolly in, minimal luxury composition, crisp highlights, clean shadows, realistic glass reflections, commercial ad style." },
  { id: "lifestyle", label: "Lifestyle Vlog", icon: "\u2600\uFE0F", ratio: "16:9", showcaseIndex: 1, title: "Summer Vibes", prompt: "A cheerful travel vlog scene on a beach promenade, relaxed summer outfit, bright natural daylight, light walking camera, candid expression, airy lifestyle mood, realistic colors, influencer video style." },
  { id: "cyberpunk", label: "Cyberpunk", icon: "\uD83C\uDF03", ratio: "16:9", showcaseIndex: 2, title: "Neon City", prompt: "A futuristic neon city street at night after rain, reflective pavement, glowing signs, slow cinematic push-in, cool blue and magenta lighting, atmospheric haze, high detail, cyberpunk aesthetic." },
  { id: "minimal", label: "Minimal", icon: "\u2728", ratio: "16:9", showcaseIndex: 0, title: "Nature Escape", prompt: "A quiet mountain landscape with a lone figure, clean composition, slow aerial drift, soft clouds, muted color palette, minimal framing, serene mood, highly realistic environmental detail." }
] as const;

function formatTaskDate(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function taskDuration(task: TaskItem, fallback: string) {
  const value = task.settings?.duration;
  return typeof value === "string" ? value : fallback;
}

export function VideoSettings({
  workflow, prompt, referenceImageUrls, provider, providerOptions, duration, durationOptions, ratio, ratioOptions,
  ratioDisabled, showResolutionControl, resolution, resolutionOptions, showAudioControl, generateAudio, seed,
  estimatedCredits, creditBalance, generateDisabled, isSubmitting, isAuthenticated, promptShowcases, recentTasks, translate,
  onPromptChange, onReferenceClear, onReferenceFiles, onFileError, onProviderChange,
  onDurationChange, onRatioChange, onResolutionChange, onGenerateAudioChange, onSeedChange,
  onUsePromptShowcase, onGenerate
}: VideoSettingsProps) {
  const [activePreset, setActivePreset] = useState("cinematic");
  const [selectedShowcaseIndex, setSelectedShowcaseIndex] = useState(0);
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selectedShowcase = promptShowcases[selectedShowcaseIndex] || promptShowcases[0];
  const videoTasks = useMemo(() => recentTasks.filter((task) => task.type === "Video").slice(0, 5), [recentTasks]);

  const addReferenceFiles = (files: FileList | null) => onReferenceFiles(files).catch(onFileError);
  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.id);
    onPromptChange(preset.prompt);
    if (!ratioDisabled && ratioOptions.includes(preset.ratio)) onRatioChange(preset.ratio);
    if (promptShowcases.length) setSelectedShowcaseIndex(preset.showcaseIndex % promptShowcases.length);
  };
  const useShowcase = (showcase: PromptShowcase, index: number) => {
    setSelectedShowcaseIndex(index);
    onUsePromptShowcase(showcase);
  };
  const enhancePrompt = () => {
    const base = prompt.trim() || PRESETS[0].prompt;
    const suffix = "cinematic composition, intentional camera movement, natural lighting, realistic detail, polished color grading";
    onPromptChange(base.toLowerCase().includes("cinematic composition") ? base : `${base.replace(/[.\s]+$/, "")}, ${suffix}.`);
  };
  const inspire = () => {
    const currentIndex = PRESETS.findIndex((preset) => preset.id === activePreset);
    applyPreset(PRESETS[(currentIndex + 1) % PRESETS.length]);
  };

  return (
    <div className="w-full max-w-full text-start">
      <div className="grid min-w-0 grid-cols-1 gap-[14px] xl:grid-cols-[minmax(450px,0.84fr)_minmax(520px,1.16fr)]">
        <section className="flex min-h-[550px] min-w-0 flex-col rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5"><label htmlFor="video-studio-prompt" className="shrink-0 text-sm font-bold text-[#101828]">{translate("studio.field.prompt")}</label><span className="truncate text-xs text-[#667085]">{translate("studio.workbench.promptDetail")}</span></div>
            <span className="shrink-0 text-xs tabular-nums text-[#98a2b3]">{translate("studio.workbench.characters", { count: prompt.length.toLocaleString() })}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white">
            <textarea id="video-studio-prompt" value={prompt} onChange={(event) => onPromptChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onGenerate(); } }} placeholder={translate(workflow === "image-to-video" ? "studio.placeholder.imageVideo" : "studio.placeholder.video")} className="h-[150px] w-full resize-none border-0 bg-transparent p-4 text-[15px] leading-[1.55] text-[#101828] outline-none placeholder:text-[#98a2b3]" />
            {workflow === "image-to-video" && referenceImageUrls.length ? (
              <div className="mx-3 mb-2 flex items-center gap-2 overflow-x-auto rounded-xl bg-[#f8f7ff] p-2">
                {referenceImageUrls.slice(0, 4).map((url, index) => <img key={`${url}-${index}`} src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />)}
                <button type="button" onClick={onReferenceClear} className="ms-auto min-h-10 shrink-0 px-2 text-[11px] font-bold text-[#6a5af9]">{translate("studio.action.clear")}</button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              <button type="button" onClick={enhancePrompt} className="min-h-10 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#fafafb]">{"\u2726"} {translate("studio.workbench.enhancePrompt")}</button>
              <button type="button" onClick={inspire} className="min-h-10 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#fafafb]">{"\uD83D\uDCA1"} {translate("studio.workbench.inspire")}</button>
              <button type="button" onClick={() => onPromptChange("")} disabled={!prompt.length} className="min-h-10 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-semibold text-[#667085] transition hover:border-[#d8d2ff] hover:bg-[#faf9ff] hover:text-[#6651ee] disabled:cursor-not-allowed disabled:opacity-45"><span aria-hidden="true">{"\u21ba"}</span> {translate("studio.action.clear")}</button>
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#fafafb]">+ {translate("studio.videoWorkbench.referenceImage")}<input type="file" accept="image/*" className="hidden" onChange={(event) => addReferenceFiles(event.target.files)} /></label>
            </div>
          </div>

          <div className="mt-3.5"><div className="mb-2 text-xs font-bold text-[#475467]">{translate("studio.workbench.presets")}</div><div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className={`flex min-h-10 items-center gap-1.5 rounded-[10px] border px-3 text-xs font-semibold transition ${activePreset === preset.id ? "border-[#cfc9ff] bg-[#faf9ff] text-[#6a5af9] shadow-[inset_0_0_0_1px_#e4e0ff]" : "border-[#eaecf0] bg-white text-[#475467] hover:border-[#d9d6ff] hover:bg-[#fbfbff]"}`}><span>{preset.icon}</span><span>{translate(`studio.workbench.preset.${preset.id}`)}</span></button>)}
          </div></div>

          <div className="my-3.5 h-px bg-[#f1f3f7]" /><div className="mb-2.5 flex items-center justify-between gap-3"><span className="text-xs font-bold text-[#475467]">{translate("studio.workbench.settings")}</span><span className="text-[10px] font-bold text-[#8f80ff]">{translate("studio.workbench.exploreModels")}</span></div>
          <ModelPicker value={provider} options={providerOptions} translate={translate} onChange={onProviderChange} />
          <div className="border-b border-[#f1f3f7]">
            <label className="mt-3 block min-w-0 pb-3"><span className="mb-1.5 block text-[10px] text-[#667085]">{translate("studio.field.duration")}</span><select value={duration} onChange={(event) => onDurationChange(event.target.value)} className="min-h-10 w-full border-0 bg-transparent text-[13px] font-bold text-[#101828] outline-none">{durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <div className="min-w-0 border-t border-[#f1f3f7] py-3"><span className="mb-2 block text-[10px] text-[#667085]">{translate("studio.field.aspectRatio")}</span><div className="grid grid-cols-3 gap-1.5 min-[430px]:grid-cols-4">{ratioOptions.map((item) => <button key={item} type="button" disabled={ratioDisabled} onClick={() => onRatioChange(item)} className={`min-h-10 min-w-0 w-full rounded-[9px] border px-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${ratio === item ? "border-[#8d80ff] bg-white text-[#101828] shadow-[0_0_0_2px_#efecff]" : "border-[#eaecf0] bg-white text-[#475467] hover:border-[#d6d9e1]"}`}><span className="me-1">{item.includes("9:16") ? "\u25AF" : item === "1:1" ? "\u25A1" : "\u25AD"}</span>{item === "source" ? translate("studio.option.sourceImage") : item}</button>)}</div></div>
          </div>

          <div className={`mt-2.5 grid grid-cols-2 gap-y-3 ${showAudioControl ? "md:grid-cols-[0.8fr_0.8fr_1.2fr]" : "md:grid-cols-2"}`}>
            <label className="min-w-0 border-e border-[#f1f3f7] pe-3"><span className="mb-1.5 block text-[10px] text-[#667085]">{translate("studio.field.quality")}</span>{showResolutionControl ? <select value={resolution} onChange={(event) => onResolutionChange(event.target.value)} className="min-h-10 w-full border-0 bg-transparent text-[13px] font-bold text-[#101828] outline-none">{resolutionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <span className="inline-flex min-h-10 items-center text-[13px] font-bold text-[#101828]">{resolution || translate("studio.option.automatic")}</span>}</label>
            <label className={`min-w-0 px-3 ${showAudioControl ? "md:border-e md:border-[#f1f3f7]" : ""}`}><span className="mb-1.5 block text-[10px] text-[#667085]">{translate("studio.field.seed")}</span><input value={seed} onChange={(event) => onSeedChange(event.target.value.replace(/[^\d]/g, "").slice(0, 12))} placeholder={translate("studio.placeholder.random")} inputMode="numeric" className="min-h-10 w-full border-0 bg-transparent text-[13px] font-bold text-[#101828] outline-none placeholder:text-[#101828]" /></label>
            {showAudioControl ? <div className="col-span-2 flex min-w-0 items-end md:col-span-1 md:ps-3"><button type="button" onClick={() => setMoreSettingsOpen((value) => !value)} className="min-h-11 w-full rounded-[10px] border border-[#eaecf0] bg-white px-2 text-xs font-semibold text-[#344054]">{"\u2637"} &nbsp; {translate(moreSettingsOpen ? "studio.workbench.lessSettings" : "studio.workbench.moreSettings")}</button></div> : null}
          </div>

          {moreSettingsOpen && showAudioControl ? <div className="mt-3 rounded-xl border border-[#eaecf0] bg-[#fcfcfe] p-3"><button type="button" onClick={() => onGenerateAudioChange(!generateAudio)} className={`flex min-h-11 w-full items-center justify-between rounded-[10px] border px-3 text-xs font-semibold ${generateAudio ? "border-[#cfc9ff] bg-[#f3f0ff] text-[#6a5af9]" : "border-[#eaecf0] bg-white text-[#475467]"}`}><span>{translate("studio.field.nativeAudio")}</span><span>{translate(generateAudio ? "studio.state.on" : "studio.state.off")}</span></button></div> : null}

          <div className="relative mt-auto pt-4"><button type="button" onClick={onGenerate} disabled={generateDisabled} className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl bg-[linear-gradient(90deg,#744bfb,#6757f6_55%,#7d53ff)] text-[15px] font-extrabold text-white shadow-[0_10px_24px_rgba(106,90,249,0.2)] transition hover:-translate-y-px hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-55"><span>{"\u2723"}</span><span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span><span className="inline-flex h-6 items-center rounded-full bg-white/20 px-2.5 text-[11px] font-bold">{estimatedCredits} {translate("studio.common.credits")} · ≈{formatApproximateCreditValue(estimatedCredits)}</span></button><span className="pointer-events-none absolute end-3 top-[29px] hidden text-[11px] font-semibold text-white/70 sm:block">Enter {"\u21B5"}</span><GenerationCostSummary estimatedCredits={estimatedCredits} creditBalance={creditBalance} translate={translate} /></div>
        </section>

        <section className="min-h-[550px] min-w-0 overflow-hidden rounded-[20px] border border-[#eaecf0] bg-white/95 p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5"><div className="flex items-center gap-2 text-xs font-bold text-[#667085]"><span>{duration}</span><span className="text-[#c0c4ce]">{"\u2022"}</span><span>{ratio === "source" ? translate("studio.option.sourceImage") : ratio}</span></div><div className="flex gap-1.5 sm:gap-2">{selectedShowcase ? <a href={selectedShowcase.videoUrl} target="_blank" rel="noreferrer" aria-label={translate("studio.workbench.openPreview")} className="inline-flex h-11 items-center gap-1 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{"\u2197"}<span className="hidden sm:inline">{translate("studio.workbench.openPreview")}</span></a> : null}<button type="button" aria-label={translate("studio.workbench.fullscreen")} onClick={() => videoRef.current?.requestFullscreen?.().catch(() => null)} className="grid h-11 min-w-11 place-items-center rounded-[10px] border border-[#eaecf0] bg-white px-2 text-sm text-[#344054]">{"\u26F6"}</button></div></div>
          {selectedShowcase ? <video ref={videoRef} key={selectedShowcase.videoUrl} src={selectedShowcase.videoUrl} poster={selectedShowcase.posterUrl} controls muted playsInline preload="metadata" className="aspect-video w-full rounded-xl border border-[#191919] bg-[#121212] object-cover sm:aspect-[16/8.1] sm:rounded-2xl" /> : <div className="grid aspect-video place-items-center rounded-xl bg-[#121212] text-sm font-semibold text-white/65 sm:aspect-[16/8.1] sm:rounded-2xl">{translate("studio.workbench.videoPreview")}</div>}
          <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5 sm:gap-2.5"><button type="button" aria-label={translate("studio.workbench.previous")} onClick={() => setSelectedShowcaseIndex((selectedShowcaseIndex - 1 + promptShowcases.length) % Math.max(1, promptShowcases.length))} className="h-11 w-11 rounded-full border border-[#eaecf0] bg-white text-[#475467]">{"\u2039"}</button><div className="grid min-w-0 grid-cols-3 gap-1.5 p-0.5 sm:flex sm:gap-2.5 sm:overflow-x-auto">{promptShowcases.map((showcase, index) => <button key={showcase.videoUrl} type="button" onClick={() => useShowcase(showcase, index)} className={`relative aspect-video min-w-0 w-full overflow-hidden rounded-[8px] border bg-[#f6f7fb] transition hover:-translate-y-px sm:min-w-[128px] sm:flex-1 sm:rounded-[10px] ${selectedShowcaseIndex === index ? "border-white shadow-[0_0_0_2px_#7a6cff]" : "border-[#eaecf0]"}`}><img src={showcase.posterUrl} alt="" className="h-full w-full object-cover" /><span className="absolute start-1 top-1 rounded-md bg-white/90 px-1 py-0.5 text-[8px] font-extrabold text-[#344054] sm:start-1.5 sm:top-1.5 sm:px-1.5 sm:py-1 sm:text-[9px]">{showcase.duration}</span></button>)}</div><button type="button" aria-label={translate("studio.workbench.next")} onClick={() => setSelectedShowcaseIndex((selectedShowcaseIndex + 1) % Math.max(1, promptShowcases.length))} className="h-11 w-11 rounded-full border border-[#eaecf0] bg-white text-[#475467]">{"\u203A"}</button></div>
        </section>
      </div>

      <section className="mt-4 rounded-[20px] border border-[#eaecf0] bg-white/95 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.035)]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 items-center gap-2.5"><strong className="shrink-0 text-[15px] text-[#101828]">{translate("studio.workbench.recent")}</strong><span className="truncate text-xs text-[#667085]">{translate("studio.workbench.latest")}</span></div><Link href="/studio?view=projects" className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#344054]">{translate("studio.workbench.allProjects")} {"\u2304"}</Link></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {videoTasks.length ? videoTasks.map((task) => <Link key={task.id} href={`/studio?view=projects&taskId=${encodeURIComponent(task.id)}`} className="min-w-0"><div className="relative aspect-video overflow-hidden rounded-xl border border-[#eaecf0] bg-[#f6f7fb]">{task.mediaUrl ? <video src={task.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs font-semibold text-[#98a2b3]">{translate(`studio.task.${task.status.toLowerCase()}`)}</div>}<span className="absolute start-2.5 top-2 inline-flex h-[22px] items-center rounded-lg bg-white/90 px-2 text-[10px] font-extrabold text-[#344054]">{taskDuration(task, duration)}</span><span className="absolute bottom-3 start-3 grid h-[30px] w-[30px] place-items-center rounded-full bg-black/55 text-[11px] text-white">{"\u25B6"}</span></div><div className="mt-2 text-[13px] font-bold text-[#101828]"><span className="block truncate">{task.title || task.prompt || "AI Video"}</span></div><div className="mt-1 text-[11px] text-[#98a2b3]">{formatTaskDate(task.createdAt)}</div></Link>) : PRESETS.map((preset, index) => { const showcase = promptShowcases[preset.showcaseIndex % Math.max(1, promptShowcases.length)]; return <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="min-w-0 text-start"><div className="relative aspect-video overflow-hidden rounded-xl border border-[#eaecf0] bg-[#f6f7fb]">{showcase ? <img src={showcase.posterUrl} alt="" className="h-full w-full object-cover" /> : null}<span className="absolute start-2.5 top-2 inline-flex h-[22px] items-center rounded-lg bg-white/90 px-2 text-[10px] font-extrabold text-[#344054]">{index === 1 ? "10s" : "5s"}</span><span className="absolute bottom-3 start-3 grid h-[30px] w-[30px] place-items-center rounded-full bg-black/55 text-[11px] text-white">{"\u25B6"}</span></div><div className="mt-2 text-[13px] font-bold text-[#101828]"><span className="block truncate">{translate(`studio.workbench.preset.${preset.id}`)}</span></div><div className="mt-1 text-[11px] text-[#98a2b3]">{translate("studio.workbench.sampleVideo")}</div></button>; })}
        </div>
      </section>
    </div>
  );
}
