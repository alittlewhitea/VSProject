import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID?.trim() ||
  process.env.DEPLOYMENT_VERSION?.trim() ||
  process.env.GIT_SHA?.trim() ||
  gitSha();

const isProduction = process.env.NODE_ENV === "production";
const marketingCache = JSON.parse(readFileSync(new URL("./src/lib/marketing-cache-settings.json", import.meta.url), "utf8"));
const publicMarketingPaths = [
  ...marketingCache.englishPages,
  ...marketingCache.localeHomes.map(locale => `/${locale}`),
  ...["es", "pt-BR"].flatMap(locale => marketingCache.translatedLandingPages.map(path => `/${locale}${path}`))
];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com" "https://www.sandbox.paypal.com" "https://pay.google.com")' },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com https://www.paypal.com https://www.sandbox.paypal.com https://*.paypalobjects.com https://pay.google.com https://applepay.cdn-apple.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' https: wss:${isProduction ? "" : " ws:"}`,
      "frame-src https://www.googletagmanager.com https://*.paypal.com https://pay.google.com https://applepay.cdn-apple.com",
      "worker-src 'self' blob:"
    ].join("; ")
  },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : [])
];

const nextConfig = {
  // Keep Next's HTML-only crawler list and include Googlebot so indexing
  // directives and canonicals are present in the initial HTML head.
  htmlLimitedBots: /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 30 * 24 * 60 * 60,
    maximumDiskCacheSize: 256 * 1024 * 1024,
    maximumResponseBody: 12 * 1024 * 1024,
    localPatterns: [{ pathname: "/images/**", search: "" }],
    remotePatterns: [
      { protocol: "https", hostname: "resource2.heygen.ai", pathname: "/**" },
      { protocol: "https", hostname: "pbs.twimg.com", pathname: "/media/**" },
      { protocol: "https", hostname: "v3b.fal.media", pathname: "/files/**" },
      { protocol: "https", hostname: "refinery.fal.media", pathname: "/url/**" }
    ]
  },
  ...(deploymentId ? { deploymentId } : {}),
  devIndicators: false,
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId || "local"
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      // Header matchers run before Next strips Flight headers for middleware.
      // Keep document caching separate from RSC/prefetch/action variants.
      ...(isProduction ? publicMarketingPaths.map(source => ({
        source,
        missing: [
          ...marketingCache.nonHtmlHeaders.map(key => ({ type: "header", key })),
          { type: "header", key: "accept", value: ".*text/x-component.*" }
        ],
        headers: [{ key: "Cache-Control", value: marketingCache.publicCacheControl }]
      })) : []),
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          },
          {
            key: "X-DreamFace-Deploy",
            value: deploymentId || "local"
          }
        ]
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
          },
          {
            key: "X-DreamFace-Deploy",
            value: deploymentId || "local"
          }
        ]
      },
      ...["/", "/studio", "/auth", "/billing", "/price", "/creations", "/gallery", "/admin"].map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
          },
          {
            key: "X-DreamFace-Deploy",
            value: deploymentId || "local"
          }
        ]
      })),
      ...["/studio/:path*", "/auth/:path*", "/billing/:path*", "/price/:path*", "/creations/:path*", "/gallery/:path*", "/admin/:path*"].map(
        (source) => ({
          source,
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
            },
            {
              key: "X-DreamFace-Deploy",
              value: deploymentId || "local"
            }
          ]
        })
      )
    ];
  }
};

export default withNextIntl(nextConfig);
