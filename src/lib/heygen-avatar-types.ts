export type HeygenAvatar = {
  id: string;
  name: string;
  kind: "group" | "look";
  groupId: string | null;
  previewImageUrl: string | null;
  previewVideoUrl: string | null;
  looksCount: number | null;
  gender: string | null;
  ageGroup?: string | null;
  ethnicity?: string | null;
  tags: string[];
  avatarType: string | null;
};

export type HeygenAvatarPage = { items: HeygenAvatar[]; hasMore: boolean; nextToken: string | null };

export function avatarMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function normalizeHeygenAvatar(value: unknown, kind: "group" | "look"): HeygenAvatar | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !/^[\w-]{1,160}$/.test(row.id)) return null;
  return {
    id:row.id, kind, name:typeof row.name === "string" ? row.name.slice(0,200) : row.id,
    groupId:typeof row.group_id === "string" ? row.group_id : null,
    previewImageUrl:avatarMediaUrl(row.preview_image_url), previewVideoUrl:avatarMediaUrl(row.preview_video_url),
    looksCount:typeof row.looks_count === "number" ? Math.max(0,row.looks_count) : null,
    gender:typeof row.gender === "string" ? row.gender : null,
    tags:Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string").slice(0,30) : [],
    ageGroup:typeof row.age_group === "string" ? row.age_group.slice(0,60) : null,
    ethnicity:typeof row.ethnicity === "string" ? row.ethnicity.slice(0,60) : null,
    avatarType:typeof row.avatar_type === "string" ? row.avatar_type : null
  };
}
