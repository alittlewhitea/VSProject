"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "../../i18n/routing";
import type { AuthSession } from "../../lib/supabase-client";
import type { HeygenAvatar, HeygenAvatarPage } from "../../lib/heygen-avatar-types";
import { GalleryImage } from "../../components/gallery-image";
import { avatarCategories, avatarFilterOptions, avatarFilterValue, emptyAvatarFilters, matchesAvatarCategory, matchesAvatarFilters, type AvatarCategory, type AvatarFilterField, type AvatarFilters } from "../../lib/avatar-catalog-filters";
import { avatarFilterCopy } from "./avatar-filter-copy";
import { AvatarFiltersPanel } from "./avatar-filters-panel";
import { useAvatarMobilePreviews } from "./use-avatar-mobile-previews";
import { avatarLibraryCopy } from "./studio-avatar-library-copy";
import Link from "./studio-link";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-avatar-library.module.css";

const favoriteKey = (item:HeygenAvatar) => `${item.kind}:${item.id}`;
const catalogPages=new Map<string,{page:HeygenAvatarPage;expires:number}>();
const previews = new Map<string,Promise<HeygenAvatar[]>>();
const preconnectedOrigins = new Set<string>();
const warmDesktopCards = new Map<string, () => void>();
const MAX_PREVIEW_CONCURRENCY = 4;
const MAX_WARM_DESKTOP_VIDEOS = 4;
let previewActive=0;
let activeHoverVideoKey:string|null=null;
const previewQueue:Array<{groupId:string;priority:"normal"|"high";resolve:()=>void}>=[];

type AvatarPreviewManifest = { baseUrl: string; items: Record<string, string> };
let previewManifestCache: AvatarPreviewManifest | null = null;
let previewManifestPromise: Promise<AvatarPreviewManifest> | null = null;

function loadAvatarPreviewManifest(): Promise<AvatarPreviewManifest> {
  if (previewManifestCache) return Promise.resolve(previewManifestCache);
  if (previewManifestPromise) return previewManifestPromise;
  previewManifestPromise = fetch("/data/avatar-preview-videos.json")
    .then(async (response) => {
      if (!response.ok) return { baseUrl: "", items: {} };
      const data = (await response.json()) as Partial<AvatarPreviewManifest>;
      const baseUrl = typeof data?.baseUrl === "string" ? data.baseUrl.replace(/\/+$/, "") : "";
      const items = data?.items && typeof data.items === "object" ? data.items : {};
      return { baseUrl, items };
    })
    .catch(() => ({ baseUrl: "", items: {} }))
    .then((manifest) => {
      previewManifestCache = manifest;
      if (manifest.baseUrl) preconnectMediaOrigin(manifest.baseUrl);
      return manifest;
    });
  return previewManifestPromise;
}

function optimizedPreviewVideoUrl(manifest: AvatarPreviewManifest | null, itemId: string): string | null {
  if (!manifest?.baseUrl) return null;
  const file = manifest.items[itemId];
  return typeof file === "string" && file ? `${manifest.baseUrl}/${file}` : null;
}

function preconnectMediaOrigin(url?:string|null) {
  if(typeof document==="undefined"||!url)return;
  try {
    const origin=new URL(url).origin;
    if(!origin.startsWith("http")||preconnectedOrigins.has(origin))return;
    preconnectedOrigins.add(origin);
    const link=document.createElement("link");
    link.rel="preconnect";
    link.href=origin;
    link.crossOrigin="anonymous";
    document.head.appendChild(link);
  } catch {}
}

function drainPreviewQueue() {
  while(previewActive < MAX_PREVIEW_CONCURRENCY && previewQueue.length > 0) {
    // While a desktop hover video is actively buffering, only let high-priority
    // hovered-card lookups run so background group requests don't steal bandwidth.
    if(activeHoverVideoKey) {
      const highIndex = previewQueue.findIndex(entry => entry.priority === "high");
      if(highIndex === -1) return;
      const [entry] = previewQueue.splice(highIndex, 1);
      entry.resolve();
      return;
    }
    previewQueue.shift()?.resolve();
  }
}

function setHoverBandwidthPriority(key:string|null) {
  activeHoverVideoKey = key;
  if(!key) drainPreviewQueue();
}

function registerWarmDesktopVideo(key:string, evict:()=>void) {
  if(warmDesktopCards.has(key)) warmDesktopCards.delete(key);
  warmDesktopCards.set(key, evict);
  while(warmDesktopCards.size > MAX_WARM_DESKTOP_VIDEOS) {
    const oldestKey = warmDesktopCards.keys().next().value;
    if(!oldestKey) break;
    const oldestEvict = warmDesktopCards.get(oldestKey);
    warmDesktopCards.delete(oldestKey);
    oldestEvict?.();
  }
}

function unregisterWarmDesktopVideo(key:string) {
  warmDesktopCards.delete(key);
}

function promotePreviewLook(groupId:string) {
  const index = previewQueue.findIndex(entry => entry.groupId === groupId);
  if (index >= 0) {
    const [entry] = previewQueue.splice(index, 1);
    entry.priority = "high";
    previewQueue.unshift(entry);
    drainPreviewQueue();
  }
}

async function previewLooks(groupId:string, priority:"normal"|"high"="normal"):Promise<HeygenAvatar[]> {
  if(priority==="high") promotePreviewLook(groupId);
  const cached=previews.get(groupId); if(cached)return cached;
  const value=(async()=>{
    const shouldQueue = previewActive>=MAX_PREVIEW_CONCURRENCY || (priority!=="high" && Boolean(activeHoverVideoKey));
    if(shouldQueue) {
      await new Promise<void>(resolve=>{
        const entry={groupId,priority,resolve};
        if(priority==="high") previewQueue.unshift(entry);
        else previewQueue.push(entry);
      });
    }
    previewActive++;
    try {
      const response=await fetch(`/api/avatars/heygen?kind=look&preview=1&groupId=${encodeURIComponent(groupId)}`);
      if(!response.ok)throw new Error("Preview unavailable");
      const page=await response.json() as HeygenAvatarPage;
      return page.items;
    } finally {previewActive--;drainPreviewQueue();}
  })();
  if(previews.size>=128)previews.delete(previews.keys().next().value!);
  previews.set(groupId,value);
  try{return await value;}catch(error){if(previews.get(groupId)===value)previews.delete(groupId);throw error;}
}

function useAvatarPages(groupId:string|undefined,revision:number) {
  const key=groupId||"public";
  const [state,setState]=useState<{key:string;items:HeygenAvatar[];token:string|null;loading:boolean;error:string|null}>({key,items:[],token:null,loading:true,error:null});
  const requestRef=useRef<AbortController|null>(null);
  const keyRef=useRef(key);keyRef.current=key;
  const pending=useRef(false);
  const revisionRef=useRef(revision);
  const forceRefresh=useRef(false);
  async function load(token?:string) {
    if(pending.current)return;
    pending.current=true;
    const controller=new AbortController();requestRef.current=controller;
    try {
      const params=new URLSearchParams({kind:groupId?"look":"group"});
      if(groupId)params.set("groupId",groupId);
      if(token)params.set("token",token);
      const pageKey=params.toString(),cached=catalogPages.get(pageKey);
      let page:HeygenAvatarPage & {code?:string};
      if(cached&&cached.expires>Date.now()&&!forceRefresh.current)page=cached.page;
      else {
        setState(current=>token?{...current,loading:true,error:null}:{key,items:[],token:null,loading:true,error:null});
        const response=await fetch(`/api/avatars/heygen?${params}`,{signal:controller.signal});
        page=await response.json() as HeygenAvatarPage & {code?:string};
        if(!response.ok)throw new Error(page.code||"heygen_unavailable");
      }
      if(!Array.isArray(page.items)||(page.hasMore&&(!page.nextToken||page.nextToken===token)))throw new Error("heygen_invalid_response");
      if(controller.signal.aborted||keyRef.current!==key)return;
      if(catalogPages.size>=64&&!catalogPages.has(pageKey))catalogPages.delete(catalogPages.keys().next().value!);
      if(!cached||page!==cached.page)catalogPages.set(pageKey,{page,expires:Date.now()+5*60_000});
      forceRefresh.current=false;
      setState(current=>({key,items:[...new Map([...(token?current.items:[]),...page.items].map(item=>[favoriteKey(item),item])).values()],token:page.hasMore?page.nextToken:null,loading:false,error:null}));
    }catch(error){
      if(!controller.signal.aborted&&keyRef.current===key)setState(current=>({...current,loading:false,error:error instanceof Error?error.message:"heygen_unavailable"}));
    }finally{if(requestRef.current===controller)pending.current=false;}
  }
  useEffect(()=>{
    requestRef.current?.abort();pending.current=false;
    forceRefresh.current=revisionRef.current!==revision;revisionRef.current=revision;
    void load();
    return()=>{requestRef.current?.abort();pending.current=false;};
    // Each key owns a fresh request; pagination calls load() with the current key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,revision]);
  return { ...(state.key===key?state:{key,items:[],token:null,loading:true,error:null}),more:()=>void load(state.token||undefined) };
}

function Heart({filled=false}:{filled?:boolean}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="1.7"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
}

function AvatarCard({item,saved,busy,onFavorite,onOpen,onCreate,prompt,copy,mobile,autoPreview,onPreview,optimizedVideoUrl}:{item:HeygenAvatar;saved:boolean;busy:boolean;onFavorite:()=>void;onOpen:(item:HeygenAvatar)=>void;onCreate:(imageUrl:string)=>void;prompt:string;copy:ReturnType<typeof avatarLibraryCopy>;mobile:boolean;autoPreview:boolean;onPreview:(key:string)=>void;optimizedVideoUrl:string|null}) {
  const card=useRef<HTMLElement|null>(null),video=useRef<HTMLVideoElement|null>(null);
  const pointerInside=useRef(false);
  const [looks,setLooks]=useState<HeygenAvatar[]>([]),[looksLoaded,setLooksLoaded]=useState(false),[hovering,setHovering]=useState(false),[warmMounted,setWarmMounted]=useState(false),[ready,setReady]=useState(false),[buffering,setBuffering]=useState(false),[optimizedFailed,setOptimizedFailed]=useState(false),[videoFailed,setVideoFailed]=useState(false),[imageFailed,setImageFailed]=useState(false);
  const [paused,setPaused]=useState(false);
  const cardKey=favoriteKey(item);
  const imageUrl=item.previewImageUrl||looks.find(look=>look.previewImageUrl)?.previewImageUrl;
  const fallbackVideoUrl=item.previewVideoUrl||looks.find(look=>look.previewVideoUrl)?.previewVideoUrl;
  const usingOptimizedVideo=Boolean(optimizedVideoUrl&&!optimizedFailed);
  const videoUrl=usingOptimizedVideo?optimizedVideoUrl:fallbackVideoUrl;
  const sides=looks.filter(look=>look.previewImageUrl&&look.previewImageUrl!==imageUrl).slice(0,2);
  const stop=()=>{
    setHovering(false);
    setReady(false);
    setBuffering(false);
    if(activeHoverVideoKey===cardKey) setHoverBandwidthPriority(null);
  };
  const playing = mobile ? autoPreview && !paused : hovering && Boolean(videoUrl);
  const shouldMountVideo = Boolean(videoUrl && !videoFailed && (playing || (!mobile && warmMounted)));

  useEffect(()=>{if(!autoPreview)setPaused(false);},[autoPreview]);
  useEffect(()=>{if(videoUrl)preconnectMediaOrigin(videoUrl);},[videoUrl]);

  useEffect(()=>{
    if(item.kind!=="group"||!card.current)return;
    let disposed=false;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      void previewLooks(item.id).then(rows=>{if(!disposed){setLooks(rows);setLooksLoaded(true);}}).catch(()=>{if(!disposed)setLooksLoaded(true);});
    },{rootMargin:"160px"});
    observer.observe(card.current);
    return()=>{disposed=true;observer.disconnect();};
  },[item.id,item.kind]);

  useEffect(()=>()=>{
    if(activeHoverVideoKey===cardKey) setHoverBandwidthPriority(null);
    unregisterWarmDesktopVideo(cardKey);
    const player=video.current;
    if(player){player.pause();player.removeAttribute("src");player.load();}
  },[cardKey]);

  useEffect(()=>{
    const player=video.current;
    if(!playing){
      if(activeHoverVideoKey===cardKey) setHoverBandwidthPriority(null);
      if(player){
        player.pause();
        if(mobile){player.removeAttribute("src");player.load();}
      }
      return;
    }
    if(!card.current)return;
    let disposed=false;
    if(!mobile){
      // Pause background group lookups and reserve bandwidth exclusively for the hovered video.
      setHoverBandwidthPriority(cardKey);
      registerWarmDesktopVideo(cardKey, ()=>{if(!pointerInside.current)setWarmMounted(false);});
      setWarmMounted(true);
    }
    const bufferedAhead = (el: HTMLVideoElement) => {
      try {
        for (let i = 0; i < el.buffered.length; i++) {
          if (el.buffered.start(i) <= el.currentTime + 0.1 && el.buffered.end(i) >= el.currentTime) {
            return el.buffered.end(i) - el.currentTime;
          }
        }
      } catch {}
      return 0;
    };
    const tryStartPlayback = () => {
      if(!player || disposed) return;
      player.muted = true;
      // For lightweight transcoded R2 clips (~350 KB faststart), start as soon as the
      // browser can play; for huge raw HeyGen MP4s (~90 MB), wait for ~1.5s of buffer
      // so they don't flash 2 frames and freeze.
      const needsBufferGuard = !mobile && !usingOptimizedVideo;
      if(needsBufferGuard && player.readyState < 4 && bufferedAhead(player) < 1.5) {
        setBuffering(true);
        return;
      }
      setBuffering(false);
      void player.play().catch(()=>{if(!disposed)setReady(false);});
    };
    const onBufferProgress = () => {
      if(!player || disposed) return;
      if(player.paused) tryStartPlayback();
    };
    tryStartPlayback();
    player?.addEventListener("progress", onBufferProgress);
    player?.addEventListener("canplay", tryStartPlayback);
    player?.addEventListener("canplaythrough", tryStartPlayback);
    const visibility=()=>{if(document.hidden){player?.pause();if(!mobile)stop();}else if(mobile)tryStartPlayback();};
    const other=(event:Event)=>{if(!mobile&&(event as CustomEvent).detail!==cardKey)stop();};
    const observer=new IntersectionObserver(entries=>{if(!entries[0]?.isIntersecting){player?.pause();if(!mobile)stop();}else if(mobile&&playing){tryStartPlayback();}});
    observer.observe(card.current);document.addEventListener("visibilitychange",visibility);window.addEventListener("df-avatar-preview",other);
    return()=>{
      disposed=true;
      if(activeHoverVideoKey===cardKey) setHoverBandwidthPriority(null);
      player?.removeEventListener("progress", onBufferProgress);
      player?.removeEventListener("canplay", tryStartPlayback);
      player?.removeEventListener("canplaythrough", tryStartPlayback);
      observer.disconnect();
      document.removeEventListener("visibilitychange",visibility);
      window.removeEventListener("df-avatar-preview",other);
      if(player){
        player.pause();
        if(mobile){player.removeAttribute("src");player.load();}
      }
    };
  },[playing,videoUrl,usingOptimizedVideo,mobile,cardKey]);

  const start=()=>{
    if(videoFailed||document.hidden||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    if(!videoUrl){
      if(item.kind==="group"&&!looksLoaded){
        setHovering(true);
        void previewLooks(item.id,"high").then(rows=>{setLooks(rows);setLooksLoaded(true);}).catch(()=>{setLooksLoaded(true);});
      }
      return;
    }
    window.dispatchEvent(new CustomEvent("df-avatar-preview",{detail:cardKey}));
    setHovering(true);
  };
  // Groups can have only a cover; their video arrives with the lazy look
  // previews. Honor an existing hover once that URL becomes available.
  useEffect(()=>{if(pointerInside.current&&!mobile&&videoUrl)start();},[videoUrl,mobile]);
  const createImage=imageFailed?null:imageUrl;
  const href=createImage?`/studio?${new URLSearchParams({mode:"avatar",workflow:"avatar-video",provider:"heygen-video",reference:createImage,...(prompt.trim()?{prompt}:{})})}`:null;
  const awaitingGroupVideo = item.kind === "group" && !looksLoaded && !videoUrl;
  const waitingForVideo = !mobile && hovering && !videoFailed && (awaitingGroupVideo || buffering || (playing && !ready));
  return <article ref={card} className={styles.card} data-avatar-card={item.id} data-avatar-preview-key={cardKey} data-avatar-preview-available={Boolean(videoUrl&&!videoFailed)} data-avatar-preview-optimized={usingOptimizedVideo} onPointerEnter={event=>{if(!mobile&&event.pointerType==="mouse"){pointerInside.current=true;start();}}} onPointerLeave={()=>{pointerInside.current=false;if(!mobile)stop();}}>
    <div data-avatar-preview-media className={`${styles.media} ${item.kind==="group"&&sides.length===2?styles.collage:""}`}>
      <div className={styles.main}>
        {imageUrl&&!imageFailed?<GalleryImage src={imageUrl} alt={item.name} width={640} height={480} sizes={item.kind==="group"?"(min-width:1100px) 22vw, (min-width:600px) 33vw, 100vw":"(min-width:1800px) 20vw, (min-width:1100px) 25vw, 50vw"} onError={()=>setImageFailed(true)}/>:<span className={styles.emptyMedia}>{copy.noPreview}</span>}
        {shouldMountVideo&&videoUrl?<video ref={video} src={videoUrl} muted autoPlay={mobile && playing} loop playsInline preload={playing?"auto":"none"} aria-hidden="true" data-ready={playing&&ready} onPlaying={()=>{if(playing){setReady(true);setBuffering(false);if(activeHoverVideoKey===cardKey)setHoverBandwidthPriority(null);}}} onWaiting={()=>{if(playing)setBuffering(true);}} onError={()=>{if(usingOptimizedVideo&&fallbackVideoUrl){setOptimizedFailed(true);setReady(false);return;}setVideoFailed(true);setWarmMounted(false);stop();}}/>:null}
        {waitingForVideo?<span className={styles.previewLoading} aria-hidden="true"><span className={styles.previewSpinner}/></span>:null}
      </div>
      {item.kind==="group"&&sides.length===2?<div className={styles.side} aria-hidden="true">{sides.map(look=><GalleryImage key={look.id} src={look.previewImageUrl!} alt="" width={320} height={180} sizes="(min-width:1100px) 11vw, (min-width:600px) 17vw, 33vw"/>)}</div>:null}
      <button type="button" className={styles.open} aria-label={item.name} onClick={()=>{if(item.kind==="group"){stop();onOpen(item);}else if(mobile){if(playing&&ready){setPaused(true);setReady(false);}else{setPaused(false);onPreview(favoriteKey(item));if(video.current)void video.current.play().catch(()=>undefined);}}else if(hovering)stop();else start();}}/>
      {item.kind==="look"?<span className={styles.lookName} dir="auto">{item.name}</span>:null}
      <div className={styles.actions}>
        {href?<Link href={href} aria-label={`${copy.create}: ${item.name}`} title={copy.create} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){stop();onCreate(createImage!);}}}><StudioIcon name="sparkles"/><span>{copy.create}</span></Link>:null}
        <button type="button" aria-pressed={saved} aria-label={`${saved?copy.saved:copy.save}: ${item.name}`} title={saved?copy.saved:copy.save} disabled={busy} onClick={onFavorite}><Heart filled={saved}/></button>
      </div>
    </div>
    {item.kind==="group"?<div className={styles.name}><strong dir="auto">{item.name}</strong>{item.looksCount!==null?<span>{item.looksCount} {copy.looks}</span>:null}</div>:null}
  </article>;
}

export default function StudioAvatarLibrary({locale,userId,accessToken,onLogin,onCreate,prompt}:{locale:Locale;userId:string|null;accessToken:string|null;onLogin:(onSuccess?:(session:AuthSession)=>void)=>void;onCreate:(imageUrl:string)=>void;prompt:string}) {
  const copy={...avatarLibraryCopy(locale),...avatarFilterCopy(locale)};
  const section=useRef<HTMLElement|null>(null);
  const mobilePreviews=useAvatarMobilePreviews(section);
  const [previewManifest,setPreviewManifest]=useState<AvatarPreviewManifest|null>(()=>previewManifestCache);
  useEffect(()=>{
    let active=true;
    void loadAvatarPreviewManifest().then(manifest=>{if(active)setPreviewManifest(manifest);});
    return()=>{active=false;};
  },[]);
  const [tab,setTab]=useState<"public"|"mine">("public"),[group,setGroup]=useState<HeygenAvatar|null>(null),[query,setQuery]=useState(""),[filter,setFilter]=useState<AvatarCategory>("all"),[revision,setRevision]=useState(0);
  const [filters,setFilters]=useState<AvatarFilters>(emptyAvatarFilters);
  const [filterOpen,setFilterOpen]=useState(false);
  const catalog=useAvatarPages(group?.id,revision);
  const [favorites,setFavorites]=useState<{owner:string|null;items:HeygenAvatar[];loading:boolean;error:boolean}>({owner:null,items:[],loading:false,error:false});
  const [saving,setSaving]=useState<Set<string>>(()=>new Set()),[saveError,setSaveError]=useState(false);
  const ownerRef=useRef(userId);ownerRef.current=userId;
  const inFlight=useRef(new Set<string>());
  useEffect(()=>{
    const controller=new AbortController();setSaving(new Set());inFlight.current.clear();setSaveError(false);
    setFavorites({owner:userId,items:[],loading:Boolean(accessToken&&userId),error:false});
    if(accessToken&&userId)void fetch("/api/avatars/favorites",{headers:{Authorization:`Bearer ${accessToken}`},signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("Favorites unavailable");
      const payload=await response.json() as {items:HeygenAvatar[]};
      if(!Array.isArray(payload.items))throw new Error("Invalid favorites");
      if(!controller.signal.aborted)setFavorites({owner:userId,items:payload.items,loading:false,error:false});
    }).catch(()=>{if(!controller.signal.aborted)setFavorites({owner:userId,items:[],loading:false,error:true});});
    return()=>controller.abort();
  },[userId,accessToken,revision]);
  const savedItems=favorites.owner===userId?favorites.items:[];
  const favoriteIds=useMemo(()=>new Set(savedItems.map(favoriteKey)),[savedItems]);
  async function toggleFavorite(item:HeygenAvatar, session?:AuthSession) {
    const token=session?.access_token||accessToken,owner=session?.user.id||userId;
    if(!token||!owner){onLogin(session=>{void toggleFavorite(item,session);});return;}
    const key=favoriteKey(item);
    if(inFlight.current.has(key)||(!session&&(favorites.owner!==owner||favorites.loading||favorites.error)))return;
    inFlight.current.add(key);setSaving(new Set(inFlight.current));setSaveError(false);
    const favorite=session?true:!favoriteIds.has(key);
    try {
      const response=await fetch("/api/avatars/favorites",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({item,favorite})});
      if(!response.ok)throw new Error("Favorite update failed");
      if(ownerRef.current===owner)setFavorites(current=>current.owner===owner?{...current,items:favorite?[item,...current.items.filter(row=>favoriteKey(row)!==key)]:current.items.filter(row=>favoriteKey(row)!==key)}:current);
      if(session)setRevision(value=>value+1);
    }catch{if(ownerRef.current===owner)setSaveError(true);}
    finally{if(ownerRef.current===owner){inFlight.current.delete(key);setSaving(new Set(inFlight.current));}}
  }
  const source=group||tab==="public"?catalog.items:savedItems;
  const filterAvailability=Object.fromEntries((Object.keys(avatarFilterOptions) as AvatarFilterField[]).map(field=>[field,source.some(item=>avatarFilterValue(item,field)!==null)])) as Record<AvatarFilterField,boolean>;
  const filterCount=Object.values(filters).reduce((sum,values)=>sum+values.length,0);
  const visible=source.filter(item=>{
    const text=[item.name,...item.tags,item.avatarType||""].join(" ").toLowerCase();
    return (!query.trim()||text.includes(query.trim().toLowerCase())) && matchesAvatarCategory(item,filter,favoriteIds) && matchesAvatarFilters(item,filters);
  });
  const loading=group||tab==="public"?catalog.loading:favorites.loading;
  const error=group||tab==="public"?catalog.error:favorites.error?"favorites_unavailable":null;
  const selectGroup=(item:HeygenAvatar)=>{setGroup(item);setQuery("");setFilter("all");setFilters(emptyAvatarFilters());setFilterOpen(false);section.current?.scrollIntoView({block:"start",behavior:"instant"});};
  return <section ref={section} className={styles.library} data-avatar-library aria-label={copy.public}>
    <div className={styles.tabs} role="tablist" aria-label={copy.public}>
      {(["mine","public"] as const).map(value=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>{setTab(value);setGroup(null);setQuery("");setFilter("all");setFilters(emptyAvatarFilters());setFilterOpen(false);}}>{copy[value]}</button>)}
    </div>
    {group?<div className={styles.detailHeader}><button type="button" aria-label={copy.back} onClick={()=>{setGroup(null);setQuery("");setFilter("all");setFilters(emptyAvatarFilters());setFilterOpen(false);}}><StudioIcon name="chevron-left" className="h-5 w-5 rtl:rotate-180"/></button>{group.previewImageUrl?<img src={group.previewImageUrl} alt=""/>:null}<h2 dir="auto">{group.name}</h2>{group.looksCount!==null?<span>{group.looksCount} {copy.looks}</span>:null}</div>:null}
    <div className={styles.toolbar}><label className={styles.search}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7"/><path d="m16 16 5 5"/></svg><input aria-label={copy.search} placeholder={copy.search} value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <button type="button" className={styles.filterTrigger} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={event=>{if(!filterOpen)event.currentTarget.parentElement?.scrollIntoView({block:"start",behavior:"instant"});setFilterOpen(value=>!value);}}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 4h18l-7 8v7l-4 2v-9Z"/></svg>{copy.filters}{filterCount?<span>{filterCount}</span>:null}</button>
      {filterOpen?<AvatarFiltersPanel value={filters} available={filterAvailability} copy={copy} onClose={()=>setFilterOpen(false)} onApply={value=>{setFilters(value);setFilterOpen(false);}}/>:null}
    </div>
    <div className={styles.filters} aria-label={copy.filters}>{avatarCategories.map(value=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{copy[value]}</button>)}</div>
    {tab==="mine"&&!accessToken?<div className={styles.notice}><p>{copy.login}</p><button type="button" onClick={()=>onLogin()}>{copy.mine}</button></div>:null}
    {error?<div className={styles.notice} role="status"><p>{error==="heygen_not_configured"?copy.closed:copy.error}</p><button type="button" onClick={()=>setRevision(value=>value+1)}>{copy.retry}</button></div>:null}
    {saveError||favorites.error?<div role="status" className={styles.notice}><p>{copy.saveError}</p><button type="button" onClick={()=>setRevision(value=>value+1)}>{copy.retry}</button></div>:null}
    <div className={`${styles.grid} ${group?styles.looksGrid:""}`} aria-busy={loading}>
      {visible.map(item=><AvatarCard key={favoriteKey(item)} item={item} copy={copy} prompt={prompt} mobile={mobilePreviews.mobile} autoPreview={mobilePreviews.keys.includes(favoriteKey(item))} onPreview={mobilePreviews.requestPreview} optimizedVideoUrl={optimizedPreviewVideoUrl(previewManifest, item.id)} saved={favoriteIds.has(favoriteKey(item))} busy={saving.has(favoriteKey(item))||Boolean(accessToken&&(favorites.loading||favorites.error))} onFavorite={()=>void toggleFavorite(item)} onOpen={selectGroup} onCreate={onCreate}/>)}
      {loading&&!source.length?Array.from({length:6},(_,i)=><div key={i} className={styles.skeleton} aria-hidden="true"/>):null}
    </div>
    {!loading&&!error&&!visible.length&&(tab==="public"||Boolean(accessToken))?<p className={styles.notice}>{copy.empty}</p>:null}
    {(group||tab==="public")&&catalog.token?<button type="button" className={styles.more} onClick={catalog.more} disabled={catalog.loading}>{catalog.loading?copy.loading:copy.more}</button>:null}
  </section>;
}
