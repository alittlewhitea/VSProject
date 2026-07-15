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
      <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
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
        <div className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-xs font-black ${canSubmit ? "bg-[#20c997]/10 text-[#17916e]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
          <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
          {translate(canSubmit ? "studio.audioWorkbench.ready" : "studio.audioWorkbench.waiting")}
        </div>
      </div>

      <div className="px-[18px] pb-5 pt-7 md:px-7">
        <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">
            {translate(isMusic ? "studio.audioWorkbench.musicPrompt" : "studio.audioWorkbench.voiceScript")}
          </div>
          <button
            type="button"
            onClick={() => onPromptChange("")}
            className="inline-flex h-8 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
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
          className="min-h-[260px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:min-h-[310px] md:text-[22px]"
          placeholder={isMusic ? translate("studio.music.defaultPrompt") : translate("studio.placeholder.audio")}
        />
        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
          <span>{translate(isMusic ? "studio.music.promptDescription" : "studio.audioWorkbench.voiceTip")}</span>
          <span>{prompt.length.toLocaleString()} / {isMiniMaxMusic ? "2,000" : "\u221e"}</span>
        </div>

        {isMiniMaxMusic ? (
          <div className="mt-5 rounded-[24px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-4 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
            <button type="button" onClick={() => onAdvancedOpenChange(!musicAdvancedOpen)} className="flex w-full items-center justify-between gap-3 text-left">
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
