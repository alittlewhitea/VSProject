"use client";

import { StudioSegmentedControl } from "./studio-primitives";

type Translate = (key: string, values?: Record<string, string | number>) => string;
export type ImageWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";
export type VideoWorkflow = "text-to-video" | "image-to-video" | "reference-to-video" | "video-upscale";
const videoWorkflows: VideoWorkflow[] = ["text-to-video", "image-to-video", "reference-to-video", "video-upscale"];
export type AudioWorkflow = "text-to-audio" | "text-to-music";
export type StudioWorkflow = ImageWorkflow | VideoWorkflow | AudioWorkflow | "avatar-video";
type StudioMode = "image" | "video" | "audio" | "avatar";

type WorkflowSwitcherProps = {
  t: Translate;
  mode: StudioMode;
  imageWorkflow: ImageWorkflow;
  videoWorkflow: VideoWorkflow | "avatar-video";
  audioWorkflow: AudioWorkflow;
  onWorkflowChange: (workflow: StudioWorkflow) => void;
};

export function WorkflowSwitcher({
  t,
  mode,
  imageWorkflow,
  videoWorkflow,
  audioWorkflow,
  onWorkflowChange
}: WorkflowSwitcherProps) {
  if (mode === "avatar") return null;
  const workflows = mode === "image"
    ? (["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] as ImageWorkflow[])
    : mode === "video"
      ? videoWorkflows
      : (["text-to-audio", "text-to-music"] as AudioWorkflow[]);
  const active = mode === "image" ? imageWorkflow : mode === "video" ? videoWorkflow : audioWorkflow;
  return (
    <div className="df-workflow-nav">
      <StudioSegmentedControl
        label={t(`studio.nav.${mode}`)}
        options={workflows.map((workflow) => ({ value: workflow, label: t(`studio.workflow.${workflow}`) }))}
        value={active}
        onChange={onWorkflowChange}
      />
    </div>
  );
}
