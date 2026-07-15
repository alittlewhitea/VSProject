import type { VideoExample } from "./video-models";

type VideoExampleCardLabels = {
  outputVideo: string;
  textTitle: string;
  imageTitle: string;
  sourceImage: string;
  audio: string;
  resolution: string;
  useExample: string;
};

export function VideoExampleCard({
  example,
  labels,
  onUse
}: {
  example: VideoExample;
  labels: VideoExampleCardLabels;
  onUse: (prompt: string) => void;
}) {
  const isImageExample = example.workflow === "image-to-video";
  const isPortraitVideo = example.videoShape === "portrait";
  const hasPromptVariants = example.prompts.length > 1;
  const badge = `${example.badgeParts.join(" / ")}${example.badgeHasResolutionLabel ? ` ${labels.resolution}` : ""}${example.badgeHasAudio ? ` + ${labels.audio}` : ""}`;

  return (
    <section className="mb-5 overflow-hidden rounded-[22px] border border-[#758bac]/15 bg-white shadow-[0_12px_30px_rgba(35,58,97,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className={`relative bg-[#111827] ${isPortraitVideo ? "flex justify-center" : ""}`}>
          <video
            src={example.videoUrl}
            poster={example.posterUrl}
            controls
            playsInline
            preload="metadata"
            className={isPortraitVideo
              ? "aspect-[3/4] w-full bg-black object-contain lg:h-[640px] lg:w-auto"
              : `aspect-video h-full w-full bg-black ${example.videoFit === "contain" ? "object-contain" : "object-cover"}`}
          />
          <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-[#111827]/75 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur">
            {labels.outputVideo}
          </span>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8190a6]">{example.modelLabel}</p>
                <h3 className="mt-1 text-lg font-black text-[#263244]">{isImageExample ? labels.imageTitle : labels.textTitle}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-[#e9f7f3] px-3 py-1.5 text-xs font-black text-[#16866a]">{badge}</span>
            </div>
            {example.sourceImageUrl ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f4f7fb] p-2.5">
                <img
                  src={example.sourceImageUrl}
                  alt={labels.sourceImage}
                  className={example.sourceImageShape === "portrait" ? "h-20 w-16 rounded-lg object-cover" : "h-16 w-24 rounded-lg object-cover"}
                />
                <span className="text-sm font-bold text-[#66758b]">{labels.sourceImage}</span>
              </div>
            ) : null}
          </div>

          {hasPromptVariants ? (
            <div className="grid gap-3">
              {example.prompts.map((prompt, index) => (
                <div key={prompt} className="rounded-2xl border border-[#758bac]/15 bg-[#fbfdff] p-3.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8190a6]">Prompt {index + 1}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#66758b]">{prompt}</p>
                  <button
                    type="button"
                    onClick={() => onUse(prompt)}
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#eef7ff] px-4 text-sm font-black text-[#2468ad] transition hover:bg-[#e1f0ff]"
                  >
                    {labels.useExample} {index + 1}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="line-clamp-5 whitespace-pre-line text-sm leading-6 text-[#66758b]">{example.prompts[0]}</p>
              <button
                type="button"
                onClick={() => onUse(example.prompts[0])}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#eef7ff] px-4 text-sm font-black text-[#2468ad] transition hover:bg-[#e1f0ff]"
              >
                {labels.useExample}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
