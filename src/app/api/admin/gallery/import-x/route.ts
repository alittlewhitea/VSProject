import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAdminUserFromRequest } from "../../../../../lib/admin-auth";

const execFileAsync = promisify(execFile);

type XTweet = {
  id: string;
  text: string;
  note_tweet?: {
    text?: string;
  };
  author_id: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
  attachments?: {
    media_keys?: string[];
  };
};

type XUser = {
  id: string;
  name: string;
  username: string;
};

type XMedia = {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
};

type XSearchResponse = {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
    media?: XMedia[];
  };
  meta?: {
    result_count?: number;
    next_token?: string;
    newest_id?: string;
    oldest_id?: string;
  };
  errors?: unknown[];
};

type XLookupResponse = {
  data?: XTweet;
  includes?: {
    users?: XUser[];
    media?: XMedia[];
  };
  errors?: unknown[];
  detail?: string;
  title?: string;
};

type XCandidate = {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  authorName: string;
  authorHandle: string;
  sourceUrl: string;
  media: Array<{
    url: string;
    type: string;
    width: number | null;
    height: number | null;
  }>;
};

const DEFAULT_QUERY =
  '("GPT Image 2" OR "GPT-image-2" OR "GPT Image V2" OR "ChatGPT image" OR "ChatGPT images" OR "gpt-image-2") has:images -is:retweet';

function extractTweetId(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  const direct = trimmed.match(/^\d{8,}$/)?.[0];
  if (direct) return direct;
  return trimmed.match(/status\/(\d{8,})/)?.[1] || null;
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function isIsoDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function buildXSearchUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  const query = url.searchParams.get("query")?.trim() || DEFAULT_QUERY;
  const startDate = isIsoDate(url.searchParams.get("start")) ? url.searchParams.get("start") : "2026-04-01";
  const endDate = isIsoDate(url.searchParams.get("end")) ? url.searchParams.get("end") : "2026-05-01";
  const maxResults = clampInt(url.searchParams.get("maxResults"), 25, 10, 100);
  const nextToken = url.searchParams.get("nextToken")?.trim();

  const params = new URLSearchParams({
    query,
    start_time: `${startDate}T00:00:00Z`,
    end_time: `${endDate}T00:00:00Z`,
    max_results: String(maxResults),
    "tweet.fields": "created_at,public_metrics,author_id,attachments,note_tweet",
    expansions: "author_id,attachments.media_keys",
    "user.fields": "username,name",
    "media.fields": "url,preview_image_url,type,width,height"
  });

  if (nextToken) {
    params.set("next_token", nextToken);
  }

  return `https://api.x.com/2/tweets/search/all?${params.toString()}`;
}

function buildXTweetLookupUrl(tweetId: string) {
  const params = new URLSearchParams({
    "tweet.fields": "created_at,public_metrics,author_id,attachments,note_tweet",
    expansions: "author_id,attachments.media_keys",
    "user.fields": "username,name",
    "media.fields": "url,preview_image_url,type,width,height"
  });

  return `https://api.x.com/2/tweets/${tweetId}?${params.toString()}`;
}

function getExcludeTerms(requestUrl: string) {
  const url = new URL(requestUrl);
  const rawTerms =
    url.searchParams.get("excludeTerms") ||
    "without AI,no AI,not AI,created without AI,real photo,Midjourney,Stable Diffusion,Flux";

  return rawTerms
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function includesExcludedTerm(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

async function fetchXSearchWithNode(xUrl: string, bearerToken: string) {
  const response = await fetch(xUrl, {
    headers: {
      Authorization: `Bearer ${bearerToken}`
    },
    cache: "no-store",
    signal: AbortSignal.timeout(45000)
  });

  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
  };
}

async function fetchXSearchWithPowerShell(xUrl: string, bearerToken: string) {
  const script = `
$ErrorActionPreference = 'Stop'
try {
  $res = Invoke-WebRequest -UseBasicParsing -Uri $env:X_SEARCH_URL -Headers @{ Authorization = "Bearer $env:X_BEARER_TOKEN" } -Method Get -TimeoutSec 60
  @{ status = [int]$res.StatusCode; content = $res.Content } | ConvertTo-Json -Compress
} catch {
  $status = 502
  $content = $_.Exception.Message
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
    try {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $content = $reader.ReadToEnd()
    } catch {}
  }
  @{ status = $status; content = $content } | ConvertTo-Json -Compress
}
`;

  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: {
      ...process.env,
      X_SEARCH_URL: xUrl,
      X_BEARER_TOKEN: bearerToken
    },
    timeout: 70000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });

  const envelope = JSON.parse(stdout.trim()) as { status: number; content: string };
  return {
    ok: envelope.status >= 200 && envelope.status < 300,
    status: envelope.status,
    text: envelope.content || ""
  };
}

async function fetchXSearch(xUrl: string, bearerToken: string) {
  try {
    return await fetchXSearchWithNode(xUrl, bearerToken);
  } catch (nodeError) {
    if (process.platform !== "win32") {
      throw nodeError;
    }

    return fetchXSearchWithPowerShell(xUrl, bearerToken);
  }
}

function mapTweetToCandidate(tweet: XTweet, users: XUser[] = [], mediaItems: XMedia[] = []): XCandidate {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const mediaByKey = new Map(mediaItems.map((media) => [media.media_key, media]));
  const user = usersById.get(tweet.author_id);
  const media = (tweet.attachments?.media_keys || [])
    .map((key) => mediaByKey.get(key))
    .filter((item): item is XMedia => Boolean(item))
    .map((item) => ({
      url: item.url || item.preview_image_url || "",
      type: item.type,
      width: item.width ?? null,
      height: item.height ?? null
    }))
    .filter((item) => Boolean(item.url));

  return {
    id: tweet.id,
    text: tweet.note_tweet?.text || tweet.text,
    createdAt: tweet.created_at,
    likeCount: tweet.public_metrics?.like_count || 0,
    authorName: user?.name || "",
    authorHandle: user?.username || "",
    sourceUrl: user?.username ? `https://x.com/${user.username}/status/${tweet.id}` : `https://x.com/i/status/${tweet.id}`,
    media
  };
}

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUserFromRequest(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
    }

    const bearerToken = process.env.X_BEARER_TOKEN?.trim();
    if (!bearerToken) {
      return NextResponse.json({ error: "X_BEARER_TOKEN is not configured." }, { status: 500 });
    }

    const url = new URL(request.url);
    const tweetId = extractTweetId(url.searchParams.get("tweetUrl") || url.searchParams.get("tweetId"));

    if (tweetId) {
      let response: { ok: boolean; status: number; text: string };
      try {
        response = await fetchXSearch(buildXTweetLookupUrl(tweetId), bearerToken);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? `X API network error: ${error.message}`
                : "X API network error. Please retry in a moment."
          },
          { status: 502 }
        );
      }

      const payload = response.text ? (JSON.parse(response.text) as XLookupResponse) : null;
      if (!response.ok || !payload?.data) {
        const message = payload?.detail || payload?.title || response.text || "X post lookup failed.";
        return NextResponse.json({ error: message, status: response.status, payload }, { status: response.status });
      }

      const candidate = mapTweetToCandidate(payload.data, payload.includes?.users, payload.includes?.media);
      return NextResponse.json({
        candidates: candidate.media.length ? [candidate] : [],
        meta: null,
        fetchedCount: 1,
        minLikes: 0,
        excludeTerms: [],
        adminEmail: adminUser.email
      });
    }

    const minLikes = clampInt(url.searchParams.get("minLikes"), 200, 0, 1000000);
    const excludeTerms = getExcludeTerms(request.url);
    const xUrl = buildXSearchUrl(request.url);

    let response: { ok: boolean; status: number; text: string };
    try {
      response = await fetchXSearch(xUrl, bearerToken);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `X API network error: ${error.message}`
              : "X API network error. Please retry in a moment."
        },
        { status: 502 }
      );
    }

    const rawText = response.text;
    const payload = rawText
      ? (JSON.parse(rawText) as XSearchResponse | { detail?: string; title?: string })
      : null;

    if (!response.ok) {
      const message =
        payload && "detail" in payload && payload.detail
          ? payload.detail
          : payload && "title" in payload && payload.title
            ? payload.title
            : rawText || "X search request failed.";
      return NextResponse.json({ error: message, status: response.status, payload }, { status: response.status });
    }

    const searchPayload = payload as XSearchResponse;
    const candidates: XCandidate[] = (searchPayload.data || [])
      .map((tweet) => mapTweetToCandidate(tweet, searchPayload.includes?.users, searchPayload.includes?.media))
      .filter(
        (candidate) =>
          candidate.likeCount >= minLikes &&
          candidate.media.length > 0 &&
          !includesExcludedTerm(candidate.text, excludeTerms)
      );

    return NextResponse.json({
      candidates,
      meta: searchPayload.meta || null,
      fetchedCount: searchPayload.data?.length || 0,
      minLikes,
      excludeTerms,
      adminEmail: adminUser.email
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `X import failed: ${error.message}`
            : "X import failed. Please retry in a moment."
      },
      { status: 500 }
    );
  }
}
