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
      <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] px-[18px] py-[18px] md:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[var(--studio-primary)] text-sm font-semibold text-[var(--studio-accent)]">
            {"\u25b6"}
          </span>
          <div>
            <strong className="block text-[15px] font-semibold tracking-[-0.01em] text-[var(--studio-text)]">
              {translate(isImageToVideo ? "studio.videoWorkbench.motionStudio" : "studio.videoWorkbench.promptStudio")}
            </strong>
            <span className="mt-0.5 block text-xs font-bold text-[var(--studio-muted)]">
              {translate(isImageToVideo ? "studio.videoWorkbench.motionStudioDescription" : "studio.videoWorkbench.promptStudioDescription")}
            </span>
          </div>
        </div>
        <div className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-xs font-semibold ${canSubmit ? "bg-[var(--studio-success-soft)] text-[var(--studio-success)]" : "bg-[var(--studio-warning-soft)] text-[var(--studio-error)]"}`}>
          <span className={`h-2 w-2 rounded-full shadow-none ${canSubmit ? "bg-[var(--studio-success-soft)]" : "bg-[var(--studio-warning-soft)]"}`} />
          {canSubmit
            ? translate("studio.videoWorkbench.ready")
            : translate(isImageToVideo ? "studio.videoWorkbench.waitingImage" : "studio.videoWorkbench.waitingPrompt")}
        </div>
      </div>

      <div className={`grid gap-5 px-[18px] pb-5 pt-7 md:px-7 ${isImageToVideo ? "lg:grid-cols-[0.95fr_1.05fr]" : ""}`}>
        {isImageToVideo ? (
          <div
            className="rounded-[28px] border border-dashed border-[var(--studio-accent-border)] bg-[var(--studio-surface)] p-4 shadow-none"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addReferenceFiles(event.dataTransfer.files);
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text)]">{translate("studio.videoWorkbench.referenceImage")}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--studio-muted)]">{translate("studio.videoWorkbench.referenceHint")}</p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--studio-panel)] px-4 text-xs font-semibold text-[var(--studio-accent)] shadow-none transition hover:-translate-y-0.5">
                {translate("studio.action.chooseImage")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => addReferenceFiles(event.target.files)} />
              </label>
            </div>
            {referenceImageUrls.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {referenceImageUrls.slice(0, 4).map((url, index) => (
                  <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none">
                    <img src={url} alt={`Video reference ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid min-h-[132px] place-items-center rounded-[24px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-5 text-center">
                <p className="max-w-xs text-sm font-bold leading-6 text-[var(--studio-muted)]">{translate("studio.videoWorkbench.emptyReference")}</p>
              </div>
            )}
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text)]">
              {translate(isImageToVideo ? "studio.videoWorkbench.motionPrompt" : "studio.videoWorkbench.yourPrompt")}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center rounded-full border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 text-xs font-semibold text-[var(--studio-muted)] transition hover:bg-[var(--studio-panel)] hover:text-[var(--studio-text)]"
            >
              {translate("studio.action.clear")}
            </button>
          </div>
          <textarea
            dir="auto"
            rows={7}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="min-h-[260px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)] md:min-h-[310px] md:text-[22px]"
            placeholder={translate(isImageToVideo ? "studio.placeholder.imageVideo" : "studio.placeholder.video")}
          />
          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-[var(--studio-muted)]">
            <span>{translate(isImageToVideo ? "studio.videoWorkbench.motionTip" : "studio.videoWorkbench.promptTip")}</span>
            <span>{prompt.length.toLocaleString()} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
}
