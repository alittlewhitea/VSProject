"use client";

import { useState, type ReactNode } from "react";
import {GalleryImage} from "../../components/gallery-image";
import {StudioIcon} from "./studio-navigation";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
type Translate=(key:string,values?:Record<string,string|number|null|undefined>)=>string;

export function AvatarComposerInput({prompt,images,meta,tooLong,translate,onPrompt,onUrl,onFiles,onFileError,onGuide,children}:{
  prompt:string;images:string[];url:string;meta:string;tooLong:boolean;translate:Translate;
  onPrompt:(value:string)=>void;onUrl:(value:string)=>void;onFiles:(files:FileList|null)=>Promise<void>;onFileError:()=>void;onGuide:()=>void;children?:ReactNode;
}) {
  const [reading, setReading] = useState(false);
  const image = images[0];
  const readFiles = async (files: FileList | null) => {
    if (!files?.length || reading) return;
    if (Array.from(files).some(file => !file.type.startsWith("image/"))) { onFileError(); return; }
    setReading(true);
    try { await onFiles(files); } catch { onFileError(); } finally { setReading(false); }
  };
  return <div className="df-avatar-composer-input" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();readFiles(event.dataTransfer.files);}}>
    <div className="df-avatar-script-label"><label htmlFor="avatar-spoken-script">{translate("studio.avatarWorkbench.script")}</label><span className={tooLong?"df-avatar-error":""}>{meta}</span></div>
    <textarea id="avatar-spoken-script" dir="auto" value={prompt} onChange={event=>onPrompt(event.target.value)} placeholder={translate("studio.placeholder.avatar")} aria-invalid={tooLong} />
    {tooLong?<p role="alert" className="df-avatar-error">{translate("studio.avatar.scriptTooLong")}</p>:null}
    <div className="df-avatar-subjects">
      {image ? <StudioImagePreview src={image} alt={translate("studio.field.avatarImage")} removeLabel={translate("studio.action.clear")}
        disabled={reading} onRemove={() => onUrl("")}>
          <GalleryImage src={image} alt={translate("studio.field.avatarImage")} width={88} height={88} sizes="88px" />
        </StudioImagePreview> : null}
      <div className={image ? undefined : "df-avatar-image-upload"}>
        <StudioImageUpload compact={Boolean(image)} label={translate(reading ? "studio.references.reading" : "studio.references.upload")}
          hint={image ? undefined : translate("studio.references.uploadHint")} disabled={reading}
          inputProps={{ accept: "image/jpeg,image/png,image/webp" }} onFiles={readFiles} />
      </div>
      <button type="button" className="df-avatar-choose" onClick={()=>document.querySelector<HTMLElement>("[data-avatar-library]")?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"})}><StudioIcon name="user" className="h-4 w-4"/>Avatar <StudioIcon name="chevron-right" className="h-3 w-3 rtl:rotate-180"/></button>
    </div>
    {!images.length?<button type="button" className="df-avatar-guide" onClick={onGuide}>{translate("studio.avatar.guideTitle")}</button>:null}
    {children?<details className="df-avatar-voice"><summary>{translate("studio.avatar.voice")}</summary>{children}</details>:null}
  </div>;
}
