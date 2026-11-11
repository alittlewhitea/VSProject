import type {Locale} from "../i18n/routing";
export type FlatMessages = Record<string,string>;
const loaders = {
"en": () => import("../../messages/credit-shop/en.json").then(module=>module.default),
"zh-CN": () => import("../../messages/credit-shop/zh-CN.json").then(module=>module.default),
"zh-TW": () => import("../../messages/credit-shop/zh-TW.json").then(module=>module.default),
"pt-BR": () => import("../../messages/credit-shop/pt-BR.json").then(module=>module.default),
"ru": () => import("../../messages/credit-shop/ru.json").then(module=>module.default),
"vi": () => import("../../messages/credit-shop/vi.json").then(module=>module.default),
"de": () => import("../../messages/credit-shop/de.json").then(module=>module.default),
"fr": () => import("../../messages/credit-shop/fr.json").then(module=>module.default),
"ja": () => import("../../messages/credit-shop/ja.json").then(module=>module.default),
"th": () => import("../../messages/credit-shop/th.json").then(module=>module.default),
"nl": () => import("../../messages/credit-shop/nl.json").then(module=>module.default),
"he": () => import("../../messages/credit-shop/he.json").then(module=>module.default),
"ko": () => import("../../messages/credit-shop/ko.json").then(module=>module.default),
"es": () => import("../../messages/credit-shop/es.json").then(module=>module.default),
"it": () => import("../../messages/credit-shop/it.json").then(module=>module.default),
"ar": () => import("../../messages/credit-shop/ar.json").then(module=>module.default),
} satisfies Record<Locale,()=>Promise<FlatMessages>>;
const pending=new Map<Locale,Promise<FlatMessages>>();
export function loadCreditShopMessages(locale:Locale):Promise<FlatMessages>{
 const existing=pending.get(locale);if(existing)return existing;
 const request=loaders[locale]().catch(error=>{pending.delete(locale);throw error;});pending.set(locale,request);return request;
}
