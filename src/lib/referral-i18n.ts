import { createTranslator } from "next-intl";
import english from "../../messages/en.json";
import simplified from "../../messages/zh-CN.json";
import traditional from "../../messages/zh-TW.json";

// Studio keeps its own live locale state, independent of the marketing provider.
export function referralTranslator(locale: string) {
  const messages=locale==="zh-CN"?simplified.referrals:locale==="zh-TW"?traditional.referrals:english.referrals;
  return createTranslator({locale,messages});
}
