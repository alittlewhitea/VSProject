"use client";

import { useEffect, useRef, useState } from "react";
import { GPT_IMAGE_QUALITIES, GPT_IMAGE_SVG_MODELS, type GptImageOptions, type GptImageQuality } from "../../lib/gpt-image-models";
import { StudioSelectField } from "./studio-primitives";

type Translate = (key: string, values?: Record<string,string|number|null|undefined>) => string;
export function GptImageControls({ options, onChange, imageSize, imageQuality, onQualityChange, outputFormat, onFormatChange, numImages, onCountChange, isEdit, references, translate:t, onBusyChange }: {
  options:GptImageOptions; onChange:(value:GptImageOptions)=>void; imageSize:string;
  imageQuality:GptImageQuality; onQualityChange:(value:GptImageQuality)=>void;
  outputFormat:string; onFormatChange:(value:string)=>void; numImages:number; onCountChange:(value:number)=>void;
  isEdit:boolean; references:string[]; translate:Translate;
  onBusyChange:(busy:boolean)=>void;
}) {
  const [guide,setGuide]=useState<"none"|"mask"|"markup">(options.maskUrl?"mask":options.markupImageUrl?"markup":"none");
  const [fileError,setFileError]=useState("");
  const [reading,setReading]=useState(false);
  const mounted=useRef(true);
  const currentOptions=useRef(options);
  currentOptions.current=options;
  const guideReadVersion=useRef(0);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;onBusyChange(false);};},[onBusyChange]);
  useEffect(()=>{guideReadVersion.current+=1;},[references[0],guide,isEdit]);
  useEffect(()=>{if(options.maskUrl)setGuide("mask");else if(options.markupImageUrl)setGuide("markup");},[options.maskUrl,options.markupImageUrl]);
  const change=(patch:Partial<GptImageOptions>)=>onChange({...options,...patch});
  const guideValue=guide==="mask"?options.maskUrl:options.markupImageUrl;
  const changeGuide=(value:string)=>{setFileError("");change(guide==="mask"?{maskUrl:value,markupImageUrl:""}:{markupImageUrl:value,maskUrl:""});};
  async function uploadGuide(file:File|undefined) {
    if(!file||reading)return;
    if(!(guide==="markup"?file.type==="image/png":["image/png","image/jpeg","image/webp"].includes(file.type))||file.size>30*1024*1024){setFileError(t("studio.gpt26.guideFileError"));return;}
    const version=++guideReadVersion.current;
    const stillCurrent=()=>mounted.current&&guideReadVersion.current===version;
    setReading(true);onBusyChange(true);setFileError("");
    try {
      const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
      if(guide==="markup"&&references[0]) {
        const dimensions=(url:string)=>new Promise<[number,number]>((resolve,reject)=>{const image=new Image();const timer=window.setTimeout(()=>{image.src="";reject(new Error());},10000);image.onload=()=>{clearTimeout(timer);resolve([image.naturalWidth,image.naturalHeight]);};image.onerror=()=>{clearTimeout(timer);reject(new Error());};image.src=url;});
        const [a,b]=await Promise.all([dimensions(value),dimensions(references[0])]);
        if(a[0]!==b[0]||a[1]!==b[1]){if(stillCurrent())setFileError(t("studio.gpt26.guideSizeError"));return;}
      }
      if(stillCurrent())onChange({...currentOptions.current,...(guide==="mask"?{maskUrl:value,markupImageUrl:""}:{markupImageUrl:value,maskUrl:""})});
    } catch {if(stillCurrent())setFileError(t("studio.status.fileReadFailed"));} finally {if(mounted.current){setReading(false);onBusyChange(false);}}
  }
  const number=(label:string,value:number,min:number,max:number,step:number,update:(value:number)=>void,attr:string)=><label className="min-w-0 text-xs text-[var(--studio-muted)]"><span className="mb-1.5 block">{label}</span><input data-gpt-setting={attr} type="number" min={min} max={max} step={step} value={Number.isFinite(value)?value:""} onChange={e=>update(e.target.value===""?0:Number(e.target.value))} className="min-h-11 w-full rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-[13px] text-[var(--studio-text)]" /></label>;
  return <div data-gpt26-controls className="col-span-full grid min-w-0 gap-3 sm:grid-cols-2">
    <StudioSelectField label={t("studio.field.quality")} value={imageQuality} options={GPT_IMAGE_QUALITIES.map(value=>({value,label:value==="auto"?t("studio.option.automatic"):value}))} onValueChange={value=>onQualityChange(value as GptImageQuality)} />
    <StudioSelectField label={t("studio.gpt26.reasoning")} value={options.reasoningEffort} options={["low","medium","high"].map(value=>({value,label:value}))} onValueChange={value=>change({reasoningEffort:value as GptImageOptions["reasoningEffort"]})} />
    <StudioSelectField label={t("studio.field.outputFormat")} value={outputFormat} options={(isEdit?["png","jpeg","webp","gif"]:["png","jpeg","webp","gif","svg"]).map(value=>({value,label:value.toUpperCase()}))} onValueChange={value=>{onFormatChange(value);if(value==="svg")onCountChange(1);if(value==="jpeg"&&options.background==="transparent")change({background:"opaque"});}} />
    <StudioSelectField label={t("studio.gpt26.background")} value={options.background} options={[{value:"auto",label:t("studio.option.automatic")},{value:"opaque",label:t("studio.gpt26.opaque")},...(outputFormat==="jpeg"?[]:[{value:"transparent",label:t("studio.gpt26.transparent")}])]} onValueChange={value=>change({background:value as GptImageOptions["background"]})} />
    <StudioSelectField label={t("studio.field.count")} value={String(numImages)} disabled={outputFormat==="svg"} options={Array.from({length:outputFormat==="svg"?1:10},(_,i)=>({value:String(i+1),label:String(i+1)}))} onValueChange={value=>onCountChange(Number(value))} />
    <button data-gpt-safety type="button" role="switch" aria-checked={options.enableSafetyChecker} onClick={()=>change({enableSafetyChecker:!options.enableSafetyChecker})} className="flex min-h-11 items-center justify-between gap-2 self-end rounded-[10px] border border-[var(--studio-border)] px-3 text-xs text-[var(--studio-text)]"><span>{t("studio.field.safety")}</span><span>{t(options.enableSafetyChecker?"studio.state.on":"studio.state.off")}</span></button>
    {imageSize==="custom"?<>{number(t("studio.gpt26.width"),options.width,16,3840,16,value=>change({width:value}),"width")}{number(t("studio.gpt26.height"),options.height,16,3840,16,value=>change({height:value}),"height")}<p className="col-span-full text-xs leading-5 text-[var(--studio-muted)]">{t("studio.gpt26.sizeHint")}</p></>:null}
    {["jpeg","webp"].includes(outputFormat)?number(t("studio.gpt26.compression"),options.outputCompression,0,100,1,value=>change({outputCompression:value}),"compression"):null}
    {outputFormat==="gif"?<>{number(t("studio.gpt26.frames"),options.frameCount,2,16,1,value=>change({frameCount:value}),"frames")}{number(t("studio.gpt26.frameDuration"),options.frameDurationMs,20,2000,10,value=>change({frameDurationMs:value}),"frameDuration")}<p className="col-span-full text-xs leading-5 text-[var(--studio-muted)]">{t("studio.gpt26.gifHint")}</p></>:null}
    {outputFormat==="svg"?<StudioSelectField label={t("studio.gpt26.svgModel")} value={options.svgModel} options={GPT_IMAGE_SVG_MODELS.map(value=>({value,label:value}))} onValueChange={value=>change({svgModel:value as GptImageOptions["svgModel"]})} />:null}
    {isEdit?<><StudioSelectField label={t("studio.gpt26.editGuide")} value={guide} options={[{value:"none",label:t("studio.gpt26.noGuide")},{value:"mask",label:t("studio.gpt26.mask")},{value:"markup",label:t("studio.gpt26.markup")}]} onValueChange={value=>{setGuide(value as typeof guide);setFileError("");change({maskUrl:"",markupImageUrl:""});}} />
      {guide!=="none"?<div className="col-span-full min-w-0 rounded-xl border border-[var(--studio-border)] p-3"><label className="mb-2 block text-xs text-[var(--studio-muted)]">{t(guide==="mask"?"studio.gpt26.maskHint":"studio.gpt26.markupHint")}</label><input data-gpt-guide-url dir="ltr" type="text" value={guideValue.startsWith("data:")?"":guideValue} placeholder="https://…/guide.png" onChange={e=>changeGuide(e.target.value)} className="min-h-11 w-full rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-xs text-[var(--studio-text)]" />
      <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-[var(--studio-border)] px-3 text-xs text-[var(--studio-accent)]">{t(reading?"studio.references.reading":"studio.action.chooseImage")}<input data-gpt-guide-file type="file" hidden disabled={reading} accept={guide==="markup"?"image/png":"image/png,image/jpeg,image/webp"} onChange={e=>{void uploadGuide(e.target.files?.[0]);e.target.value="";}} /></label>
      {guideValue?<div className="mt-2 flex items-center gap-2"><img src={guideValue} alt={t(guide==="mask"?"studio.gpt26.mask":"studio.gpt26.markup")} className="h-16 w-16 rounded-lg border border-[var(--studio-border)] object-contain" /><button type="button" onClick={()=>changeGuide("")} className="min-h-11 px-3 text-xs text-[var(--studio-muted)]">{t("studio.action.clear")}</button></div>:null}
      {fileError?<p role="alert" className="mt-2 text-xs leading-5 text-[var(--df-error)]">{fileError}</p>:null}</div>:null}
    </>:null}
    <p className="col-span-full text-xs leading-5 text-[var(--studio-muted)]">{t("studio.gpt26.costHint")}</p>
  </div>;
}
