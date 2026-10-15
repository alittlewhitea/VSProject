export const H3_DAILY_FREE_PROVIDER = "minimax-h3-max-turbo-video";
export const H3_DAILY_FREE_PROGRAM = "h3_turbo_480p_5s";

export function isH3DailyFreeRequest(input: {
  mode: string; provider: string; resolution?: string; duration?: string;
}) {
  return (input.mode === "video" || input.mode === "avatar") &&
    input.provider === H3_DAILY_FREE_PROVIDER &&
    (input.resolution || "480p") === "480p" &&
    (input.duration || "5s") === "5s";
}

export function h3DailyFreePeriod(now = new Date()) {
  const day = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  return { day, resetsAt: new Date(Date.parse(`${day}T00:00:00+08:00`) + 86400000).toISOString() };
}
