import type { Locale } from "../i18n/routing";

const hdRatios: Record<Locale, string> = {
  en: "1080p and 2K support only 16:9 or 9:16. The aspect ratio adjusts to match; use 480p or 768p for other formats.",
  "zh-CN": "1080p、2K 仅支持 16:9 或 9:16，比例会相应调整。其他比例请选择 480p 或 768p。",
  "zh-TW": "1080p、2K 僅支援 16:9 或 9:16，比例會相應調整。其他比例請選擇 480p 或 768p。",
  "pt-BR": "1080p e 2K aceitam apenas 16:9 ou 9:16. A proporção é ajustada; use 480p ou 768p para outros formatos.",
  ru: "1080p и 2K поддерживают только 16:9 или 9:16. Пропорции корректируются; для других форматов выберите 480p или 768p.",
  vi: "1080p và 2K chỉ hỗ trợ 16:9 hoặc 9:16. Tỷ lệ sẽ được điều chỉnh; chọn 480p hoặc 768p cho định dạng khác.",
  de: "1080p und 2K unterstützen nur 16:9 oder 9:16. Das Format wird angepasst; wähle 480p oder 768p für andere Formate.",
  fr: "1080p et 2K ne prennent en charge que 16:9 ou 9:16. Le format s’ajuste ; choisissez 480p ou 768p pour les autres formats.",
  ja: "1080p・2Kは16:9または9:16のみ対応し、比率が調整されます。他の比率には480pまたは768pを選んでください。",
  th: "1080p และ 2K รองรับเฉพาะ 16:9 หรือ 9:16 ระบบจะปรับอัตราส่วนให้เหมาะสม สำหรับอัตราส่วนอื่นให้เลือก 480p หรือ 768p",
  nl: "1080p en 2K ondersteunen alleen 16:9 of 9:16. De verhouding wordt aangepast; kies 480p of 768p voor andere formaten.",
  he: "1080p ו־2K תומכים רק ב־16:9 או 9:16. יחס התמונה מותאם; לפורמטים אחרים בחרו 480p או 768p.",
  ko: "1080p와 2K는 16:9 또는 9:16만 지원하며 비율이 조정됩니다. 다른 비율은 480p 또는 768p를 선택하세요.",
  es: "1080p y 2K solo admiten 16:9 o 9:16. La proporción se ajusta; elige 480p o 768p para otros formatos.",
  it: "1080p e 2K supportano solo 16:9 o 9:16. Il rapporto viene adattato; scegli 480p o 768p per altri formati.",
  ar: "يدعم 1080p و2K نسبتي 16:9 و9:16 فقط، ويتم ضبط النسبة وفقًا لذلك. للنسب الأخرى اختر 480p أو 768p."
};

export const studioHeygenMessages = Object.fromEntries(Object.entries(hdRatios).map(([locale, text]) => [locale, {
  "studio.heygen.hdRatios": text
}]));
