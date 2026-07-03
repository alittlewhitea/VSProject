export function cronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  return authorization === `Bearer ${cronSecret}` || url.searchParams.get("secret") === cronSecret;
}
