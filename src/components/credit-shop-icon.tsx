import type {SVGProps} from "react";

export type CreditShopIconName = "image" | "video" | "avatar" | "audio" | "zap" | "sparkles" | "shield" | "infinity" | "lock" | "arrow";
const paths: Record<CreditShopIconName, React.ReactNode> = {
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
  video: <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3"/></>,
  avatar: <><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  audio: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></>,
  zap: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>,
  sparkles: <><path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/><path d="M21 2v4m-2-2h4"/></>,
  shield: <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/></>,
  infinity: <path d="M12 12c-2-3-3-5-6-5a5 5 0 0 0 0 10c3 0 4-2 6-5s3-5 6-5a5 5 0 0 1 0 10c-3 0-4-2-6-5Z"/>,
  lock: <><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>
};
export function CreditShopIcon({name,...props}: SVGProps<SVGSVGElement> & {name:CreditShopIconName}) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
