import type { Locale } from "./routing";

type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessages(base: MessageTree, localized: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };

  for (const [key, value] of Object.entries(localized)) {
    const baseValue = base[key];
    merged[key] =
      typeof value === "object" && typeof baseValue === "object"
        ? mergeMessages(baseValue, value)
        : value;
  }

  return merged;
}

export async function loadMessages(locale: Locale) {
  const english = (await import("../../messages/en.json")).default as MessageTree;
  if (locale === "en") return english;

  const localized = (await import(`../../messages/${locale}.json`)).default as MessageTree;
  return mergeMessages(english, localized);
}
