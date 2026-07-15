type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type ProviderOption = { value: string; label: string };
type ImageSizePreset = { value: string; label: string };
type ImageQuality = "auto" | "low" | "medium" | "high";

type ImageSettingsProps = {
  provider: string;
  providerOptions: ProviderOption[];
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
    <div className={`rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)] ${className}`}>
      <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
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
          className={`h-10 rounded-[0.9rem] text-xs font-black transition ${uppercase ? "uppercase" : ""} ${
            selected === item.value
              ? "bg-[#151b2a] text-white shadow-[0_10px_18px_rgba(17,24,39,0.18)]"
              : "bg-[#f8fafd] text-[#758399] hover:bg-white"
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

  return (
    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(event) => onProviderChange(event.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
            {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {utilityWorkflow === "enhance-cleanup" ? (
            <>
              <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-sm font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">Standard V2 / 2x</span>
              <select value={outputFormat === "png" ? "png" : "jpeg"} onChange={(event) => onOutputFormatChange(event.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-sm font-black uppercase text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none" aria-label={translate("studio.field.outputFormat")}>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </>
          ) : !isUtility && isNanoBanana ? (
            <select value={ratio} onChange={(event) => onRatioChange(event.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
              {ratioOptions.map((item) => <option key={item} value={item}>{item === "auto" ? translate("studio.option.autoRatio") : item}</option>)}
            </select>
          ) : !isUtility ? (
            <select value={imageSize} onChange={(event) => onImageSizeChange(event.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
              {imageSizePresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
          ) : null}
        </div>

        <button type="button" onClick={onGenerate} disabled={generateDisabled} className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]">
          <span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span>
          {isAuthenticated ? <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">{estimatedCredits} {translate("studio.common.credits")}</span> : null}
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
        </button>
      </div>

      <div className={isUtility ? "hidden" : "grid gap-3 md:grid-cols-2 lg:grid-cols-[1.05fr_1fr_0.95fr_0.95fr]"}>
        {provider === "chatgpt-image" ? (
          <SettingCard label={translate("studio.field.quality")} value={translate("studio.textImage.costOptimized")}>
            <ChoiceButtons values={["auto", "low", "medium", "high"].map((value) => ({ value }))} selected={imageQuality} columns={4} onChange={(value) => onImageQualityChange(value as ImageQuality)} />
          </SettingCard>
        ) : null}

        {isImageToImage && (provider === "nano-banana-image" || provider === "nano-banana-pro") ? (
          <SettingCard label={translate("studio.field.resolution")} value={editResolution}>
            <ChoiceButtons values={(provider === "nano-banana-pro" ? ["1K", "2K", "4K"] : ["0.5K", "1K", "2K", "4K"]).map((value) => ({ value }))} selected={editResolution} columns={4} onChange={onEditResolutionChange} />
          </SettingCard>
        ) : null}

        {isFlux ? (
          <>
            <SettingCard label={translate("studio.field.steps")} value={numInferenceSteps}>
              <ChoiceButtons values={(provider === "flux-image" ? [1, 2, 4, 8, 12] : [4, 8, 16, 28, 50]).map((value) => ({ value: String(value) }))} selected={String(numInferenceSteps)} columns={5} onChange={(value) => onNumInferenceStepsChange(Number(value))} />
            </SettingCard>
            <SettingCard label={translate("studio.field.guidance")} value={guidanceScale}>
              <input type="range" min="1" max="20" step="0.5" value={guidanceScale} onChange={(event) => onGuidanceScaleChange(Number(event.target.value))} className="w-full accent-[#151b2a]" />
            </SettingCard>
          </>
        ) : null}

        <SettingCard label={translate("studio.field.output")} value={translate("studio.field.outputFormat")}>
          <ChoiceButtons values={(isFlux ? ["jpeg", "png"] : ["png", "jpeg", "webp"]).map((value) => ({ value }))} selected={outputFormat} columns={3} uppercase onChange={onOutputFormatChange} />
        </SettingCard>
        <SettingCard label={translate("studio.field.count")} value={translate("studio.textImage.images")}>
          <ChoiceButtons values={[1, 2, 3, 4].map((value) => ({ value: String(value) }))} selected={String(numImages)} columns={4} onChange={(value) => onNumImagesChange(Number(value))} />
        </SettingCard>
        <SettingCard label={translate("studio.field.seed")} value={translate("studio.textImage.optional")}>
          <input value={seed} onChange={(event) => onSeedChange(event.target.value.replace(/[^\d]/g, "").slice(0, 12))} placeholder={translate("studio.placeholder.random")} inputMode="numeric" className="h-10 w-full rounded-[0.9rem] border border-black/[0.06] bg-[#fbfcfe] px-3 text-sm font-black text-[#66758b] outline-none placeholder:text-[#8b98ad]" />
        </SettingCard>

        {isFlux ? (
          <>
            <SettingCard label={translate("studio.field.safety")} value={translate(enableSafetyChecker ? "studio.state.enabled" : "studio.state.disabled")}>
              <button type="button" onClick={() => onEnableSafetyCheckerChange(!enableSafetyChecker)} className={`h-10 w-full rounded-[0.9rem] text-xs font-black transition ${enableSafetyChecker ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>{translate(enableSafetyChecker ? "studio.state.enabled" : "studio.state.disabled")}</button>
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
              <button type="button" onClick={() => onLimitGenerationsChange(!limitGenerations)} className={`h-10 w-full rounded-[0.9rem] text-xs font-black transition ${limitGenerations ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>{translate(limitGenerations ? "studio.state.on" : "studio.state.off")}</button>
            </SettingCard>
          </>
        ) : null}

        {isImageToImage && (provider === "nano-banana-image" || provider === "nano-banana-pro") ? (
          <SettingCard label={translate("studio.field.webSearch")} value={translate(enableWebSearch ? "studio.state.enabled" : "studio.state.disabled")}>
            <button type="button" onClick={() => onEnableWebSearchChange(!enableWebSearch)} className={`h-10 w-full rounded-[0.9rem] text-xs font-black transition ${enableWebSearch ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>{translate(enableWebSearch ? "studio.state.enabled" : "studio.state.disabled")}</button>
          </SettingCard>
        ) : null}

        {isImageToImage && (provider === "nano-banana-image" || isNanoBananaLite) ? (
          <SettingCard label={translate("studio.field.thinking")} value={thinkingLevel || translate("studio.state.off")}>
            <ChoiceButtons values={[{ value: "", label: translate("studio.state.off") }, { value: "minimal", label: translate("studio.state.minimal") }, { value: "high", label: translate("studio.state.high") }]} selected={thinkingLevel} columns={3} onChange={onThinkingLevelChange} />
          </SettingCard>
        ) : null}

        {isImageToImage && isNanoBanana ? (
          <SettingCard label={translate("studio.field.systemPrompt")} value={translate("studio.textImage.optional")} className="lg:col-span-2">
            <textarea dir="auto" rows={2} value={systemPrompt} onChange={(event) => onSystemPromptChange(event.target.value)} placeholder={translate("studio.placeholder.system")} className="w-full resize-none rounded-[0.9rem] border border-black/[0.06] bg-[#fbfcfe] px-3 py-2 text-sm font-bold leading-5 text-[#66758b] outline-none placeholder:text-[#8b98ad]" />
          </SettingCard>
        ) : null}
      </div>

      <div className="mt-3.5 grid gap-3 md:grid-cols-3">
        {[
          { icon: "$", title: translate("studio.textImage.hintCostTitle"), body: translate(isUtility ? "studio.utilityImage.hintCostBody" : "studio.textImage.hintCostBody") },
          { icon: "@", title: translate(isUtility ? "studio.utilityImage.hintReferenceTitle" : "studio.textImage.hintPromptTitle"), body: translate(isUtility ? "studio.utilityImage.hintReferenceBody" : "studio.textImage.hintPromptBody") },
          { icon: "*", title: translate(isUtility ? "studio.utilityImage.hintOutputTitle" : "studio.textImage.hintPaidTitle"), body: translate(isUtility ? "studio.utilityImage.hintOutputBody" : "studio.textImage.hintPaidBody") }
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
