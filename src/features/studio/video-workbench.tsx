export type VideoWorkbenchWorkflow = "text-to-video" | "image-to-video";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

export function VideoWorkbench({
  workflow,
  canSubmit,
  prompt,
  referenceImageUrls,
  translate,
  onPromptChange,
  onClear,
  onReferenceFiles,
  onFileError
}: {
  workflow: VideoWorkbenchWorkflow;
  canSubmit: boolean;
  prompt: string;
  referenceImageUrls: string[];
  translate: Translate;
  onPromptChange: (value: string) => void;
  onClear: () => void;
  onReferenceFiles: (files: FileList | null) => Promise<void>;
  onFileError: () => void;
}) {
  const isImageToVideo = workflow === "image-to-video";
  const addReferenceFiles = (files: FileList | null) => {
    onReferenceFiles(files).catch(onFileError);
  };

  return (
    <div>
      <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
            {"\u25b6"}
          </span>
          <div>
            <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">
              {translate(isImageToVideo ? "studio.videoWorkbench.motionStudio" : "studio.videoWorkbench.promptStudio")}
            </strong>
            <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">
              {translate(isImageToVideo ? "studio.videoWorkbench.motionStudioDescription" : "studio.videoWorkbench.promptStudioDescription")}
            </span>
          </div>
        </div>
        <div className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-xs font-black ${canSubmit ? "bg-[#20c997]/10 text-[#17916e]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
          <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
          {canSubmit
            ? translate("studio.videoWorkbench.ready")
            : translate(isImageToVideo ? "studio.videoWorkbench.waitingImage" : "studio.videoWorkbench.waitingPrompt")}
        </div>
      </div>

      <div className={`grid gap-5 px-[18px] pb-5 pt-7 md:px-7 ${isImageToVideo ? "lg:grid-cols-[0.95fr_1.05fr]" : ""}`}>
        {isImageToVideo ? (
          <div
            className="rounded-[28px] border border-dashed border-[#8fb6e8]/45 bg-[linear-gradient(135deg,rgba(232,247,255,0.72),rgba(255,255,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addReferenceFiles(event.dataTransfer.files);
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{translate("studio.videoWorkbench.referenceImage")}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#8290a7]">{translate("studio.videoWorkbench.referenceHint")}</p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-4 text-xs font-black text-[#187be6] shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:-translate-y-0.5">
                {translate("studio.action.chooseImage")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => addReferenceFiles(event.target.files)} />
              </label>
            </div>
            {referenceImageUrls.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {referenceImageUrls.slice(0, 4).map((url, index) => (
                  <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                    <img src={url} alt={`Video reference ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid min-h-[132px] place-items-center rounded-[24px] border border-[#758bac]/15 bg-white/55 px-5 text-center">
                <p className="max-w-xs text-sm font-bold leading-6 text-[#8290a7]">{translate("studio.videoWorkbench.emptyReference")}</p>
              </div>
            )}
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">
              {translate(isImageToVideo ? "studio.videoWorkbench.motionPrompt" : "studio.videoWorkbench.yourPrompt")}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
            >
              {translate("studio.action.clear")}
            </button>
          </div>
          <textarea
            dir="auto"
            rows={7}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="min-h-[260px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:min-h-[310px] md:text-[22px]"
            placeholder={translate(isImageToVideo ? "studio.placeholder.imageVideo" : "studio.placeholder.video")}
          />
          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
            <span>{translate(isImageToVideo ? "studio.videoWorkbench.motionTip" : "studio.videoWorkbench.promptTip")}</span>
            <span>{prompt.length.toLocaleString()} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
}
