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
    {workflow !== "text-to-image" ? <StudioImageReferencePanel
      referenceImagesText={referenceImagesText} referenceImageUrls={referenceImageUrls}
      templateReferenceUrl={isImageToImage ? templateReferenceUrl : null}
      hintKey={isImageToImage ? undefined : isEnhance ? "studio.utilityImage.enhanceReferenceHint" : "studio.utilityImage.backgroundReferenceHint"}
      multiple={!isPromptlessWorkflow}
      translate={translate} onTextChange={onReferenceImagesTextChange} onFiles={onReferenceFiles}
      onRemove={onReferenceRemove} onClear={onReferenceClear} onError={onFileError}
    /> : null}
  </div>;
}
