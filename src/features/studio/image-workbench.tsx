import Link from "./studio-link";
import { StudioComposerPrompt } from "./studio-composer-controls";
import { StudioImageReferencePanel } from "./studio-image-reference-panel";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type ImageWorkbenchWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";

type ImageWorkbenchProps = {
  workflow: ImageWorkbenchWorkflow;
  prompt: string;
  referenceImagesText: string;
  referenceImageUrls: string[];
  templateReferenceUrl?: string | null;
  isPromptlessWorkflow: boolean;
  outputFormat: string;
  templatesUrl: string;
  translate: Translate;
  onPromptChange: (value: string) => void;
  onImprovePrompt: () => void;
  onReferenceImagesTextChange: (value: string) => void;
  onReferenceFiles: (files: FileList | null) => Promise<void>;
  onReferenceClear: () => void;
  onReferenceRemove: (index: number) => void;
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
    if (!files?.length) return;
    if (Array.from(files).some(file => !file.type.startsWith("image/"))) { onFileError(); return; }
    onReferenceFiles(files).catch(onFileError);
  };

  return (
    <div
      data-reference-panel tabIndex={-1} role="group" aria-label={translate("studio.imageImage.referenceImages")}
      className="df-composer-utility-reference"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text)]">{translate("studio.imageImage.referenceImages")}</div>
          <p className="mt-1 max-w-md text-xs font-bold leading-5 text-[var(--studio-muted)]">{translate(hintKey)}</p>
        </div>
        <label className="df-reference-upload inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--studio-accent-border)] bg-[var(--studio-panel)] px-3 text-xs font-bold text-[var(--studio-accent)] transition hover:bg-[var(--studio-accent-soft)]">
          {translate("studio.action.chooseImage")}
          <input type="file" accept="image/*" multiple={multiple} aria-label={translate("studio.action.chooseImage")} className="sr-only" onChange={(event) => { handleFiles(event.target.files); event.target.value = ""; }} />
        </label>
      </div>
      <details className="df-composer-reference-urls"><summary>{translate("studio.references.urlSummary")}</summary>
      <textarea
        data-reference-urls aria-label={translate("studio.field.imageUrl")}
        rows={multiple ? 2 : 1}
        value={referenceImagesText}
        onChange={(event) => onReferenceImagesTextChange(event.target.value)}
        placeholder="https://.../image.jpg"
        className="mt-3 w-full resize-y rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]"
      />
      </details>
      {referenceImageUrls.length ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[var(--studio-muted)]">
              {translate("studio.reference.count", {
                count: referenceImageUrls.length,
                label: translate(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images")
              })}
            </span>
            <button type="button" onClick={onReferenceClear} className="text-xs font-semibold text-[var(--studio-error)] transition hover:text-[var(--studio-error)]">
              {translate("studio.action.clear")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {referenceImageUrls.slice(0, previewLimit).map((url, index) => (
              <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none">
                <img src={url} alt={translate("studio.reference.image")} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ImageWorkbench({
  workflow,
  prompt,
  referenceImagesText,
  referenceImageUrls,
  templateReferenceUrl,
  isPromptlessWorkflow,
  outputFormat,
  templatesUrl,
  translate,
  onPromptChange,
  onImprovePrompt,
  onReferenceImagesTextChange,
  onReferenceFiles,
  onReferenceClear,
  onReferenceRemove,
  onFileError
}: ImageWorkbenchProps) {
  const isImageToImage = workflow === "image-to-image";
  const isEnhance = workflow === "enhance-cleanup";
  return <div className="df-image-editor">
    {!isPromptlessWorkflow ? <StudioComposerPrompt label={translate(isImageToImage ? "studio.imageImage.editPrompt" : "studio.textImage.yourPrompt")} prompt={prompt} placeholder={translate(isImageToImage ? "studio.imageImage.placeholder" : "studio.textImage.placeholder")} translate={translate} onChange={onPromptChange}>
      <div className="df-composer-prompt-actions">
        {!isImageToImage ? <button type="button" onClick={onImprovePrompt}>{translate("studio.textImage.improve")}</button> : null}
        <button type="button" disabled={!prompt.length} onClick={()=>onPromptChange("")}>{translate("studio.action.clear")}</button>
        {!isImageToImage ? <Link href={templatesUrl}>{translate("studio.textImage.templates")}</Link> : null}
      </div>
    </StudioComposerPrompt> : null}
    {isImageToImage ? <StudioImageReferencePanel compact
      referenceImagesText={referenceImagesText} referenceImageUrls={referenceImageUrls} templateReferenceUrl={templateReferenceUrl}
      translate={translate} onTextChange={onReferenceImagesTextChange} onFiles={onReferenceFiles}
      onRemove={onReferenceRemove} onClear={onReferenceClear} onError={onFileError}
    /> : workflow !== "text-to-image" ? <ReferenceImagePanel
      referenceImagesText={referenceImagesText} referenceImageUrls={referenceImageUrls} translate={translate}
      onReferenceImagesTextChange={onReferenceImagesTextChange} onReferenceFiles={onReferenceFiles}
      onReferenceClear={onReferenceClear} onFileError={onFileError}
      hintKey={isEnhance ? "studio.utilityImage.enhanceReferenceHint" : "studio.utilityImage.backgroundReferenceHint"}
      multiple={!isPromptlessWorkflow} previewLimit={isPromptlessWorkflow ? 1 : 8}
    /> : null}
  </div>;
}
