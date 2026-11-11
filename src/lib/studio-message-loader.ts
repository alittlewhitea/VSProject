import type {Locale} from "../i18n/routing";
export type FlatMessages = Record<string,string>;
const loaders = {
"en": () => import("../../messages/studio/en.json").then(module=>module.default),
"zh-CN": () => import("../../messages/studio/zh-CN.json").then(module=>module.default),
"zh-TW": () => import("../../messages/studio/zh-TW.json").then(module=>module.default),
"pt-BR": () => import("../../messages/studio/pt-BR.json").then(module=>module.default),
"ru": () => import("../../messages/studio/ru.json").then(module=>module.default),
"vi": () => import("../../messages/studio/vi.json").then(module=>module.default),
"de": () => import("../../messages/studio/de.json").then(module=>module.default),
"fr": () => import("../../messages/studio/fr.json").then(module=>module.default),
"ja": () => import("../../messages/studio/ja.json").then(module=>module.default),
"th": () => import("../../messages/studio/th.json").then(module=>module.default),
"nl": () => import("../../messages/studio/nl.json").then(module=>module.default),
"he": () => import("../../messages/studio/he.json").then(module=>module.default),
"ko": () => import("../../messages/studio/ko.json").then(module=>module.default),
"es": () => import("../../messages/studio/es.json").then(module=>module.default),
"it": () => import("../../messages/studio/it.json").then(module=>module.default),
"ar": () => import("../../messages/studio/ar.json").then(module=>module.default),
} satisfies Record<Locale,()=>Promise<FlatMessages>>;
const pending=new Map<Locale,Promise<FlatMessages>>();
export function loadStudioMessages(locale:Locale):Promise<FlatMessages>{
 const existing=pending.get(locale);if(existing)return existing;
 const request=loaders[locale]().catch(error=>{pending.delete(locale);throw error;});pending.set(locale,request);return request;
}
