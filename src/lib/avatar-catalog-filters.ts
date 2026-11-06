import type { HeygenAvatar } from "./heygen-avatar-types";

// The public group catalog has no supported style/category field.
export const avatarCategories = ["all", "favorites"] as const;
export type AvatarCategory = typeof avatarCategories[number];
export const avatarFilterOptions = { gender: ["woman", "man"] } as const;
export type AvatarFilterField = keyof typeof avatarFilterOptions;
export type AvatarFilters = Record<AvatarFilterField, string[]>;
export const emptyAvatarFilters = (): AvatarFilters => ({gender: []});

const aliases: Record<string, string> = {female: "woman", woman: "woman", male: "man", man: "man"};

/** Use explicit supplier gender only; never infer from a name or image. */
export function avatarFilterValue(item: HeygenAvatar, field: AvatarFilterField): string | null {
  const normalized = typeof item[field] === "string" ? aliases[item[field].toLowerCase().replace(/[\s_-]/g, "")] : null;
  return normalized && (avatarFilterOptions[field] as readonly string[]).includes(normalized) ? normalized : null;
}

export function matchesAvatarFilters(item: HeygenAvatar, filters: AvatarFilters): boolean {
  return !filters.gender.length || filters.gender.includes(avatarFilterValue(item, "gender") || "");
}

export function matchesAvatarCategory(item: HeygenAvatar, category: AvatarCategory, favorites: Set<string>): boolean {
  return category === "all" || favorites.has(`${item.kind}:${item.id}`);
}
