"use client";

import type { ReactNode } from "react";
import { StudioPanel, StudioStatusNotice, type StudioStatusTone } from "./studio-primitives";

type WorkbenchMode = "image" | "video" | "audio" | "avatar";
type UnifiedWorkbenchLayoutProps = {
  mode: WorkbenchMode;
  workflowTabs?: ReactNode;
  statusMessage?: string;
  statusTone?: StudioStatusTone;
  editor?: ReactNode;
  settings?: ReactNode;
  modelSelector?: ReactNode;
  children?: ReactNode;
  className?: string;
  panelClassName?: string;
  bodyClassName?: string;
  "data-video-workspace"?: string;
};

/** Creation controls only; generated media stays available in Projects. */
export function UnifiedWorkbenchLayout({
  mode,
  editor,
  settings,
  modelSelector,
  workflowTabs,
  statusMessage,
  statusTone,
  children,
  className,
  panelClassName,
  bodyClassName,
  "data-video-workspace": videoWorkspace
}: UnifiedWorkbenchLayoutProps) {
  if (mode === "avatar") {
    return (
      <div className="df-unified-workspace df-mode-avatar df-avatar-composer" data-creation-workspace="avatar">
        <StudioPanel className="df-unified-inspector">
          <div data-creation-input>{editor}</div>
          <div data-creation-config className="df-avatar-composer-footer">
            {modelSelector}
            {settings}
          </div>
          <StudioStatusNotice message={statusMessage} tone={statusTone} />
        </StudioPanel>
      </div>
    );
  }

  if (mode === "video") {
    return (
      <div
        className={`df-unified-workspace df-compact-composer df-premium-composer df-mode-video text-start ${className || ""}`.trim()}
        data-premium-workspace="video"
        data-creation-workspace="video"
        data-video-workspace={videoWorkspace}
      >
        <StudioPanel className={`df-unified-inspector df-premium-panel ${panelClassName || ""}`.trim()} header={workflowTabs}>
          <div className={bodyClassName} data-video-editor-scroll={videoWorkspace && videoWorkspace !== "video-upscale" ? "" : undefined}>
            {children}
            <StudioStatusNotice message={statusMessage} tone={statusTone} />
          </div>
        </StudioPanel>
      </div>
    );
  }

  return (
    <div className={`df-unified-workspace df-compact-composer df-premium-composer df-mode-${mode} text-start`} data-premium-workspace={mode} data-creation-workspace={mode}>
      <StudioPanel className="df-unified-inspector df-premium-panel" header={workflowTabs}>
        <div className="df-creation-input" data-creation-input>{editor}</div>
        <div className="df-creation-config" data-creation-config>
          {modelSelector}
          <div className="df-unified-settings">{settings}</div>
          <StudioStatusNotice message={statusMessage} tone={statusTone} />
        </div>
      </StudioPanel>
    </div>
  );
}
