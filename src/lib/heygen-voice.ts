import {isPublicReferenceUrl} from "./heygen-reference-video";

export const HEYGEN_VOICE_PROVIDER = "heygen-voice-turbo";
export const HEYGEN_VOICE_MODEL = "heygen/heygen-voice/turbo";
export const HEYGEN_VOICE_RATE_PER_1000 = 0.004;
// DreamFace promotion, exclusive boundary: November 30, 2026, Asia/Shanghai.
// This waives customer credits; supplier usage still has a processing cost.
export const HEYGEN_VOICE_FREE_END = Date.parse("2026-12-01T00:00:00+08:00");
export const HEYGEN_VOICE_MAX_CHARACTERS = 5000; // Application limit, not a supplier claim.
export const HEYGEN_VOICES = ["Jonah", "Nadine", "Tabitha", "Soren", "Elowen", "Vincent", "Jocelyn", "Marielle", "Corinne", "Lucian", "Kieran", "Hugh", "Noelle", "Bram", "Ewan", "Iona", "Cecily", "Simon", "Weston", "Felicity", "Gareth", "Rory", "Meredith", "Sabrina"] as const;
export const HEYGEN_VOICE_LANGUAGES = ["ar", "be", "bg", "ca", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "mk", "ms", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "ta", "th", "tl", "tr", "uk", "vi", "zh"] as const;
export type HeygenVoiceOptions = {voice:string; language:string; expressivenessBoost:number; referenceAudioUrl:string};
export type HeygenVoiceInput = {text:string; voice?:string; language?:string; reference_audio_url?:string; expressiveness_boost:number; enable_safety_checker:true};
export type HeygenVoiceError = "invalid_options" | "invalid_voice" | "invalid_language" | "invalid_expressiveness" | "invalid_reference" | "missing_text" | "input_too_long";

export function isHeygenVoiceFree(pricingTime=Date.now()) {return Number.isFinite(pricingTime)&&pricingTime<HEYGEN_VOICE_FREE_END;}
export function heygenVoiceCharacters(text:string) {return Array.from(text.trim()).length;}
export function newHeygenVoiceOptions():HeygenVoiceOptions {return {voice:"Jonah", language:"", expressivenessBoost:1, referenceAudioUrl:""};}

export function prepareHeygenVoice(text:string,raw?:unknown):{input:HeygenVoiceInput|null;error:HeygenVoiceError|null} {
  const fail=(error:HeygenVoiceError)=>({input:null,error});
  if(raw!==undefined&&(!raw||typeof raw!=="object"||Array.isArray(raw)))return fail("invalid_options");
  const options=(raw||{}) as Partial<HeygenVoiceOptions>;
  const prompt=text.trim();
  if(!prompt)return fail("missing_text");
  if(prompt.length>HEYGEN_VOICE_MAX_CHARACTERS)return fail("input_too_long");
  if(options.referenceAudioUrl!==undefined&&typeof options.referenceAudioUrl!=="string")return fail("invalid_reference");
  const reference=options.referenceAudioUrl?.trim()||"";
  if(reference&&!isPublicReferenceUrl(reference))return fail("invalid_reference");
  const voice=options.voice??"Jonah",language=options.language??"",expressiveness=options.expressivenessBoost??1;
  // A reference clip takes precedence over a library voice in the supplier API.
  if(!reference&&!HEYGEN_VOICES.includes(voice as typeof HEYGEN_VOICES[number]))return fail("invalid_voice");
  if(typeof language!=="string"||(language&&!HEYGEN_VOICE_LANGUAGES.includes(language as typeof HEYGEN_VOICE_LANGUAGES[number])))return fail("invalid_language");
  if(typeof expressiveness!=="number"||!Number.isFinite(expressiveness)||expressiveness<0||expressiveness>1)return fail("invalid_expressiveness");
  return {error:null,input:{text:prompt,...(reference?{reference_audio_url:reference}:{voice}),...(language?{language}:{}),expressiveness_boost:expressiveness,enable_safety_checker:true}};
}

export function restoreHeygenVoiceOptions(raw:unknown):HeygenVoiceOptions {
  const defaults=newHeygenVoiceOptions();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return defaults;
  const options=raw as Partial<HeygenVoiceOptions>;
  return {
    voice:HEYGEN_VOICES.includes(options.voice as typeof HEYGEN_VOICES[number])?options.voice!:defaults.voice,
    language:HEYGEN_VOICE_LANGUAGES.includes(options.language as typeof HEYGEN_VOICE_LANGUAGES[number])?options.language!:"",
    expressivenessBoost:typeof options.expressivenessBoost==="number"&&Number.isFinite(options.expressivenessBoost)&&options.expressivenessBoost>=0&&options.expressivenessBoost<=1?options.expressivenessBoost:1,
    referenceAudioUrl:typeof options.referenceAudioUrl==="string"?options.referenceAudioUrl.slice(0,8192):""
  };
}
