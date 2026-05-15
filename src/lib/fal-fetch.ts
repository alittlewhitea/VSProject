import { execFile } from "node:child_process";
import { promisify } from "node:util";

type FalFetchOptions = RequestInit & {
  attempts?: number;
  timeoutMs?: number;
};

const execFileAsync = promisify(execFile);

function describeError(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown error";
  }

  const cause = error.cause;
  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string") {
    return `${error.message} (${cause.code})`;
  }

  return error.message;
}

function getHeaderEntries(headers: HeadersInit | undefined) {
  if (!headers) return [];
  if (headers instanceof Headers) return Array.from(headers.entries());
  if (Array.isArray(headers)) return headers;
  return Object.entries(headers);
}

async function fetchFalWithCurl(url: string, options: Omit<FalFetchOptions, "attempts" | "timeoutMs">, timeoutMs: number) {
  const method = options.method || "GET";
  const args = [
    "-sS",
    "-X",
    method,
    "--connect-timeout",
    String(Math.max(3, Math.ceil(timeoutMs / 1000))),
    "--max-time",
    String(Math.max(5, Math.ceil(timeoutMs / 1000) + 5))
  ];

  for (const [key, value] of getHeaderEntries(options.headers)) {
    args.push("-H", `${key}: ${value}`);
  }

  if (typeof options.body === "string") {
    args.push("--data-binary", options.body);
  }

  args.push("-w", "\n__FAL_HTTP_STATUS__:%{http_code}", url);

  const { stdout, stderr } = await execFileAsync("curl.exe", args, {
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024
  });
  const marker = "\n__FAL_HTTP_STATUS__:";
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) {
    throw new Error(stderr.trim() || "curl fallback did not return an HTTP status");
  }

  const body = stdout.slice(0, markerIndex);
  const status = Number(stdout.slice(markerIndex + marker.length).trim());
  return new Response(body, {
    status: Number.isFinite(status) && status > 0 ? status : 502,
    headers: {
      "content-type": "application/json"
    }
  });
}

export async function fetchFal(url: string, options: FalFetchOptions = {}) {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 20000;
  const { attempts: _attempts, timeoutMs: _timeoutMs, ...requestInit } = options;
  let lastError = "request failed";
  const startedAt = Date.now();

  if (process.platform === "win32" && process.env.FAL_USE_NATIVE_FETCH !== "1") {
    try {
      const response = await fetchFalWithCurl(url, requestInit, timeoutMs);
      console.info(`[fal] ${requestInit.method || "GET"} ${url} via curl in ${Date.now() - startedAt}ms`);
      return response;
    } catch (error) {
      lastError = `curl: ${describeError(error)}`;
    }
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: requestInit.signal || controller.signal
      });
      console.info(`[fal] ${requestInit.method || "GET"} ${url} via fetch in ${Date.now() - startedAt}ms`);
      return response;
    } catch (error) {
      lastError = describeError(error);
      if (attempt === attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  if (process.platform === "win32") {
    try {
      const response = await fetchFalWithCurl(url, requestInit, timeoutMs);
      console.info(`[fal] ${requestInit.method || "GET"} ${url} via curl fallback in ${Date.now() - startedAt}ms`);
      return response;
    } catch (error) {
      throw new Error(`fal.ai network error after ${attempts} fetch attempts and curl fallback: ${describeError(error)}; fetch: ${lastError}`);
    }
  }

  throw new Error(`fal.ai network error after ${attempts} attempts: ${lastError}`);
}
