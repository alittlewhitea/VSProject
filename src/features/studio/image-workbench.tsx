import Link from "next/link";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type ImageWorkbenchWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";

type ImageWorkbenchProps = {
  workflow: ImageWorkbenchWorkflow;
  canSubmit: boolean;
  prompt: string;
  referenceImagesText: string;
  referenceImageUrls: string[];
  isPromptlessWorkflow: boolean;
  outputFormat: string;
  templatesUrl: string;
  translate: Translate;
  onPromptChange: (value: string) => void;
  onImprovePrompt: () => void;
  onReferenceImagesTextChange: (value: string) => void;
  onReferenceFiles: (files: FileList | null) => Promise<void>;
  onReferenceClear: () => void;
  onFileError: () => void;
};

type ReferenceImagePanelProps = Pick<
  ImageWorkbenchProps,
  | "referenceImagesText"
  | "referenceImageUrls"
  | "translate"
  | "onReferenceImagesTextChange"
  | "onReferenceFiles"
  | "onReferenceClear"
  | "onFileError"
> & {
  hintKey: string;
  multiple: boolean;
  previewLimit: number;
};

function ReferenceImagePanel({
  referenceImagesText,
  referenceImageUrls,
  translate,
  onReferenceImagesTextChange,
  onReferenceFiles,
  onReferenceClear,
  onFileError,
  hintKey,
  multiple,
  previewLimit
}: ReferenceImagePanelProps) {
  const handleFiles = (files: FileList | null) => {
    onReferenceFiles(files).catch(onFileError);
  };

  return (
    <div
      className="rounded-2xl border border-dashed border-[#cfc9ff] bg-[#faf9ff] p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{translate("studio.imageImage.referenceImages")}</div>
          <p className="mt-1 max-w-md text-xs font-bold leading-5 text-[#8290a7]">{translate(hintKey)}</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-[#e2defe] bg-white px-3 text-xs font-bold text-[#6a5af9] transition hover:bg-[#f8f7ff]">
          {translate("studio.action.chooseImage")}
          <input type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(event) => handleFiles(event.target.files)} />
        </label>
      </div>
      <input
        value={referenceImagesText}
        onChange={(event) => onReferenceImagesTextChange(event.target.value)}
        placeholder="https://.../image.jpg"
        className="mt-3 h-10 w-full rounded-[10px] border border-[#eaecf0] bg-white px-3 text-sm font-semibold text-[#344054] outline-none placeholder:text-[#98a2b3]"
      />
      {referenceImageUrls.length ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-black text-[#66758b]">
              {translate("studio.reference.count", {
                count: referenceImageUrls.length,
                label: translate(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images")
              })}
            </span>
            <button type="button" onClick={onReferenceClear} className="text-xs font-black text-[#ef4444] transition hover:text-[#dc2626]">
              {translate("studio.action.clear")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {referenceImageUrls.slice(0, previewLimit).map((url, index) => (
              <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                <img src={url} alt={translate("studio.reference.image")} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid min-h-[96px] place-items-center rounded-xl border border-[#eaecf0] bg-white px-4 text-center">
          <p className="max-w-xs text-sm font-bold leading-6 text-[#8290a7]">{translate("studio.imageImage.emptyReference")}</p>
        </div>
      )}
    </div>
  );
}

function WorkbenchHeader({ icon, title, description, status }: { icon: string; title: string; description: string; status: string }) {
  return (
    <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f7] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#f1efff] text-sm font-black text-[#6a5af9]">{icon}</span>
        <div>
          <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">{title}</strong>
          <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">{description}</span>
        </div>
      </div>
      <div className="inline-flex h-8 items-center gap-2 rounded-[10px] bg-[#ecfdf3] px-3 text-xs font-bold text-[#039855]">
        <span className="h-2 w-2 rounded-full bg-[#20c997] shadow-[0_0_0_5px_rgba(32,201,151,0.12)]" />
        {status}
      </div>
    </div>
  );
}

export function ImageWorkbench({
  workflow,
  canSubmit,
  prompt,
  referenceImagesText,
  referenceImageUrls,
  isPromptlessWorkflow,
  outputFormat,
  templatesUrl,
  translate,
  onPromptChange,
  onImprovePrompt,
  onReferenceImagesTextChange,
  onReferenceFiles,
  onReferenceClear,
  onFileError
}: ImageWorkbenchProps) {
  if (workflow === "text-to-image") {
    return (
      <div>
        <WorkbenchHeader
          icon={"\u2726"}
          title={translate("studio.textImage.promptStudio")}
          description={translate("studio.textImage.promptStudioDescription")}
          status={translate(canSubmit ? "studio.textImage.ready" : "studio.textImage.waiting")}
        />
        <div className="px-4 pb-4 pt-3">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{translate("studio.textImage.yourPrompt")}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onImprovePrompt} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]">
                <span aria-hidden="true">{"\u2728"}</span>
                {translate("studio.textImage.improve")}
              </button>
              <button type="button" onClick={() => onPromptChange("")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]">
                <span aria-hidden="true">{"\u21ba"}</span>
                {translate("studio.action.clear")}
              </button>
              <Link href={templatesUrl} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]">
                <span aria-hidden="true">{"\u2318"}</span>
                {translate("studio.textImage.templates")}
              </Link>
            </div>
          </div>
          <textarea dir="auto" rows={7} value={prompt} onChange={(event) => onPromptChange(event.target.value)} className="min-h-[190px] w-full resize-y rounded-2xl border border-[#eaecf0] bg-white p-4 text-[15px] leading-[1.55] text-[#101828] outline-none placeholder:text-[#98a2b3]" placeholder={translate("studio.textImage.placeholder")} />
          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
            <span>{translate("studio.textImage.tip")}</span>
            <span>{translate("studio.workbench.characters", { count: prompt.length.toLocaleString() })}</span>
          </div>
        </div>
      </div>
    );
  }

  const isImageToImage = workflow === "image-to-image";
  const isEnhance = workflow === "enhance-cleanup";
  const referenceHintKey = isImageToImage
    ? "studio.imageImage.referenceHint"
    : isEnhance
      ? "studio.utilityImage.enhanceReferenceHint"
      : "studio.utilityImage.backgroundReferenceHint";

  return (
    <div>
      <WorkbenchHeader
        icon={isImageToImage ? "+" : "\u2726"}
        title={translate(
          isImageToImage
            ? "studio.imageImage.referenceStudio"
            : isEnhance
              ? "studio.utilityImage.enhanceStudio"
              : "studio.utilityImage.backgroundStudio"
        )}
        description={translate(
          isImageToImage
            ? "studio.imageImage.referenceStudioDescription"
            : isEnhance
              ? "studio.utilityImage.enhanceStudioDescription"
              : "studio.utilityImage.backgroundStudioDescription"
        )}
        status={translate(referenceImageUrls.length ? (isImageToImage ? "studio.imageImage.ready" : "studio.utilityImage.ready") : "studio.imageImage.addReference")}
      />

      <div className="grid gap-4 px-4 pb-4 pt-3">
        <ReferenceImagePanel
          referenceImagesText={referenceImagesText}
          referenceImageUrls={referenceImageUrls}
          translate={translate}
          onReferenceImagesTextChange={onReferenceImagesTextChange}
          onReferenceFiles={onReferenceFiles}
          onReferenceClear={onReferenceClear}
          onFileError={onFileError}
          hintKey={referenceHintKey}
          multiple={isImageToImage || !isPromptlessWorkflow}
          previewLimit={isPromptlessWorkflow ? 1 : 8}
        />

        <div className="min-w-0">
          {isImageToImage ? (
            <>
              <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
                <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{translate("studio.imageImage.editPrompt")}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onPromptChange("")} className="inline-flex min-h-10 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]">{translate("studio.action.clear")}</button>
                </div>
              </div>
              <textarea dir="auto" rows={7} value={prompt} onChange={(event) => onPromptChange(event.target.value)} className="min-h-[180px] w-full resize-y rounded-2xl border border-[#eaecf0] bg-white p-4 text-[15px] leading-[1.55] text-[#101828] outline-none placeholder:text-[#98a2b3]" placeholder={translate("studio.imageImage.placeholder")} />
              <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
                <span>{translate("studio.imageImage.tip")}</span>
                <span>{prompt.length.toLocaleString()} characters</span>
              </div>
            </>
          ) : isEnhance ? (
            <div className="flex min-h-[300px] flex-col justify-between rounded-[28px] border border-[#758bac]/15 bg-[linear-gradient(145deg,#f5faff,#ffffff)] p-5 shadow-[0_10px_28px_rgba(35,58,97,0.06)] md:p-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2886d3]">{translate("studio.topaz.enhancement")}</p>
                    <h3 className="mt-2 text-xl font-black text-[#283249]">Standard V2</h3>
                  </div>
                  <span className="rounded-full bg-[#e9f7ff] px-3 py-1.5 text-xs font-black text-[#1787c4]">2x</span>
                </div>
                <p className="mt-4 text-sm font-bold leading-6 text-[#7b899f]">{translate("studio.model.topaz-image")}</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  [translate("studio.topaz.subject"), translate("studio.topaz.all")],
                  [translate("studio.topaz.faceEnhancement"), "80%"],
                  [translate("studio.topaz.upscale"), "2x"],
                  [translate("studio.field.output"), outputFormat === "png" ? "PNG" : "JPEG"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[18px] border border-[#758bac]/12 bg-white px-4 py-3 shadow-[0_6px_16px_rgba(35,58,97,0.04)]">
                    <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#98a4b6]">{label}</span>
                    <strong className="mt-1 block text-sm font-black text-[#42516a]">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid min-h-[300px] place-items-center rounded-[28px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-6 text-center shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-xl font-black text-[#187be6]">{"\u2726"}</div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-[#283249]">{translate("studio.utilityImage.backgroundReadyTitle")}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-6 text-[#8290a7]">{translate("studio.utilityImage.backgroundReadyBody")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
