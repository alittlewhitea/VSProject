"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "./studio-link";
import { StudioIcon } from "./studio-navigation";
import type { TaskItem } from "./studio-storage";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type StudioTaskToastProps = {
  tasks: TaskItem[];
  activeCount: number;
  hidden?: boolean;
  t: Translate;
  providerLabel: (provider?: string) => string;
};

export const StudioTaskToast = memo(function StudioTaskToast({ tasks, activeCount, hidden = false, t, providerLabel }: StudioTaskToastProps) {
  const prevStatusRef = useRef<Map<string, TaskItem["status"]>>(new Map());
  const initializedRef = useRef(false);
  const [completedTask, setCompletedTask] = useState<TaskItem | null>(null);
  const [dismissedActiveCount, setDismissedActiveCount] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (initializedRef.current) {
      const newlyCompleted = tasks.find((task) => {
        const previous = prev.get(task.id);
        return (previous === "Queued" || previous === "Running") && task.status === "Completed";
      });
      if (newlyCompleted) setCompletedTask(newlyCompleted);
    } else if (tasks.length > 0) {
      initializedRef.current = true;
    }
    const next = new Map<string, TaskItem["status"]>();
    for (const task of tasks) next.set(task.id, task.status);
    prevStatusRef.current = next;
  }, [tasks]);

  useEffect(() => {
    if (!completedTask) return;
    const timer = window.setTimeout(() => {
      setCompletedTask((current) => (current?.id === completedTask.id ? null : current));
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [completedTask]);

  useEffect(() => {
    if (activeCount === 0) {
      setDismissedActiveCount(null);
    } else if (dismissedActiveCount !== null && activeCount > dismissedActiveCount) {
      setDismissedActiveCount(null);
    }
  }, [activeCount, dismissedActiveCount]);

  if (hidden) return null;

  if (completedTask) {
    const label = completedTask.title || completedTask.prompt?.trim().split(/\s+/).slice(0, 6).join(" ") || providerLabel(completedTask.provider);
    return (
      <div className="df-task-toast df-task-toast--done" role="status" aria-live="polite" data-studio-task-toast="completed">
        <span className="df-task-toast-icon" aria-hidden="true">
          {completedTask.type === "Image" && completedTask.mediaUrl ? (
            <img src={completedTask.mediaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <StudioIcon name="check" className="h-4 w-4" />
          )}
        </span>
        <div className="df-task-toast-copy">
          <strong>{t("studio.projects.taskReady")}</strong>
          <span>{label}</span>
        </div>
        <Link
          href={`/studio?view=projects&taskId=${encodeURIComponent(completedTask.id)}`}
          className="df-task-toast-link"
          onClick={() => setCompletedTask(null)}
        >
          {t("studio.workspace.viewProjects")}
        </Link>
        <button
          type="button"
          className="df-task-toast-close"
          aria-label={t("studio.modal.close")}
          onClick={() => setCompletedTask(null)}
        >
          <StudioIcon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (activeCount > 0 && dismissedActiveCount === null) {
    return (
      <div className="df-task-toast df-task-toast--active" role="status" aria-live="polite" data-studio-task-toast="active">
        <span className="df-task-toast-pulse" aria-hidden="true" />
        <div className="df-task-toast-copy">
          <strong>{t("studio.summary.runningTasks", { count: activeCount })}</strong>
        </div>
        <Link href="/studio?view=projects" className="df-task-toast-link">
          {t("studio.workspace.viewProjects")}
        </Link>
        <button
          type="button"
          className="df-task-toast-close"
          aria-label={t("studio.modal.close")}
          onClick={() => setDismissedActiveCount(activeCount)}
        >
          <StudioIcon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
});
