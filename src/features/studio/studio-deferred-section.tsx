"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";

/** Keep large below-fold template modules unloaded until their section is near view. */
export function StudioDeferredSection({children,minHeight=280}:{children:ReactNode;minHeight?:number}) {
  const ref=useRef<HTMLDivElement|null>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{
    if(!ref.current)return;
    if(typeof IntersectionObserver==="undefined"){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"300px"});
    observer.observe(ref.current);return()=>observer.disconnect();
  },[]);
  return <div ref={ref} style={visible?undefined:{minHeight}} aria-busy={!visible}>{visible?children:null}</div>;
}
