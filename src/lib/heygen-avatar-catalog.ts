import { createHash } from "node:crypto";
import { normalizeHeygenAvatar, type HeygenAvatarPage } from "./heygen-avatar-types";

export class HeygenCatalogError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

const pages = new Map<string, { expires:number; value:Promise<HeygenAvatarPage> }>();

// Public, read-only catalog discovery. Never accept a client-selected upstream
// host, ownership or API key; never call HeyGen video-generation endpoints.
export async function listHeygenPublicAvatars(options: {kind:"group" | "look"; groupId?:string; token?:string; preview?:boolean}) {
  const apiKey = process.env.HEYGEN_API_KEY?.trim();
  if (!apiKey) throw new HeygenCatalogError("heygen_not_configured",503);
  const params = new URLSearchParams({ownership:"public",limit:options.preview ? "3" : "50"});
  if (options.groupId) params.set("group_id",options.groupId);
  if (options.token) params.set("token",options.token);
  const endpoint = options.kind === "look" ? "avatars/looks" : "avatars";
  const cacheKey = createHash("sha256").update(apiKey).digest("hex") + ":" + endpoint + "?" + params;
  const cached = pages.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = (async (): Promise<HeygenAvatarPage> => {
    let response: Response;
    try {
      response = await fetch(`https://api.heygen.com/v3/${endpoint}?${params}`, {
        method:"GET", headers:{"X-Api-Key":apiKey,Accept:"application/json"},
        cache:"no-store", redirect:"error", signal:AbortSignal.timeout(15_000)
      });
    } catch { throw new HeygenCatalogError("heygen_unavailable",502); }
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? "heygen_key_rejected" : response.status === 429 ? "heygen_rate_limited" : "heygen_unavailable";
      throw new HeygenCatalogError(code,response.status === 429 ? 429 : 502);
    }
    let payload: {data?:unknown; has_more?:boolean; next_token?:unknown};
    try { payload = await response.json(); } catch { throw new HeygenCatalogError("heygen_invalid_response",502); }
    if (!Array.isArray(payload?.data)) throw new HeygenCatalogError("heygen_invalid_response",502);
    const nextToken = typeof payload.next_token === "string" && payload.next_token.length <= 2048 ? payload.next_token : null;
    if (payload.has_more && !nextToken) throw new HeygenCatalogError("heygen_invalid_response",502);
    return {items:payload.data.map(row=>normalizeHeygenAvatar(row,options.kind)).filter(item=>item!==null),hasMore:Boolean(payload.has_more),nextToken:payload.has_more ? nextToken : null};
  })();
  if (pages.size >= 128) pages.delete(pages.keys().next().value!);
  const entry = {expires:Date.now()+5*60_000,value};
  pages.set(cacheKey,entry);
  try { return await value; } catch (error) { if (pages.get(cacheKey) === entry) pages.delete(cacheKey); throw error; }
}
