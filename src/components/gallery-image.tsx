"use client";

import Image from "next/image";
import {useState} from "react";

type Props={src:string;alt:string;className?:string;sizes:string;fill?:boolean;width?:number;height?:number};
// Only public gallery media on these hosts goes through the image optimizer.
// Uploaded/private task URLs and unrecognized hosts retain their original delivery.
function canOptimize(src:string) {
  if(src.startsWith("/images/"))return true;
  try {
    const url=new URL(src);
    if(url.protocol!=="https:" || url.port || url.username || url.password)return false;
    return (url.hostname==="pbs.twimg.com"&&url.pathname.startsWith("/media/")) ||
      (url.hostname==="v3b.fal.media"&&url.pathname.startsWith("/files/")) ||
      (url.hostname==="refinery.fal.media"&&url.pathname.startsWith("/url/"));
  }catch{return false;}
}
export function GalleryImage({src,alt,className,sizes,fill=false,width=800,height=1000}:Props) {
  const [failedSource,setFailedSource]=useState<string|null>(null);
  if(!canOptimize(src)||failedSource===src)return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" {...(!fill?{width,height}:{})} />;
  return <Image src={src} alt={alt} className={className} sizes={sizes} quality={75} loading="lazy" onError={()=>setFailedSource(src)} {...(fill?{fill:true}:{width,height})} />;
}
