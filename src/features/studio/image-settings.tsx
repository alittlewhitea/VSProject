"use client";

import { useState } from "react";
import { StudioSelectField } from "./studio-primitives";
import { isGptImageProvider, GPT_IMAGE_SIZES, type GptImageOptions, type GptImageQuality } from "../../lib/gpt-image-models";
import { GptImageControls } from "./gpt-image-controls";
import { StudioComposerGenerate } from "./studio-composer-controls";
import { GenerationCostSummary } from "./generation-cost-summary";
import { ModelPicker, type ModelPickerOption } from "./model-picker";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type ImageSizePreset = { value: string; label: string };
type ImageQuality = GptImageQuality;

type ImageSettingsProps = {
  provider: string;
  gptOptions: GptImageOptions;
  referenceImageUrls: string[];
  onGptOptionsChange: (value:GptImageOptions)=>void;
  gptValidationError?: string | null;
  providerOptions: ModelPickerOption[];
  utilityWorkflow: "enhance-cleanup" | "background-remove" | null;
  isImageToImage: boolean;
  isNanoBanana: boolean;
  isNanoBananaLite: boolean;
  ratio: string;
  ratioOptions: string[];
  imageSize: string;
  imageSizePresets: ImageSizePreset[];
  outputFormat: string;
  imageQuality: ImageQuality;
  editResolution: string;
  numInferenceSteps: number;
  guidanceScale: number;
  numImages: number;
  seed: string;
  enableSafetyChecker: boolean;
  acceleration: string;
  safetyTolerance: string;
  limitGenerations: boolean;
  enableWebSearch: boolean;
  thinkingLevel: string;
  systemPrompt: string;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  estimatedCredits: number;
  creditBalance: number | null;
  translate: Translate;
  onProviderChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onImageSizeChange: (value: string) => void;
  onOutputFormatChange: (value: string) => void;
  onImageQualityChange: (value: ImageQuality) => void;
  onEditResolutionChange: (value: string) => void;
  onNumInferenceStepsChange: (value: number) => void;
  onGuidanceScaleChange: (value: number) => void;
  onNumImagesChange: (value: number) => void;
  onSeedChange: (value: string) => void;
  onEnableSafetyCheckerChange: (value: boolean) => void;
  onAccelerationChange: (value: string) => void;
  onSafetyToleranceChange: (value: string) => void;
  onLimitGenerationsChange: (value: boolean) => void;
  onEnableWebSearchChange: (value: boolean) => void;
  onThinkingLevelChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
  onGenerate: () => void;
};

function SettingCard({
  label,
  value,
  className = "",
  children
}: {
  label: string;
  value: string | number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-[var(--studio-muted)]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      {children}
    </div>
  );
}

function ChoiceButtons({
  values,
  selected,
  columns,
  uppercase = false,
  onChange
}: {
  values: Array<{ value: string; label?: string }>;
  selected: string;
  columns: number;
  uppercase?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {values.map((item) => (
        <button
          key={item.value || "off"}
          type="button"
          onClick={() => onChange(item.value)}
          className={`min-h-10 min-w-0 rounded-[8px] px-1 text-[10px] font-bold transition ${uppercase ? "uppercase" : ""} ${
            selected === item.value
              ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)] shadow-none"
              : "bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
          }`}
        >
          {item.label ?? item.value}
        </button>
      ))}
    </div>
  );
}

export function ImageSettings({
  provider,
  gptOptions, referenceImageUrls, onGptOptionsChange, gptValidationError,
  providerOptions,
  utilityWorkflow,
  isImageToImage,
  isNanoBanana,
  isNanoBananaLite,
  ratio,
  ratioOptions,
  imageSize,
  imageSizePresets,
  outputFormat,
  imageQuality,
  editResolution,
  numInferenceSteps,
  guidanceScale,
  numImages,
  seed,
  enableSafetyChecker,
  acceleration,
  safetyTolerance,
  limitGenerations,
  enableWebSearch,
  thinkingLevel,
  systemPrompt,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  estimatedCredits,
  creditBalance,
  translate,
  onProviderChange,
  onRatioChange,
  onImageSizeChange,
  onOutputFormatChange,
  onImageQualityChange,
  onEditResolutionChange,
  onNumInferenceStepsChange,
  onGuidanceScaleChange,
  onNumImagesChange,
  onSeedChange,
  onEnableSafetyCheckerChange,
  onAccelerationChange,
  onSafetyToleranceChange,
  onLimitGenerationsChange,
  onEnableWebSearchChange,
  onThinkingLevelChange,
  onSystemPromptChange,
  onGenerate
}: ImageSettingsProps) {
  const isUtility = utilityWorkflow !== null;
  const isFlux = provider === "flux-image" || provider === "flux-dev";
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [gptGuideBusy,setGptGuideBusy]=useState(false);

  return (
    <div className="df-image-settings df-composer-settings" data-utility-workflow={utilityWorkflow || undefined}>
      <div className="df-composer-toolbar">
      {!isUtility || providerOptions.length > 1 ? <ModelPicker inline value={provider} options={providerOptions} translate={translate} onChange={onProviderChange} /> : null}
        <div className="df-composer-parameters" data-image-parameters>
          {utilityWorkflow === "enhance-cleanup" ? (
            <StudioSelectField icon="format" label={translate("studio.field.outputFormat")} value={outputFormat === "png" ? "png" : "jpeg"} options={[{ value: "jpeg", label: "JPEG" }, { value: "png", label: "PNG" }]} onValueChange={onOutputFormatChange} />
          ) : !isUtility && isNanoBanana ? (
            <StudioSelectField icon="ratio" label={translate("studio.field.aspectRatio")} value={ratio} options={ratioOptions.map(value => ({ value, label: value === "auto" ? translate("studio.option.autoRatio") : value }))} onValueChange={onRatioChange} />
          ) : !isUtility ? (
            <StudioSelectField icon="resolution" label={translate("studio.field.resolution")} value={imageSize} options={isGptImageProvider(provider)?[...GPT_IMAGE_SIZES,{value:"auto",label:translate("studio.option.automatic")},{value:"custom",label:translate("studio.gpt26.customSize")}]:imageSizePresets} onValueChange={value=>{onImageSizeChange(value);if(value==="custom")setMoreSettingsOpen(true);}} />
          ) : null}
        </div>

      {!isUtility ? <button type="button" onClick={() => setMoreSettingsOpen((value) => !value)} data-image-advanced-trigger aria-expanded={moreSettingsOpen} className="df-composer-more">{"\u2637"} &nbsp; {translate(moreSettingsOpen ? "studio.workbench.lessSettings" : "studio.workbench.moreSettings")}</button> : null}
        <StudioComposerGenerate disabled={generateDisabled||gptGuideBusy} submitting={isSubmitting} authenticated={isAuthenticated} credits={estimatedCredits} translate={translate} onGenerate={onGenerate}/>
      </div>
      <GenerationCostSummary compact estimatedCredits={estimatedCredits} creditBalance={creditBalance} translate={translate}/>
      {gptValidationError?<p role="alert" data-gpt-validation className="df-composer-validation">{translate(gptValidationError)}</p>:null}
      {!isUtility && moreSettingsOpen ? <div data-image-advanced className="df-composer-advanced grid gap-2 sm:grid-cols-2">
        {isGptImageProvider(provider) ? (
          <GptImageControls options={gptOptions} onChange={onGptOptionsChange} imageSize={imageSize} imageQuality={imageQuality} onQualityChange={onImageQualityChange} outputFormat={outputFormat} onFormatChange={onOutputFormatChange} numImages={numImages} onCountChange={onNumImagesChange} isEdit={isImageToImage} references={referenceImageUrls} translate={translate} onBusyChange={setGptGuideBusy} />
        ) : null}

        {(provider === "nano-banana-image" || provider === "nano-banana-edit" || provider === "nano-banana-pro") ? (
          <SettingCard label={translate("studio.field.resolution")} value={editResolution}>
            <ChoiceButtons values={["1K", "2K", "4K"].map((value) => ({ value }))} selected={editResolution} columns={4} onChange={onEditResolutionChange} />
          </SettingCard>
        ) : null}

        {isFlux ? (
          <>
            <SettingCard label={translate("studio.field.steps")} value={numInferenceSteps}>
              <ChoiceButtons values={(provider === "flux-image" ? [1, 2, 4, 8, 12] : [4, 8, 16, 28, 50]).map((value) => ({ value: String(value) }))} selected={String(numInferenceSteps)} columns={5} onChange={(value) => onNumInferenceStepsChange(Number(value))} />
            </SettingCard>
            <SettingCard label={translate("studio.field.guidance")} value={guidanceScale}>
              <input type="range" min="1" max="20" step="0.5" value={guidanceScale} onChange={(event) => onGuidanceScaleChange(Number(event.target.value))} className="w-full accent-[var(--studio-primary)]" />
            </SettingCard>
          </>
        ) : null}

        {!isGptImageProvider(provider)?<SettingCard label={translate("studio.field.output")} value={translate("studio.field.outputFormat")}>
          <ChoiceButtons values={(isFlux ? ["jpeg", "png"] : ["png", "jpeg", "webp"]).map((value) => ({ value }))} selected={outputFormat} columns={3} uppercase onChange={onOutputFormatChange} />
        </SettingCard>:null}
        {!isGptImageProvider(provider)?<SettingCard label={translate("studio.field.count")} value={translate("studio.textImage.images")}>
          <ChoiceButtons values={[1, 2, 3, 4].map((value) => ({ value: String(value) }))} selected={String(numImages)} columns={4} onChange={(value) => onNumImagesChange(Number(value))} />
        </SettingCard>:null}
        {!isGptImageProvider(provider) ? <SettingCard label={translate("studio.field.seed")} value={translate("studio.textImage.optional")}>
          <input value={seed} onChange={(event) => onSeedChange(event.target.value.replace(/[^\d]/g, "").slice(0, 12))} placeholder={translate("studio.placeholder.random")} inputMode="numeric" className="h-10 w-full rounded-[0.9rem] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 text-sm font-semibold text-[var(--studio-muted)] outline-none placeholder:text-[var(--studio-muted)]" />
        </SettingCard> : null}

        {isFlux ? (
          <>
            <SettingCard label={translate("studio.field.safety")} value={translate(enableSafetyChecker ? "studio.state.enabled" : "studio.state.disabled")}>
              <button type="button" onClick={() => onEnableSafetyCheckerChange(!enableSafetyChecker)} className={`h-10 w-full rounded-[0.9rem] text-xs font-semibold transition ${enableSafetyChecker ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-accent-soft)] text-[var(--studio-muted)] hover:bg-[var(--studio-panel)]"}`}>{translate(enableSafetyChecker ? "studio.state.enabled" : "studio.state.disabled")}</button>
            </SettingCard>
            <SettingCard label={translate("studio.field.acceleration")} value={acceleration}>
              <ChoiceButtons values={["none", "regular", "high"].map((value) => ({ value }))} selected={acceleration} columns={3} onChange={onAccelerationChange} />
            </SettingCard>
          </>
        ) : null}

        {isImageToImage && isNanoBanana ? (
          <>
            <SettingCard label={translate("studio.field.safetyTolerance")} value={safetyTolerance}>
              <ChoiceButtons values={["1", "2", "3", "4", "5", "6"].map((value) => ({ value }))} selected={safetyTolerance} columns={6} onChange={onSafetyToleranceChange} />
            </SettingCard>
            <SettingCard label={translate("studio.field.limitGenerations")} value={translate(limitGenerations ? "studio.state.on" : "studio.state.off")}>
              <button type="button" onClick={() => onLimitGenerationsChange(!limitGenerations)} className={`h-10 w-full rounded-[0.9rem] text-xs font-semibold transition ${limitGenerations ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-accent-soft)] text-[var(--studio-muted)] hover:bg-[var(--studio-panel)]"}`}>{translate(limitGenerations ? "studio.state.on" : "studio.state.off")}</button>
            </SettingCard>
          </>
        ) : null}

        {(provider === "nano-banana-image" || provider === "nano-banana-edit" || provider === "nano-banana-pro") ? (
          <SettingCard label={translate("studio.field.webSearch")} value={translate(enableWebSearch ? "studio.state.enabled" : "studio.state.disabled")}>
            <button type="button" onClick={() => onEnableWebSearchChange(!enableWebSearch)} className={`h-10 w-full rounded-[0.9rem] text-xs font-semibold transition ${enableWebSearch ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-accent-soft)] text-[var(--studio-muted)] hover:bg-[var(--studio-panel)]"}`}>{translate(enableWebSearch ? "studio.state.enabled" : "studio.state.disabled")}</button>
          </SettingCard>
        ) : null}

        {(provider === "nano-banana-image" || provider === "nano-banana-edit" || isNanoBananaLite) ? (
          <SettingCard label={translate("studio.field.thinking")} value={thinkingLevel || (provider === "nano-banana-image" || provider === "nano-banana-edit" ? "medium" : translate("studio.state.off"))}>
            <ChoiceButtons values={[{ value: "", label: provider === "nano-banana-image" || provider === "nano-banana-edit" ? "medium" : translate("studio.state.off") }, { value: "minimal", label: translate("studio.state.minimal") }, { value: "high", label: translate("studio.state.high") }]} selected={thinkingLevel} columns={3} onChange={onThinkingLevelChange} />
          </SettingCard>
        ) : null}

        {isImageToImage && isNanoBanana ? (
          <SettingCard label={translate("studio.field.systemPrompt")} value={translate("studio.textImage.optional")} className="lg:col-span-2">
            <textarea dir="auto" rows={2} value={systemPrompt} onChange={(event) => onSystemPromptChange(event.target.value)} placeholder={translate("studio.placeholder.system")} className="w-full resize-none rounded-[0.9rem] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 py-2 text-sm font-bold leading-5 text-[var(--studio-muted)] outline-none placeholder:text-[var(--studio-muted)]" />
          </SettingCard>
        ) : null}
      </div> : null}

      <div className="hidden">
        {[
          { icon: "$", title: translate("studio.textImage.hintCostTitle"), body: translate(isUtility ? "studio.utilityImage.hintCostBody" : "studio.textImage.hintCostBody") },
          { icon: "@", title: translate(isUtility ? "studio.utilityImage.hintReferenceTitle" : "studio.textImage.hintPromptTitle"), body: translate(isUtility ? "studio.utilityImage.hintReferenceBody" : "studio.textImage.hintPromptBody") },
          { icon: "*", title: translate(isUtility ? "studio.utilityImage.hintOutputTitle" : "studio.textImage.hintPaidTitle"), body: translate(isUtility ? "studio.utilityImage.hintOutputBody" : "studio.textImage.hintPaidBody") }
        ].map((card) => (
          <div key={card.title} className="grid min-h-[74px] grid-cols-[36px_1fr] items-start gap-3 rounded-[22px] border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3.5 shadow-none">
            <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-[var(--studio-primary)]">{card.icon}</span>
            <span><strong className="block text-[13px] font-semibold text-[var(--studio-text)]">{card.title}</strong><span className="mt-1 block text-xs font-bold leading-[1.35] text-[var(--studio-muted)]">{card.body}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
