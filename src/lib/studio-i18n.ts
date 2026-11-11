"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {defaultLocale,isLocale,isRtlLocale,localeCookieKey,localeLabels,locales,localeStorageKey,persistLocalePreference,type Locale} from "../i18n/routing";
import {loadStudioMessages,type FlatMessages} from "./studio-message-loader";

function detectBrowserLocale():Locale {
  if(typeof window==="undefined")return defaultLocale;
  try{const stored=window.localStorage.getItem(localeStorageKey);if(isLocale(stored))return stored;}catch{}
  try{const value=document.cookie.split("; ").find(item=>item.startsWith(`${localeCookieKey}=`))?.slice(localeCookieKey.length+1);if(value&&isLocale(decodeURIComponent(value)))return decodeURIComponent(value) as Locale;}catch{}
  for(const language of window.navigator.languages?.length?window.navigator.languages:[window.navigator.language]) {
    if(isLocale(language))return language;
    const normalized=language.toLowerCase();
    if(normalized==="zh-tw"||normalized==="zh-hk"||normalized==="zh-mo"||normalized.startsWith("zh-hant"))return "zh-TW";
    if(normalized.startsWith("zh"))return "zh-CN";
    if(normalized.startsWith("pt"))return "pt-BR";
    if(normalized.startsWith("iw"))return "he";
    const base=normalized.split("-")[0];if(isLocale(base))return base;
  }
  return defaultLocale;
}

export function useStudioI18n(initialLocale:Locale=defaultLocale,initialMessages:FlatMessages={}) {
  const [selection,setSelection]=useState(()=>({locale:initialLocale,messages:initialMessages}));
  const [loading,setLoading]=useState(false);
  const requestVersion=useRef(0),current=useRef(selection);current.current=selection;
  const setLocale=useCallback(async(locale:Locale)=>{
    const version=++requestVersion.current;
    if(current.current.locale===locale&&Object.keys(current.current.messages).length){persistLocalePreference(locale);setLoading(false);return;}
    setLoading(true);
    try{
      const messages=await loadStudioMessages(locale);
      if(version!==requestVersion.current)return;
      persistLocalePreference(locale);setSelection({locale,messages});
    } catch { /* Keep the current language usable; a later selection retries the chunk. */ }
    finally{if(version===requestVersion.current)setLoading(false);}
  },[]);
  useEffect(()=>{void setLocale(detectBrowserLocale());return()=>{requestVersion.current++;};},[setLocale]);
  useEffect(()=>{document.documentElement.lang=selection.locale;document.documentElement.dir=isRtlLocale(selection.locale)?"rtl":"ltr";},[selection.locale]);
  const t=useCallback((key:string,values?:Record<string,string|number|null|undefined>)=>{
    let result=selection.messages[key]||key;
    if(values)for(const [name,value]of Object.entries(values))result=result.replaceAll(`{${name}}`,String(value??""));
    return result;
  },[selection.messages]);
  return useMemo(()=>({locale:selection.locale,localeLabels,locales,setLocale,t,loading}),[selection.locale,setLocale,t,loading]);
}
