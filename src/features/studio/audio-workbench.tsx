import { StudioComposerPrompt } from "./studio-composer-controls";
import type { ReactNode } from "react";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

export function AudioWorkbench({
  workflow,
  canSubmit,
  prompt,
  isMiniMaxMusic,
  musicAdvancedOpen,
  isInstrumental,
  lyricsOptimizer,
  musicLyrics,
  translate,
  onPromptChange,
  onAdvancedOpenChange,
  onInstrumentalChange,
  onLyricsOptimizerChange,
  onMusicLyricsChange,
  speechEditor,
  scriptMaxLength,
  scriptPlaceholder
}: {
  workflow: "text-to-audio" | "text-to-music";
  canSubmit: boolean;
  prompt: string;
  isMiniMaxMusic: boolean;
  musicAdvancedOpen: boolean;
  isInstrumental: boolean;
  lyricsOptimizer: boolean;
  musicLyrics: string;
  translate: Translate;
  onPromptChange: (value: string) => void;
  onAdvancedOpenChange: (value: boolean) => void;
  onInstrumentalChange: (value: boolean) => void;
  onLyricsOptimizerChange: (value: boolean) => void;
  onMusicLyricsChange: (value: string) => void;
  speechEditor?: ReactNode;
  scriptMaxLength?: number;
  scriptPlaceholder?: string;
}) {
  const isMusic = workflow === "text-to-music";

  return (
    <div className="df-audio-editor">
      {speechEditor || <StudioComposerPrompt label={translate(isMusic ? "studio.audioWorkbench.musicPrompt" : "studio.audioWorkbench.voiceScript")} prompt={prompt} placeholder={scriptPlaceholder || translate(isMusic ? "studio.music.defaultPrompt" : "studio.placeholder.audio")} translate={translate} onChange={onPromptChange} maxLength={isMiniMaxMusic ? 2000 : scriptMaxLength}>
        <div className="df-composer-prompt-actions"><button type="button" disabled={!prompt.length} onClick={()=>onPromptChange("")}>{translate("studio.action.clear")}</button></div>
      </StudioComposerPrompt>}
        {isMiniMaxMusic ? (
          <div className="df-composer-music-options">
            <button type="button" onClick={() => onAdvancedOpenChange(!musicAdvancedOpen)} className="flex min-h-11 w-full items-center justify-between gap-3 text-start">
              <span>
                <span className="block text-sm font-semibold text-[var(--studio-text)]">{translate("studio.music.additionalSettings")}</span>
              </span>
              <span className="rounded-full bg-[var(--studio-panel)] px-3 py-1 text-xs font-semibold text-[var(--studio-muted)]">{translate(musicAdvancedOpen ? "studio.music.less" : "studio.music.more")}</span>
            </button>
            {musicAdvancedOpen ? (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-4">
                    <span>
                      <span className="block text-sm font-semibold text-[var(--studio-text)]">{translate("studio.music.instrumental")}</span>
                      <span className="mt-1 block text-xs text-[var(--studio-muted)]">{translate("studio.music.instrumentalDescription")}</span>
                    </span>
                    <input type="checkbox" checked={isInstrumental} onChange={(event) => onInstrumentalChange(event.target.checked)} className="h-5 w-5" />
                  </label>
                  <label className={`flex items-center justify-between gap-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-4 ${isInstrumental ? "opacity-50" : ""}`}>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--studio-text)]">{translate("studio.music.autoLyrics")}</span>
                      <span className="mt-1 block text-xs text-[var(--studio-muted)]">{translate("studio.music.autoLyricsDescription")}</span>
                    </span>
                    <input type="checkbox" checked={lyricsOptimizer} disabled={isInstrumental} onChange={(event) => onLyricsOptimizerChange(event.target.checked)} className="h-5 w-5" />
                  </label>
                </div>
                {!isInstrumental ? (
                  <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
                    <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{translate("studio.music.lyrics")}</span>
                    <textarea
                      rows={7}
                      maxLength={3500}
                      value={musicLyrics}
                      onChange={(event) => onMusicLyricsChange(event.target.value)}
                      disabled={lyricsOptimizer}
                      placeholder={translate("studio.music.lyricsPlaceholder")}
                      className="w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 py-3 text-sm leading-6 text-[var(--studio-text)] outline-none disabled:opacity-50"
                    />
                    <span className="mt-2 block text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.music.lyricsDescription")}</span>
                    <span className="mt-2 block text-right text-xs text-[var(--studio-muted)]">{musicLyrics.length.toLocaleString()} / 3,500</span>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
    </div>
  );
}
