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
  onMusicLyricsChange
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
}) {
  const isMusic = workflow === "text-to-music";

  return (
    <div>
      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f7] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#f1efff] text-sm font-black text-[#6a5af9]">
            {"\u266b"}
          </span>
          <div>
            <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">
              {translate(isMusic ? "studio.audioWorkbench.musicStudio" : "studio.audioWorkbench.voiceStudio")}
            </strong>
            <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">
              {translate(isMusic ? "studio.audioWorkbench.musicStudioDescription" : "studio.audioWorkbench.voiceStudioDescription")}
            </span>
          </div>
        </div>
        <div className={`inline-flex h-8 items-center gap-2 rounded-[10px] px-3 text-xs font-bold ${canSubmit ? "bg-[#ecfdf3] text-[#039855]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
          <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
          {translate(canSubmit ? "studio.audioWorkbench.ready" : "studio.audioWorkbench.waiting")}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">
            {translate(isMusic ? "studio.audioWorkbench.musicPrompt" : "studio.audioWorkbench.voiceScript")}
          </div>
          <button
            type="button"
            onClick={() => onPromptChange("")}
            className="inline-flex min-h-10 items-center rounded-[9px] border border-[#eaecf0] bg-white px-3 text-xs font-bold text-[#667085] transition hover:bg-[#f8f8fb] hover:text-[#344054]"
          >
            {translate("studio.action.clear")}
          </button>
        </div>
        <textarea
          dir="auto"
          rows={7}
          maxLength={isMiniMaxMusic ? 2000 : undefined}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          className="min-h-[220px] w-full resize-y rounded-2xl border border-[#eaecf0] bg-white p-4 text-[15px] leading-[1.55] text-[#101828] outline-none placeholder:text-[#98a2b3]"
          placeholder={isMusic ? translate("studio.music.defaultPrompt") : translate("studio.placeholder.audio")}
        />
        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
          <span>{translate(isMusic ? "studio.music.promptDescription" : "studio.audioWorkbench.voiceTip")}</span>
          <span>{prompt.length.toLocaleString()} / {isMiniMaxMusic ? "2,000" : "\u221e"}</span>
        </div>

        {isMiniMaxMusic ? (
          <div className="mt-4 rounded-2xl border border-[#eaecf0] bg-[#fcfcfe] p-3">
            <button type="button" onClick={() => onAdvancedOpenChange(!musicAdvancedOpen)} className="flex min-h-11 w-full items-center justify-between gap-3 text-start">
              <span>
                <span className="block text-sm font-black text-[#283249]">{translate("studio.music.additionalSettings")}</span>
                <span className="mt-1 block text-xs font-bold text-[#8290a7]">{translate("studio.music.additionalSettingsDescription")}</span>
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#66758b]">{translate(musicAdvancedOpen ? "studio.music.less" : "studio.music.more")}</span>
            </button>
            {musicAdvancedOpen ? (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#758bac]/15 bg-white p-4">
                    <span>
                      <span className="block text-sm font-black text-[#485164]">{translate("studio.music.instrumental")}</span>
                      <span className="mt-1 block text-xs text-[#8b95a7]">{translate("studio.music.instrumentalDescription")}</span>
                    </span>
                    <input type="checkbox" checked={isInstrumental} onChange={(event) => onInstrumentalChange(event.target.checked)} className="h-5 w-5" />
                  </label>
                  <label className={`flex items-center justify-between gap-4 rounded-2xl border border-[#758bac]/15 bg-white p-4 ${isInstrumental ? "opacity-50" : ""}`}>
                    <span>
                      <span className="block text-sm font-black text-[#485164]">{translate("studio.music.autoLyrics")}</span>
                      <span className="mt-1 block text-xs text-[#8b95a7]">{translate("studio.music.autoLyricsDescription")}</span>
                    </span>
                    <input type="checkbox" checked={lyricsOptimizer} disabled={isInstrumental} onChange={(event) => onLyricsOptimizerChange(event.target.checked)} className="h-5 w-5" />
                  </label>
                </div>
                {!isInstrumental ? (
                  <label className="rounded-2xl border border-[#758bac]/15 bg-white p-3">
                    <span className="mb-2 block text-xs font-black text-[#667085]">{translate("studio.music.lyrics")}</span>
                    <textarea
                      rows={7}
                      maxLength={3500}
                      value={musicLyrics}
                      onChange={(event) => onMusicLyricsChange(event.target.value)}
                      disabled={lyricsOptimizer}
                      placeholder={translate("studio.music.lyricsPlaceholder")}
                      className="w-full resize-y rounded-xl border border-black/[0.06] bg-[#fbfcfe] px-3 py-3 text-sm leading-6 text-[#485164] outline-none disabled:opacity-50"
                    />
                    <span className="mt-2 block text-xs leading-5 text-[#8b95a7]">{translate("studio.music.lyricsDescription")}</span>
                    <span className="mt-2 block text-right text-xs text-[#98a2b3]">{musicLyrics.length.toLocaleString()} / 3,500</span>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
