// Pure guards for provider status sync. Provider tracking addresses must come
// from the task row the server wrote at submission, never from the browser:
// a client-supplied address could point at another (failed) provider request
// and trigger a refund for a task that is still producing its result.

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export function isAllowedFalUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "queue.fal.run" && !parsed.username && !parsed.password && (!parsed.port || parsed.port === "443");
  } catch {
    return false;
  }
}

/** Terminal tasks have already been settled (charged or refunded) and must not be re-synced. */
export function isTerminalTaskStatus(status: unknown): status is "completed" | "failed" {
  return status === "completed" || status === "failed";
}

/** Status/result addresses to poll, taken only from the stored task row. */
export function providerPollTargets(task: { status_url?: string | null; response_url?: string | null } | null | undefined) {
  if (!task || !isAllowedFalUrl(task.status_url)) return null;
  return {
    statusUrl: task.status_url,
    responseUrl: isAllowedFalUrl(task.response_url) ? task.response_url : null
  };
}
