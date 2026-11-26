"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "./studio-link";
import { StudioIcon } from "./studio-navigation";
import {
  studioTaskDisplayTitle,
  studioTaskDownloadHref,
  studioTaskMatchesWorkspaceMode,
  studioTaskNextSteps,
  studioTaskProgress,
  studioTaskProjectHref,
  studioTaskRegenerateHref,
  type StudioTaskRecord,
  type StudioWorkbenchMode
} from "./studio-task-actions";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type StudioRecentResultsProps = {
  mode: StudioWorkbenchMode;
  tasks: StudioTaskRecord[];
  duration: string;
  t: Translate;
  providerLabel: (provider?: string) => string;
  onPreview: (media: { url: string; type: "Image" | "Video" }) => void;
};

const MAX_RECENT_ITEMS = 6;

export const StudioRecentResults = memo(function StudioRecentResults({
  mode,
  tasks,
  duration,
  t,
  providerLabel,
  onPreview
}: StudioRecentResultsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const modeTasks = useMemo(
    () => tasks.filter((task) => studioTaskMatchesWorkspaceMode(task, mode)).slice(0, MAX_RECENT_ITEMS),
    [mode, tasks]
  );
  const activeCount = useMemo(
    () => modeTasks.filter((task) => task.status === "Queued" || task.status === "Running").length,
    [modeTasks]
  );
  const prevActiveCountRef = useRef(activeCount);
  useEffect(() => {
    if (activeCount > prevActiveCountRef.current) {
      setCollapsed(false);
      setSelectedTaskId(null);
    }
    prevActiveCountRef.current = activeCount;
  }, [activeCount]);

  useEffect(() => {
    setExpandedCardId(null);
    setSelectedTaskId(null);
  }, [mode]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (activeCount === 0) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 3000);
    return () => window.clearInterval(timer);
  }, [activeCount]);

  if (modeTasks.length === 0) return null;

  const useCinemaStage = mode !== "audio" && modeTasks.length >= 2;
  const heroTask = (selectedTaskId ? modeTasks.find((task) => task.id === selectedTaskId) : null) || modeTasks[0];
  const heroTitle = studioTaskDisplayTitle(heroTask, providerLabel);
  const heroMediaUrl = heroTask.mediaUrl || heroTask.mediaUrls?.[0] || null;
  const heroIsActive = heroTask.status === "Queued" || heroTask.status === "Running";
  const heroIsFailed = heroTask.status === "Failed";
  const heroIsCompleted = heroTask.status === "Completed";
  const heroSteps = studioTaskNextSteps(heroTask, heroMediaUrl);

  return (
    <section
      className="df-recent-strip"
      data-studio-recent-results={mode}
      aria-label={t("studio.workbench.recent")}
    >
      <div className="df-recent-strip-header">
        <div className="df-recent-strip-title">
          {activeCount > 0 ? <span className="df-recent-strip-pulse" aria-hidden="true" /> : null}
          <h2>{t("studio.workbench.recent")}</h2>
          <span className="df-recent-strip-count">
            {activeCount > 0
              ? t("studio.workbench.inProgressCount", { count: activeCount })
              : modeTasks.length}
          </span>
        </div>
        <div className="df-recent-strip-controls">
          <button
            type="button"
            className="df-recent-strip-toggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? t("studio.workbench.expand") : t("studio.workbench.collapse")}
          </button>
          <Link href="/studio?view=projects" className="df-recent-strip-all">
            <span>{t("studio.workbench.allProjects")}</span>
            <StudioIcon name="chevron-right" className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      {!collapsed ? (
        useCinemaStage ? (
          <div className="df-prism-stage">
            <article className="df-prism-hero" data-recent-task-status={heroTask.status.toLowerCase()}>
              <div className="df-prism-hero-media">
                <div className="df-prism-hero-top">
                  <span className="df-prism-glass-chip">{providerLabel(heroTask.provider)}</span>
                  <div className="df-prism-hero-tools">
                    <Link
                      href={studioTaskRegenerateHref(heroTask)}
                      className="df-recent-overlay-btn"
                      aria-label={`${heroIsFailed ? t("studio.projects.retry") : t("studio.projects.regenerate")}: ${heroTitle}`}
                      title={heroIsFailed ? t("studio.projects.retry") : t("studio.projects.regenerate")}
                    >
                      ↻
                    </Link>
                    {heroIsCompleted && heroMediaUrl ? (
                      <a
                        href={studioTaskDownloadHref(heroTask.id)}
                        className="df-recent-overlay-btn"
                        aria-label={`${t("studio.projects.download")}: ${heroTitle}`}
                        title={t("studio.projects.download")}
                      >
                        ⇩
                      </a>
                    ) : null}
                  </div>
                </div>

                {heroIsCompleted && heroMediaUrl && heroTask.type === "Image" ? (
                  <button
                    type="button"
                    className="df-recent-media-trigger"
                    aria-label={`${t("studio.workbench.openPreview")}: ${heroTitle}`}
                    onClick={() => onPreview({ url: heroMediaUrl, type: "Image" })}
                  >
                    <img src={heroMediaUrl} alt={heroTitle} loading="lazy" />
                    {heroTask.mediaUrls && heroTask.mediaUrls.length > 1 ? (
                      <span className="df-recent-batch-badge">×{heroTask.mediaUrls.length}</span>
                    ) : null}
                  </button>
                ) : heroIsCompleted && heroMediaUrl && heroTask.type === "Video" ? (
                  <button
                    type="button"
                    className="df-recent-media-trigger"
                    aria-label={`${t("studio.workbench.openPreview")}: ${heroTitle}`}
                    onClick={() => onPreview({ url: heroMediaUrl, type: "Video" })}
                  >
                    <video src={heroMediaUrl} muted playsInline preload="metadata" />
                    <span className="df-recent-play-badge" aria-hidden="true">▶</span>
                  </button>
                ) : (
                  <Link href={studioTaskProjectHref(heroTask.id)} className="df-recent-media-placeholder">
                    <span className={`df-recent-status-pill df-recent-status-pill--${heroTask.status.toLowerCase()}`}>
                      {t(`studio.task.${heroTask.status.toLowerCase()}`)}
                    </span>
                    {heroIsActive ? (
                      <span className="df-recent-progress-track" aria-hidden="true">
                        <span
                          className="df-recent-progress-fill"
                          style={{ width: `${studioTaskProgress(heroTask, duration, now)}%` }}
                        />
                      </span>
                    ) : null}
                  </Link>
                )}

                <div className="df-prism-hero-scrim" aria-hidden="true" />
                <div className="df-prism-hero-caption">
                  <div className="min-w-0">
                    <Link href={studioTaskProjectHref(heroTask.id)} className="df-prism-hero-title" title={heroTitle}>
                      {heroTitle}
                    </Link>
                    {heroSteps.length > 0 ? (
                      <div className="df-prism-hero-steps" aria-label={t("studio.projects.nextSteps")}>
                        {heroSteps.slice(0, 3).map((step) => (
                          <Link key={step.id} href={step.href} className="df-prism-step-chip">
                            {t(step.labelKey)}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Link
                    href={studioTaskProjectHref(heroTask.id)}
                    className="df-prism-glass-chip df-prism-glass-chip--accent"
                    aria-label={`${t("studio.workbench.openProjects")}: ${heroTitle}`}
                  >
                    <span>{t("studio.workbench.openProjects")}</span>
                    <StudioIcon name="chevron-right" className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </article>

            <div className="df-prism-reel" role="list">
              {modeTasks.slice(0, 4).map((task) => {
                const title = studioTaskDisplayTitle(task, providerLabel);
                const mediaUrl = task.mediaUrl || task.mediaUrls?.[0] || null;
                const isSelected = task.id === heroTask.id;
                const isActive = task.status === "Queued" || task.status === "Running";
                const isCompleted = task.status === "Completed";
                return (
                  <button
                    key={task.id}
                    type="button"
                    role="listitem"
                    aria-pressed={isSelected}
                    className="df-prism-take"
                    data-recent-task-status={task.status.toLowerCase()}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="df-prism-take-thumb">
                      {isCompleted && mediaUrl && task.type === "Image" ? (
                        <img src={mediaUrl} alt={title} loading="lazy" />
                      ) : isCompleted && mediaUrl && task.type === "Video" ? (
                        <video src={mediaUrl} muted playsInline preload="metadata" />
                      ) : (
                        <span className={`df-recent-status-pill df-recent-status-pill--${task.status.toLowerCase()}`}>
                          {isActive ? `${studioTaskProgress(task, duration, now)}%` : t(`studio.task.${task.status.toLowerCase()}`)}
                        </span>
                      )}
                    </div>
                    <div className="df-prism-take-copy">
                      <span className="df-prism-take-title">{title}</span>
                      <span className="df-prism-take-meta">{providerLabel(task.provider)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="df-recent-grid">
            {modeTasks.map((task) => {
              const title = studioTaskDisplayTitle(task, providerLabel);
              const isActive = task.status === "Queued" || task.status === "Running";
              const isFailed = task.status === "Failed";
              const isCompleted = task.status === "Completed";
              const mediaUrl = task.mediaUrl || task.mediaUrls?.[0] || null;
              const nextSteps = studioTaskNextSteps(task, mediaUrl);
              const primarySteps = nextSteps.slice(0, 2);
              const extraSteps = nextSteps.slice(2);
              const showExtra = expandedCardId === task.id;
              const statusText = t(`studio.task.${task.status.toLowerCase()}`);

              return (
                <article key={task.id} className="df-recent-card" data-recent-task-status={task.status.toLowerCase()}>
                  <div className={`df-recent-media${task.type === "Audio" ? " df-recent-media--audio" : ""}`}>
                    {task.type !== "Audio" ? (
                      <div className="df-recent-media-overlay">
                        <Link
                          href={studioTaskRegenerateHref(task)}
                          className="df-recent-overlay-btn"
                          aria-label={`${isFailed ? t("studio.projects.retry") : t("studio.projects.regenerate")}: ${title}`}
                          title={isFailed ? t("studio.projects.retry") : t("studio.projects.regenerate")}
                        >
                          ↻
                        </Link>
                        {isCompleted && mediaUrl ? (
                          <a
                            href={studioTaskDownloadHref(task.id)}
                            className="df-recent-overlay-btn"
                            aria-label={`${t("studio.projects.download")}: ${title}`}
                            title={t("studio.projects.download")}
                          >
                            ⇩
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {isCompleted && mediaUrl && task.type === "Image" ? (
                      <button
                        type="button"
                        className="df-recent-media-trigger"
                        aria-label={`${t("studio.workbench.openPreview")}: ${title}`}
                        onClick={() => onPreview({ url: mediaUrl, type: "Image" })}
                      >
                        <img src={mediaUrl} alt={title} loading="lazy" />
                        {task.mediaUrls && task.mediaUrls.length > 1 ? (
                          <span className="df-recent-batch-badge">×{task.mediaUrls.length}</span>
                        ) : null}
                      </button>
                    ) : isCompleted && mediaUrl && task.type === "Video" ? (
                      <button
                        type="button"
                        className="df-recent-media-trigger"
                        aria-label={`${t("studio.workbench.openPreview")}: ${title}`}
                        onClick={() => onPreview({ url: mediaUrl, type: "Video" })}
                      >
                        <video src={mediaUrl} muted playsInline preload="metadata" />
                        <span className="df-recent-play-badge" aria-hidden="true">▶</span>
                      </button>
                    ) : isCompleted && mediaUrl && task.type === "Audio" ? (
                      <div className="df-recent-audio-player">
                        <span className="df-recent-audio-icon" aria-hidden="true">♫</span>
                        <audio src={mediaUrl} controls preload="none" className="w-full min-w-0" />
                      </div>
                    ) : (
                      <Link href={studioTaskProjectHref(task.id)} className="df-recent-media-placeholder">
                        <span className={`df-recent-status-pill df-recent-status-pill--${task.status.toLowerCase()}`}>
                          {statusText}
                        </span>
                        {isActive ? (
                          <span className="df-recent-progress-track" aria-hidden="true">
                            <span
                              className="df-recent-progress-fill"
                              style={{ width: `${studioTaskProgress(task, duration, now)}%` }}
                            />
                          </span>
                        ) : null}
                      </Link>
                    )}
                    {task.type !== "Audio" ? (
                      <span className="df-recent-model-pill">{providerLabel(task.provider)}</span>
                    ) : null}
                  </div>

                  <div className="df-recent-body">
                    <div className="df-recent-meta">
                      <Link href={studioTaskProjectHref(task.id)} className="df-recent-card-title" title={title}>
                        {title}
                      </Link>
                      {task.type === "Audio" ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Link
                            href={studioTaskRegenerateHref(task)}
                            className="df-recent-next-more"
                            title={isFailed ? t("studio.projects.retry") : t("studio.projects.regenerate")}
                          >
                            {isFailed ? t("studio.projects.retry") : t("studio.projects.regenerate")}
                          </Link>
                          {isCompleted && mediaUrl ? (
                            <a
                              href={studioTaskDownloadHref(task.id)}
                              className="df-recent-next-more"
                              aria-label={`${t("studio.projects.download")}: ${title}`}
                              title={t("studio.projects.download")}
                            >
                              ⇩
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <Link
                          href={studioTaskProjectHref(task.id)}
                          className="shrink-0 text-[var(--df-muted)] hover:text-[var(--df-ink)]"
                          aria-label={`${t("studio.workbench.openProjects")}: ${title}`}
                          title={t("studio.workbench.openProjects")}
                        >
                          <StudioIcon name="chevron-right" className="h-3.5 w-3.5 rtl:rotate-180" />
                        </Link>
                      )}
                    </div>

                    {primarySteps.length > 0 ? (
                      <div className="df-recent-next-steps" aria-label={t("studio.projects.nextSteps")}>
                        {primarySteps.map((step) => (
                          <Link key={step.id} href={step.href} className="df-recent-next-chip">
                            {t(step.labelKey)}
                          </Link>
                        ))}
                        {extraSteps.length > 0 ? (
                          <button
                            type="button"
                            className="df-recent-next-more"
                            aria-expanded={showExtra}
                            onClick={() => setExpandedCardId((current) => (current === task.id ? null : task.id))}
                          >
                            {showExtra ? "−" : `+${extraSteps.length}`}
                          </button>
                        ) : null}
                        {showExtra
                          ? extraSteps.map((step) => (
                              <Link key={step.id} href={step.href} className="df-recent-next-chip">
                                {t(step.labelKey)}
                              </Link>
                            ))
                          : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : null}
    </section>
  );
});
