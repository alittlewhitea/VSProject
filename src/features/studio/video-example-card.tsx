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
    <section className="mb-5 overflow-hidden rounded-[22px] border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className={`relative bg-[var(--studio-primary)] ${isPortraitVideo ? "flex justify-center" : ""}`}>
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
          <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-[var(--studio-border)] bg-[var(--studio-primary)] px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
            {labels.outputVideo}
          </span>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--studio-muted)]">{example.modelLabel}</p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--studio-text)]">{isImageExample ? labels.imageTitle : labels.textTitle}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--studio-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--studio-success)]">{badge}</span>
            </div>
            {example.sourceImageUrl ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--studio-accent-soft)] p-2.5">
                <img
                  src={example.sourceImageUrl}
                  alt={labels.sourceImage}
                  className={example.sourceImageShape === "portrait" ? "h-20 w-16 rounded-lg object-cover" : "h-16 w-24 rounded-lg object-cover"}
                />
                <span className="text-sm font-bold text-[var(--studio-muted)]">{labels.sourceImage}</span>
              </div>
            ) : null}
          </div>

          {hasPromptVariants ? (
            <div className="grid gap-3">
              {example.prompts.map((prompt, index) => (
                <div key={prompt} className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">Prompt {index + 1}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-[var(--studio-muted)]">{prompt}</p>
                  <button
                    type="button"
                    onClick={() => onUse(prompt)}
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[var(--studio-accent-soft)] px-4 text-sm font-semibold text-[var(--studio-accent)] transition hover:bg-[var(--studio-accent-soft)]"
                  >
                    {labels.useExample} {index + 1}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="line-clamp-5 whitespace-pre-line text-sm leading-6 text-[var(--studio-muted)]">{example.prompts[0]}</p>
              <button
                type="button"
                onClick={() => onUse(example.prompts[0])}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--studio-accent-soft)] px-4 text-sm font-semibold text-[var(--studio-accent)] transition hover:bg-[var(--studio-accent-soft)]"
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
