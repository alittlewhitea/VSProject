import { mysqlExecute } from "./mysql";
import { avatarMediaUrl, type HeygenAvatar } from "./heygen-avatar-types";

export const AVATAR_FAVORITES_SCHEMA = `create table if not exists studio_avatar_favorites (
  user_id varchar(191) not null,
  avatar_kind varchar(8) not null,
  avatar_id varchar(160) not null,
  item_json json not null,
  created_at timestamp not null default current_timestamp,
  primary key (user_id, avatar_kind, avatar_id)
) character set utf8mb4 collate utf8mb4_bin`;

let schema: Promise<unknown> | null = null;
async function ensureSchema() {
  if (!schema) schema = mysqlExecute(AVATAR_FAVORITES_SCHEMA).catch(error => { schema=null; throw error; });
  await schema;
}

export function favoriteAvatar(value: unknown): HeygenAvatar | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<HeygenAvatar>;
  if (typeof row.id !== "string" || !/^[\w-]{1,160}$/.test(row.id) || (row.kind!=="group" && row.kind!=="look") || typeof row.name!=="string") return null;
  return {
    id:row.id,kind:row.kind,name:row.name.slice(0,200),
    groupId:typeof row.groupId === "string" && /^[\w-]{1,160}$/.test(row.groupId) ? row.groupId : null,
    previewImageUrl:avatarMediaUrl(row.previewImageUrl),previewVideoUrl:avatarMediaUrl(row.previewVideoUrl),
    looksCount:typeof row.looksCount === "number" && Number.isFinite(row.looksCount) ? Math.max(0,Math.trunc(row.looksCount)) : null,
    gender:typeof row.gender === "string" ? row.gender.slice(0,30) : null,
    tags:Array.isArray(row.tags) ? row.tags.filter((tag):tag is string=>typeof tag==="string").slice(0,30).map(tag=>tag.slice(0,60)) : [],
    ageGroup:typeof row.ageGroup === "string" ? row.ageGroup.slice(0,60) : null,
    ethnicity:typeof row.ethnicity === "string" ? row.ethnicity.slice(0,60) : null,
    avatarType:typeof row.avatarType === "string" ? row.avatarType.slice(0,60) : null
  };
}

export async function listAvatarFavorites(userId: string) {
  await ensureSchema();
  const rows = await mysqlExecute<Array<{item_json:unknown}>>("select item_json from studio_avatar_favorites where user_id = ? order by created_at desc, avatar_id desc",[userId]);
  return rows.flatMap(row=>{
    try { const item=favoriteAvatar(typeof row.item_json === "string" ? JSON.parse(row.item_json) : row.item_json); return item ? [item] : []; } catch { return []; }
  });
}

export async function saveAvatarFavorite(userId: string, item: HeygenAvatar) {
  await ensureSchema();
  await mysqlExecute("insert into studio_avatar_favorites (user_id,avatar_kind,avatar_id,item_json) values (?,?,?,?) on duplicate key update item_json = values(item_json)",[userId,item.kind,item.id,JSON.stringify(item)]);
}

export async function removeAvatarFavorite(userId: string, kind: string, id: string) {
  await ensureSchema();
  await mysqlExecute("delete from studio_avatar_favorites where user_id = ? and avatar_kind = ? and avatar_id = ?",[userId,kind,id]);
}
