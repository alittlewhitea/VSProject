type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

export function localizeStudioErrorMessage(st: Translate, message: string, status?: number) {
  const normalized = message.toLowerCase();
  if (normalized.includes("no recognizable elements") || normalized.includes("clearly visible subject") || normalized.includes("clearly visible subject in the reference image")) {
    return st("studio.error.referenceSubjectNotVisible");
  }
  if (status === 401 || normalized.includes("unauthorized") || normalized.includes("access token")) {
    return st("studio.error.sessionExpired");
  }
  if (normalized.includes("not enough credits") || normalized.includes("insufficient_credits")) {
    return st("studio.error.notEnoughCredits");
  }
  if (status === 413 || normalized.includes("file is too large") || normalized.includes("uploaded file is too large")) {
    return st("studio.error.uploadTooLarge");
  }
  if (normalized.includes("cannot trim audio") || normalized.includes("audio file could not be trimmed")) {
    return st("studio.status.audioTrimFailed");
  }
  if (normalized.includes("pixel budget")) return st("studio.gpt26.gifHint");
  if (
    status === 422 ||
    normalized.includes("nsfw") ||
    normalized.includes("safety policy") ||
    normalized.includes("content policy") ||
    normalized.includes("moderation")
  ) {
    return st("studio.error.contentRejected");
  }
  if (status && status >= 500) {
    return st("studio.error.providerUnavailable");
  }
  return message;
}
