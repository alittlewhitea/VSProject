"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AuthLink } from "../../components/auth-link";
import {
  defaultTopazVideoScale, parseTopazVideoOptions, topazVideoAdjustments, topazVideoModels, topazVideoNeeds2x, topazVideoResolutionOptions,
  type TopazVideoAdjustment, type TopazVideoOptions, type TopazVideoSource, type topazVideoQuote
} from "../../lib/topaz-video-upscale";
import { StudioComposerGenerate } from "./studio-composer-controls";
import { StudioImageUpload } from "./studio-image-upload";
import { StudioPanel, StudioStatusNotice, type StudioStatusTone } from "./studio-primitives";
import type { ReferenceMediaUpload } from "./studio-reference-file-upload";
import styles from "./video-settings.module.css";

type Translate = (key: string) => string;

export function TopazVideoSettings({
  workflowTabs, translate, token, upload, cloudEnabled, source, onSourceChange,
  options, onOptionsChange, quote, submitting, statusMessage, statusTone, onGenerate
}: {
  workflowTabs: ReactNode; translate: Translate; token: string | null; upload?: ReferenceMediaUpload; cloudEnabled: boolean;
  source: TopazVideoSource | null; onSourceChange: (value: TopazVideoSource | null) => void;
  options: TopazVideoOptions; onOptionsChange: (value: TopazVideoOptions) => void;
  quote: ReturnType<typeof topazVideoQuote>; submitting: boolean; statusMessage?: string; statusTone?: StudioStatusTone;
  onGenerate: () => void;
}) {
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => request.current?.abort(), []);

  async function choose(files: FileList) {
    const file = files[0];
    if (!file || !upload || !token || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    onSourceChange(null);
    try {
      const videoUrl = await upload(file, "video", controller.signal);
      const response = await fetch("/api/generate/video/inspect", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl })
      });
      const metadata = await response.json();
      if (!response.ok || typeof metadata.proof !== "string") {
        throw new Error(metadata.error || translate("studio.topazVideo.failed"));
      }
      if (!controller.signal.aborted) {
        onOptionsChange({ ...options, upscale_factor: topazVideoNeeds2x(options.model) ? 2 : defaultTopazVideoScale(metadata) });
        onSourceChange(metadata);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : translate("studio.topazVideo.failed"));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const lockedScale = topazVideoNeeds2x(options.model);
  const resolutions = source ? topazVideoResolutionOptions(source).filter(({ scale }) => !lockedScale || scale === 2) : [];
  const presetSelected = resolutions.some(({ scale }) => scale === options.upscale_factor);
  const resolutionValue = presetSelected || quote ? String(options.upscale_factor) : "";
  const control = "min-h-10 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-sm text-[var(--studio-text)]";
  return <div className={`${styles.workbench} df-compact-composer df-premium-composer text-start`} data-video-workspace="video-upscale">
    <StudioPanel className={`${styles.editor} df-premium-panel`} header={workflowTabs}>
      <div className={styles.editorScroll}>
        <fieldset disabled={submitting || busy} className="grid min-w-0 gap-5">
          <div>
            {source ? <video src={source.url} controls playsInline preload="metadata"
              className="mb-3 max-h-64 w-full max-w-lg rounded-xl bg-black object-contain" /> : null}
            {token ? <StudioImageUpload compact={Boolean(source)} disabled={!cloudEnabled || busy}
              label={translate(busy ? "studio.topazVideo.inspecting" : source ? "studio.topazVideo.replace" : "studio.topazVideo.upload")}
              hint={!source && !busy ? translate("studio.topazVideo.hint") : undefined}
              inputProps={{ accept: "video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm", "aria-label": translate("studio.topazVideo.upload"), "data-topaz-video-upload": "true" }}
              onFiles={choose} /> : <div className="rounded-xl border border-dashed border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--studio-text)]">{translate("studio.topazVideo.upload")}</p>
              <p className="mt-1 text-xs text-[var(--studio-muted)]">{translate("studio.topazVideo.hint")}</p>
              <AuthLink href="/auth" className="mt-2 inline-flex text-sm font-medium text-[var(--studio-accent)] underline underline-offset-4">{translate("studio.auth.signIn")}</AuthLink>
            </div>}
            {token && !cloudEnabled ? <p className="mt-2 text-xs text-[var(--studio-muted)]">{translate("studio.topazVideo.storage")}</p> : null}
            {error ? <p role="alert" className="mt-2 text-xs text-red-600">{error}</p> : null}
          </div>
          <label className="grid w-full max-w-xs gap-1.5 text-sm font-medium text-[var(--studio-text)]">
            {translate("studio.topazVideo.outputResolution")}
            <select value={resolutionValue} className={`${control} disabled:opacity-60`} disabled={!source || (!resolutions.length && !quote)}
              onChange={event => onOptionsChange({ ...options, upscale_factor: Number(event.currentTarget.value) })}>
              {!resolutionValue ? <option value="" disabled>{translate(source ? "studio.field.resolution" : "studio.topazVideo.uploadFirst")}</option> : null}
              {resolutions.map(({ label, scale }) => <option key={label} value={scale}>{label}</option>)}
              {!presetSelected && quote ? <option value={options.upscale_factor}>{translate("studio.gpt26.customSize")}</option> : null}
            </select>
          </label>
          {source && !quote ? <p role="status" className="text-xs text-[var(--studio-muted)]">{translate(parseTopazVideoOptions(options) ? "studio.topazVideo.limit" : "studio.topazVideo.settings")}</p> : null}
          {source ? <details className="-mt-2 text-sm text-[var(--studio-muted)]">
            <summary className="w-fit cursor-pointer py-2 hover:text-[var(--studio-text)]">{translate("studio.workbench.advancedSettings")}</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="grid min-w-0 gap-1 text-xs text-[var(--studio-muted)]">
                {translate("studio.field.modelSettings")}
                <select value={options.model} onChange={event => {
                  const model = event.target.value as TopazVideoOptions["model"];
                  onOptionsChange({ ...options, model, upscale_factor: topazVideoNeeds2x(model) ? 2 : options.upscale_factor });
                }} className={control}>
                  {topazVideoModels.map(model => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-[var(--studio-muted)]">
                {translate("studio.topazVideo.scale")}
                <input type="number" min="1" max="4" step="any" value={options.upscale_factor || ""} disabled={lockedScale}
                  onChange={event => onOptionsChange({ ...options, upscale_factor: Number(event.currentTarget.value) })} className={control} />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-[var(--studio-muted)]">
                {translate("studio.topazVideo.fps")}
                <input type="number" min="16" max="60" step="1" placeholder={translate("studio.topazVideo.sourceFps")}
                  value={options.target_fps ?? ""} onChange={event => onOptionsChange({
                    ...options, target_fps: event.currentTarget.value ? Number(event.currentTarget.value) : undefined
                  })} className={control} />
              </label>
              {(Object.keys(topazVideoAdjustments) as TopazVideoAdjustment[]).map(key => <label key={key} className="grid min-w-0 gap-1 text-xs text-[var(--studio-muted)]">
                {translate(`studio.topazVideo.${key}`)}
                <input type="number" min="0" max={topazVideoAdjustments[key]} step="0.01" placeholder={translate("studio.option.automatic")}
                  value={options[key] ?? ""} onChange={event => onOptionsChange({
                    ...options, [key]: event.currentTarget.value ? Number(event.currentTarget.value) : undefined
                  })} className={control} />
              </label>)}
              <label className="flex items-center gap-2 text-xs text-[var(--studio-muted)]">
                <input type="checkbox" checked={options.H264_output}
                  onChange={event => onOptionsChange({ ...options, H264_output: event.currentTarget.checked })} /> H.264
              </label>
            </div>
          </details> : null}
          <div className="flex justify-end border-t border-[var(--studio-border)] pt-4">
            <StudioComposerGenerate disabled={!quote || busy || submitting} submitting={submitting} authenticated={Boolean(token)}
              credits={quote?.credits} actionLabel={translate("studio.workflow.video-upscale")} translate={translate} onGenerate={onGenerate} />
          </div>
        </fieldset>
        <StudioStatusNotice message={statusMessage} tone={statusTone} />
      </div>
    </StudioPanel>
  </div>;
}
