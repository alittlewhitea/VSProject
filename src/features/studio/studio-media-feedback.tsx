"use client";

import { useEffect, useRef, useState } from "react";

/** A local preview failure is independent of the generation task's status. */
export function useStudioMediaFeedback(src: string | null | undefined) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const currentSource = useRef(src);
  currentSource.current = src;
  useEffect(() => { setFailedSource(null); setAttempt(0); }, [src]);
  return {
    failed: Boolean(src && failedSource === src),
    mediaKey: `${src || ""}:${attempt}`,
    onError: () => { if (src && currentSource.current === src) setFailedSource(src); },
    retry: () => { setFailedSource(null); setAttempt(value => value + 1); }
  };
}

type Translate = (key: string) => string;
export function StudioMediaLoadError({ translate, onRetry, originalUrl, message }: { translate: Translate; onRetry: () => void; originalUrl?: string; message?: string }) {
  return <div className="df-stage-empty df-media-load-error" role="status">
    <p>{message || translate("studio.media.loadError")}</p>
    <button type="button" className="df-button" onClick={onRetry}>{translate("studio.media.retry")}</button>
    {originalUrl ? <a className="df-button" href={originalUrl} target="_blank" rel="noreferrer">{translate("studio.workbench.openPreview")}</a> : null}
  </div>;
}
