"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { estimateGenerationCredits } from "../../lib/model-pricing";
import { VideoExampleCard } from "./video-example-card";
import {
  VIDEO_PROVIDER_META,
  type StudioVideoWorkflow,
  type VideoExample,
  videoExampleFor,
  videoModelBadge,
  videoModelDefaultResolution,
  videoModelGroup
} from "./video-models";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type PromptShowcase = {
  videoUrl: string;
  posterUrl: string;
  prompt: string;
  duration: string;
};

type VideoSettingsProps = {
  workflow: StudioVideoWorkflow;
  provider: string;
  providerOptions: Array<{ value: string; label: string }>;
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
  estimatedCredits: number;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  promptShowcases: PromptShowcase[];
  translate: Translate;
  onProviderChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onGenerateAudioChange: (value: boolean) => void;
  onUseModelExample: (example: VideoExample, prompt: string) => void;
  onUsePromptShowcase: (showcase: PromptShowcase) => void;
  onGenerate: () => void;
};

function VideoModelSelector({
  workflow,
  provider,
  providerOptions,
  duration,
  translate,
  onProviderChange
}: Pick<VideoSettingsProps, "workflow" | "provider" | "providerOptions" | "duration" | "translate" | "onProviderChange">) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selectedMeta = VIDEO_PROVIDER_META[provider] || {
    label: providerOptions.find((option) => option.value === provider)?.label || provider,
    shortLabel: provider,
    speed: "Standard",
    quality: "Balanced",
    bestFor: "General generation"
  };
  const groups = [
    { key: "freeDraft", label: translate("studio.modelSelect.group.freeDraft") },
    { key: "betterQuality", label: translate("studio.modelSelect.group.betterQuality") },
    { key: "premium", label: translate("studio.modelSelect.group.premium") }
  ] as const;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative z-[70] w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[58px] w-full items-center justify-between gap-4 rounded-[18px] border border-[#758bac]/20 bg-white px-5 text-left text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none transition hover:bg-[#fbfdff] sm:min-h-[45px] sm:w-auto sm:min-w-[240px] sm:rounded-full"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block min-w-0 truncate">{selectedMeta.label}</span>
        <span className={`shrink-0 text-base transition ${open ? "rotate-180" : ""}`}>v</span>
      </button>

      {open ? createPortal(
        <>
          <button type="button" aria-label={translate("studio.modelSelect.close")} onClick={() => setOpen(false)} className="fixed inset-0 z-[190] cursor-default bg-[#111827]/55 backdrop-blur-[2px]" />
          <div ref={panelRef} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} className="fixed inset-x-3 bottom-3 z-[200] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-[#758bac]/20 bg-white text-[#263244] shadow-[0_24px_70px_rgba(8,20,42,0.35)] sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[min(76vh,620px)] sm:w-[min(calc(100vw-2rem),640px)] sm:-translate-x-1/2 sm:-translate-y-1/2" role="listbox">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dce5f0] bg-white px-5 py-3 sm:hidden">
              <div>
                <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#8c9ab0]">{translate("studio.modelSelect.current")}</span>
                <strong className="mt-1 block text-lg font-black text-[#263244]">{selectedMeta.label}</strong>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-[#eef3f9] text-xl font-bold text-[#526176]" aria-label={translate("studio.modelSelect.close")}>x</button>
            </div>

            {groups.map((group) => {
              const options = providerOptions.filter((option) => videoModelGroup(option.value) === group.key);
              if (!options.length) return null;
              return (
                <div key={group.key}>
                  <div className="border-y border-[#e4eaf2] bg-[#f3f6fa] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#8795aa] sm:py-3">{group.label}</div>
                  {options.map((option) => {
                    const meta = VIDEO_PROVIDER_META[option.value] || { label: option.label };
                    const active = provider === option.value;
                    const credits = estimateGenerationCredits({
                      mode: "video",
                      provider: option.value,
                      duration,
                      hasReferences: workflow === "image-to-video",
                      resolution: videoModelDefaultResolution(option.value),
                      promptText: undefined
                    });
                    const badge = videoModelBadge(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onProviderChange(option.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-4 border-b border-[#e2e8f0] px-5 py-3 text-left transition hover:bg-[#f5f9ff] sm:py-4 ${active ? "bg-[#eaf4ff] shadow-[inset_4px_0_0_#2585e8]" : "bg-white"}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-[15px] font-black text-[#263244]">{meta.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-[#7f8ca3]">{translate(`studio.modelSelect.desc.${option.value}`)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                          {active ? <span className="rounded-full bg-[#1677d2] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">{translate("studio.modelSelect.active")}</span> : null}
                          {option.value !== "dreamface-io-video" ? <span className="text-xs font-bold text-[#64748b]">{translate("studio.modelSelect.credits", { credits })}</span> : null}
                          {badge ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${badge === "free" ? "bg-[#eef2f7] text-[#536071]" : badge === "recommended" ? "bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white" : badge === "pro" ? "bg-[#f3e8ff] text-[#7e22ce]" : "bg-[#fff4ce] text-[#9a6412]"}`}>
                              {translate(`studio.modelSelect.badge.${badge}`)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>,
        document.body
      ) : null}
    </div>
  );
}

function PromptShowcaseGrid({
  showcases,
  copyLabel,
  onUse
}: {
  showcases: PromptShowcase[];
  copyLabel: string;
  onUse: (showcase: PromptShowcase) => void;
}) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  return (
    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {showcases.map((showcase, index) => (
        <article key={showcase.videoUrl} className="group relative overflow-hidden rounded-[22px] border border-[#758bac]/15 bg-[#e7eef5] shadow-[0_12px_30px_rgba(35,58,97,0.08)]">
          <video src={showcase.videoUrl} poster={showcase.posterUrl} controls muted playsInline preload="none" onPlay={() => setPlayingIndex(index)} onPause={() => setPlayingIndex(null)} onEnded={() => setPlayingIndex(null)} className="aspect-video w-full bg-black object-cover" />
          <div className={`pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-t from-[#0b1528]/75 via-transparent to-transparent p-3 transition sm:flex ${playingIndex === index ? "opacity-0" : "opacity-0 sm:group-hover:opacity-100"}`}>
            <button type="button" onClick={() => onUse(showcase)} className="pointer-events-auto inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white/95 px-4 text-sm font-black text-[#2468ad] shadow-[0_8px_22px_rgba(3,16,38,0.2)] backdrop-blur transition hover:bg-white">{copyLabel}</button>
          </div>
          <div className="border-t border-[#758bac]/12 bg-white p-3 sm:hidden">
            <button type="button" onClick={() => onUse(showcase)} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#eef7ff] px-4 text-sm font-black text-[#2468ad] transition active:bg-[#e1f0ff]">{copyLabel}</button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function VideoSettings({
  workflow,
  provider,
  providerOptions,
  duration,
  durationOptions,
  ratio,
  ratioOptions,
  ratioDisabled,
  showResolutionControl,
  resolution,
  resolutionOptions,
  showAudioControl,
  generateAudio,
  estimatedCredits,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  promptShowcases,
  translate,
  onProviderChange,
  onDurationChange,
  onRatioChange,
  onResolutionChange,
  onGenerateAudioChange,
  onUseModelExample,
  onUsePromptShowcase,
  onGenerate
}: VideoSettingsProps) {
  const activeExample = videoExampleFor(provider, workflow);
  const controlClass = "min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none";

  return (
    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <VideoModelSelector workflow={workflow} provider={provider} providerOptions={providerOptions} duration={duration} translate={translate} onProviderChange={onProviderChange} />
          <select value={duration} onChange={(event) => onDurationChange(event.target.value)} className={controlClass}>{durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={ratio} onChange={(event) => onRatioChange(event.target.value)} disabled={ratioDisabled} className={`${controlClass} disabled:opacity-70`}>{ratioOptions.map((item) => <option key={item} value={item}>{item === "source" ? translate("studio.option.sourceImage") : item}</option>)}</select>
          {showResolutionControl ? <select value={resolution} onChange={(event) => onResolutionChange(event.target.value)} className={controlClass}>{resolutionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select> : null}
          {showAudioControl ? <button type="button" onClick={() => onGenerateAudioChange(!generateAudio)} className={`inline-flex min-h-[45px] items-center rounded-full border px-5 text-base font-black shadow-[0_8px_24px_rgba(42,67,112,0.08)] ${generateAudio ? "border-[#20c997]/25 bg-[#20c997]/10 text-[#17916e]" : "border-[#758bac]/15 bg-white text-[#66758b]"}`}>{translate("studio.field.nativeAudio")}: {translate(generateAudio ? "studio.state.on" : "studio.state.off")}</button> : null}
          <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">{estimatedCredits} {translate("studio.common.credits")}</span>
        </div>
        <button type="button" onClick={onGenerate} disabled={generateDisabled} className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]">
          <span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span>
          {isAuthenticated ? <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">{estimatedCredits} {translate("studio.common.credits")}</span> : null}
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
        </button>
      </div>

      {activeExample ? (
        <VideoExampleCard
          example={activeExample}
          labels={{
            outputVideo: translate("studio.geminiOmni.outputVideo"),
            textTitle: translate("studio.geminiOmni.textExampleTitle"),
            imageTitle: translate("studio.geminiOmni.imageExampleTitle"),
            sourceImage: translate("studio.geminiOmni.sourceImage"),
            audio: translate("studio.geminiOmni.audio"),
            resolution: translate("studio.field.resolution"),
            useExample: translate("studio.geminiOmni.useExample")
          }}
          onUse={(prompt) => onUseModelExample(activeExample, prompt)}
        />
      ) : null}

      {workflow === "text-to-video" ? <PromptShowcaseGrid showcases={promptShowcases} copyLabel={translate("studio.projects.copyPrompt")} onUse={onUsePromptShowcase} /> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: "$", title: translate("studio.textImage.hintCostTitle"), body: translate("studio.videoWorkbench.hintCostBody") },
          { icon: "@", title: translate(workflow === "image-to-video" ? "studio.videoWorkbench.hintReferenceTitle" : "studio.videoWorkbench.hintPromptTitle"), body: translate(workflow === "image-to-video" ? "studio.videoWorkbench.hintReferenceBody" : "studio.videoWorkbench.hintPromptBody") },
          { icon: "*", title: translate("studio.videoWorkbench.hintOutputTitle"), body: translate("studio.videoWorkbench.hintOutputBody") }
        ].map((card) => (
          <div key={card.title} className="grid min-h-[74px] grid-cols-[36px_1fr] items-start gap-3 rounded-[22px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-3.5 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
            <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,138,0,0.13),rgba(255,61,129,0.13))]">{card.icon}</span>
            <span><strong className="block text-[13px] font-black text-[#33405a]">{card.title}</strong><span className="mt-1 block text-xs font-bold leading-[1.35] text-[#8390a6]">{card.body}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
