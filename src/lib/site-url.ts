const DEFAULT_SITE_URL = "https://dreamface.io";

export function siteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    process.env.SITE_URL?.trim().replace(/\/$/, "");

  if (!configured || configured.includes("127.0.0.1") || configured.includes("localhost")) {
    return DEFAULT_SITE_URL;
  }

  return configured.startsWith("http://") ? configured.replace("http://", "https://") : configured;
}

export function absoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
