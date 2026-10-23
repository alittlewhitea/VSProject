"use client";

import { useEffect, useState } from "react";

/** Fetch large settings only for the selected creation, never for the list. */
export function useTaskDetails<T extends { id: string }>(id: string | null | undefined, accessToken: string | null, enabled = true) {
  const [result, setResult] = useState<{ id: string; token: string; task: T } | null>(null);
  useEffect(() => {
    if (!enabled || !id || !accessToken) return;
    const controller = new AbortController();
    void fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal
    }).then(async response => {
      if (!response.ok) return;
      const payload = await response.json() as { tasks?: T[] };
      const task = payload.tasks?.find(item => item.id === id);
      if (task && !controller.signal.aborted) setResult({ id, token: accessToken, task });
    }).catch(() => undefined);
    return () => controller.abort();
  }, [id, accessToken, enabled]);
  return enabled && result && result.id === id && result.token === accessToken ? result.task : null;
}
