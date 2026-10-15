import type { Locale } from "../i18n/routing";
const english = {
  "studio.h3Free.available": "Today's free generation · H3 Turbo · 480p · 5s · 1/day",
  "studio.h3Free.used": "Today's free generation used · resets at 00:00 Beijing time",
  "studio.h3Free.unavailable": "The free generation is unavailable. No credits were charged. Review the displayed credit cost before trying again."
};
export const studioH3FreeMessages: Record<Locale, Record<string,string>> = {
  "en": english,
  "zh-CN": {
    "studio.h3Free.available": "今日免费生成 · H3 Turbo · 480p · 5 秒 · 每天 1 次",
    "studio.h3Free.used": "今日免费次数已用完 · 北京时间每天 00:00 重置",
    "studio.h3Free.unavailable": "本次免费机会不可用，未扣积分。请确认当前显示的积分费用后再生成。"
  },
  "zh-TW": {
    "studio.h3Free.available": "今日免費生成 · H3 Turbo · 480p · 5 秒 · 每天 1 次",
    "studio.h3Free.used": "今日免費次數已用完 · 北京時間每天 00:00 重置",
    "studio.h3Free.unavailable": "本次免費機會不可用，未扣點數。請確認目前顯示的點數費用後再生成。"
  },
  "pt-BR": english, "ru": english, "vi": english, "de": english,
  "fr": english, "ja": english, "th": english, "nl": english,
  "he": english, "ko": english, "es": english, "it": english, "ar": english
};
