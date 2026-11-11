"use client";
import {useEffect,useState} from "react";
import {mergeTasks,pickMediaUrl,pickImageOutputUrls,readSessionTasks,safeRemoveLocalStorage,sessionTasksKey,writeSessionTasksCache,type TaskItem} from "./studio-storage";
type Translate=(key:string,values?:Record<string,string|number|null|undefined>)=>string;
export function useStudioTaskHistory(accessToken:string|null,userId:string|null,st:Translate){
const [tasks,setTasks]=useState<TaskItem[]>([]),[taskHistoryNote,setTaskHistoryNote]=useState("");
useEffect(() => {
    if (!accessToken || !userId) return;
    let cancelled = false;
    async function loadHistory(skipSync = false) {
      try {
        const response = await fetch("/api/tasks", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!response.ok) {
          throw new Error("Task history could not be loaded.");
        }
        const payload = (await response.json()) as {
          tasks: Array<{
            id: string;
            mode: "image" | "video" | "audio";
            provider?: string;
            prompt?: string;
            status: "queued" | "running" | "completed" | "failed";
            estimated_credits: number;
            transport?: "real" | "mock";
            created_at?: string;
            status_url?: string | null;
            response_url?: string | null;
            output_url?: string | null;
            raw_result?: unknown;
            title?: string | null;
            is_favorite?: boolean;
            request_settings?: Record<string, unknown> | null;
            charged_credits?: number;
            refunded_credits?: number;
            refund_status?: "refunded" | "not_refunded" | "not_applicable";
            failure_reason?: string | null;
            updated_at?: string | null;
          }>;
          storageWarning?: string;
        };
        const remoteTasks: TaskItem[] = payload.tasks.map((t) => ({
          id: t.id,
          type: t.mode === "image" ? "Image" : t.mode === "audio" ? "Audio" : "Video",
          status:
            t.status === "queued"
              ? "Queued"
              : t.status === "running"
                ? "Running"
                : t.status === "completed"
                  ? "Completed"
                  : "Failed",
          cost: t.estimated_credits,
          title: t.title || null,
          isFavorite: Boolean(t.is_favorite),
          provider: t.provider,
          prompt: t.prompt,
          transport: t.transport,
          createdAt: t.created_at,
          statusUrl: t.status_url || null,
          responseUrl: t.response_url || null,
          mediaUrl: t.output_url || pickMediaUrl(t.raw_result) || null,
          updatedAt: t.updated_at || null,
          settings: t.request_settings || null,
          chargedCredits: t.charged_credits,
          refundedCredits: t.refunded_credits,
          refundStatus: t.refund_status,
          failureReason: t.failure_reason || null
        }));
        if (cancelled) return;
        const sessionTasks = readSessionTasks(userId);
        if (payload.storageWarning) {
          setTasks((currentTasks) => mergeTasks(currentTasks, sessionTasks));
          setTaskHistoryNote(
            sessionTasks.length
              ? st("studio.projects.historyBrowserFallback")
              : payload.storageWarning
          );
          return;
        }
        if (cancelled) return;
        setTasks(mergeTasks(remoteTasks, sessionTasks.filter(task => task.createdAt && Date.now() - new Date(task.createdAt).getTime() < 10 * 60 * 1000)));
        setTaskHistoryNote("");
        if (!skipSync && remoteTasks.some(task => task.status === "Queued" || task.status === "Running")) {
          void fetch("/api/tasks", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } })
            .then(response => { if (response.ok && !cancelled) return loadHistory(true); })
            .catch(() => undefined);
        }
      } catch (error) {
        if (cancelled) return;
        const sessionTasks = readSessionTasks(userId);
        setTasks(sessionTasks);
        setTaskHistoryNote(
          sessionTasks.length
            ? st("studio.projects.historyBrowserFallback")
            : error instanceof Error
              ? error.message
              : st("studio.projects.historyUnavailable")
        );
      }
    }
    void loadHistory();
    return () => { cancelled = true; };
  }, [accessToken, userId]);

useEffect(() => {
    const tasksKey = sessionTasksKey(userId);
    if (typeof window === "undefined" || !tasksKey) {
      return;
    }

    if (tasks.length) {
      writeSessionTasksCache(tasksKey, tasks);
    } else {
      safeRemoveLocalStorage(tasksKey);
    }
  }, [tasks, userId]);
return {tasks,setTasks,taskHistoryNote,setTaskHistoryNote};
}
