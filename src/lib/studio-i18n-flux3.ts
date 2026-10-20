import type {Locale} from "../i18n/routing";
const english = {
  "studio.model.flux-3-max-video":"FLUX 3 Max supports 5–20 second videos, 720p/1080p, native audio and start/end frames.",
  "studio.flux3.reasoning":"Prompt reasoning",
  "studio.flux3.low":"Low · Faster",
  "studio.flux3.high":"High · More detailed",
  "studio.flux3.promotion":"75% OFF · Ends Nov 7",
  "studio.flux3.priceChanged":"The price has changed. Review the updated credits and try again."
};
export const studioFlux3Messages:Record<Locale,Record<string,string>> = {
  "en":english,
  "zh-CN":{
    "studio.model.flux-3-max-video":"FLUX 3 Max 支持 5–20 秒视频、720p／1080p、原生音频及首尾帧。",
    "studio.flux3.reasoning":"提示词推理强度",
    "studio.flux3.low":"低 · 更快",
    "studio.flux3.high":"高 · 更细致",
    "studio.flux3.promotion":"75% OFF · 11月7日到期",
    "studio.flux3.priceChanged":"积分价格已更新，请确认新的积分消耗后再次生成。"
  },
  "zh-TW":{
    "studio.model.flux-3-max-video":"FLUX 3 Max 支援 5–20 秒影片、720p／1080p、原生音訊及首尾影格。",
    "studio.flux3.reasoning":"提示詞推理強度",
    "studio.flux3.low":"低 · 更快",
    "studio.flux3.high":"高 · 更細緻",
    "studio.flux3.promotion":"75% OFF · 11月7日到期",
    "studio.flux3.priceChanged":"點數價格已更新，請確認新的點數消耗後再次生成。"
  },
  "pt-BR":english,"ru":english,"vi":english,"de":english,"fr":english,
  "ja":english,"th":english,"nl":english,"he":english,"ko":english,"es":english,"it":english,"ar":english
};
