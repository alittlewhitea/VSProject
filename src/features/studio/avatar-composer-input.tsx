"use client";

import type {ReactNode} from "react";
import {GalleryImage} from "../../components/gallery-image";
import {StudioIcon} from "./studio-navigation";
type Translate=(key:string,values?:Record<string,string|number|null|undefined>)=>string;

export function AvatarComposerInput({prompt,images,meta,tooLong,translate,onPrompt,onUrl,onFiles,onFileError,onGuide,children}:{
  prompt:string;images:string[];url:string;meta:string;tooLong:boolean;translate:Translate;
  onPrompt:(value:string)=>void;onUrl:(value:string)=>void;onFiles:(files:FileList|null)=>Promise<void>;onFileError:()=>void;onGuide:()=>void;children?:ReactNode;
}) {
  const readFiles = (files: FileList | null) => {
    if (!files?.length) return;
    if (Array.from(files).some(file => !file.type.startsWith("image/"))) { onFileError(); return; }
    void onFiles(files).catch(onFileError);
  };
  return <div className="df-avatar-composer-input" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();readFiles(event.dataTransfer.files);}}>
    <div className="df-avatar-script-label"><label htmlFor="avatar-spoken-script">{translate("studio.avatarWorkbench.script")}</label><span className={tooLong?"df-avatar-error":""}>{meta}</span></div>
    <textarea id="avatar-spoken-script" dir="auto" value={prompt} onChange={event=>onPrompt(event.target.value)} placeholder={translate("studio.placeholder.avatar")} aria-invalid={tooLong} />
    {tooLong?<p role="alert" className="df-avatar-error">{translate("studio.avatar.scriptTooLong")}</p>:null}
    <div className="df-avatar-subjects">
      <label className="df-avatar-upload" title={translate("studio.action.chooseImage")}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 4.5v15m7.5-7.5h-15"/></svg><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={translate("studio.action.chooseImage")} onChange={event=>{readFiles(event.target.files);event.target.value="";}}/></label>
      {images.slice(0,1).map(src=><div key={src} className="df-avatar-subject"><GalleryImage src={src} alt={translate("studio.field.avatarImage")} width={96} height={96} sizes="72px"/><button type="button" aria-label={translate("studio.action.clear")} onClick={()=>onUrl("")}><StudioIcon name="x" className="h-3 w-3"/></button></div>)}
      <button type="button" className="df-avatar-choose" onClick={()=>document.querySelector<HTMLElement>("[data-avatar-library]")?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"})}><StudioIcon name="user" className="h-4 w-4"/>Avatar <StudioIcon name="chevron-right" className="h-3 w-3 rtl:rotate-180"/></button>
    </div>
    {!images.length?<button type="button" className="df-avatar-guide" onClick={onGuide}>{translate("studio.avatar.guideTitle")}</button>:null}
    {children?<details className="df-avatar-voice"><summary>{translate("studio.avatar.voice")}</summary>{children}</details>:null}
  </div>;
}
