import type { Locale } from "./routing";
import {loadCreditShopMessages} from "../lib/credit-shop-message-loader";

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
  const selected=await loadCreditShopMessages(locale);
  const creditShop = Object.fromEntries(Object.entries(selected).map(([key,value])=>[key.replace(/^creditShop\./,""),value]));
  if (locale === "en") return mergeMessages(english,{creditShop});

  const localized = (await import(`../../messages/${locale}.json`)).default as MessageTree;
  return mergeMessages(mergeMessages(english, localized), {creditShop});
}
