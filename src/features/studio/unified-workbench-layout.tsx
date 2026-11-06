"use client";

import type { ReactNode } from "react";
import { StudioPanel, StudioStatusNotice, type StudioStatusTone } from "./studio-primitives";

type WorkbenchMode = "image" | "audio" | "avatar";
type UnifiedWorkbenchLayoutProps = {
  mode: WorkbenchMode;
  workflowTabs?: ReactNode;
  statusMessage?: string;
  statusTone?: StudioStatusTone;
  editor: ReactNode;
  settings: ReactNode;
  modelSelector?: ReactNode;
  translate: (key: string, values?: Record<string, string | number | null | undefined>) => string;
};

/** Creation controls only; generated media stays available in Projects. */
export function UnifiedWorkbenchLayout({ mode, editor, settings, modelSelector, translate, workflowTabs, statusMessage, statusTone }: UnifiedWorkbenchLayoutProps) {
  if(mode==="avatar") return <div className="df-unified-workspace df-mode-avatar df-avatar-composer" data-creation-workspace="avatar">
    <div className="df-avatar-composer-heading"><h2>{translate("studio.avatarWorkbench.studio")}</h2></div>
    <StudioPanel className="df-unified-inspector">
      <div data-creation-input>{editor}</div>
      <div data-creation-config className="df-avatar-composer-footer">
        {modelSelector}
        {settings}
      </div>
      <StudioStatusNotice message={statusMessage} tone={statusTone}/>
    </StudioPanel>
  </div>;
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
