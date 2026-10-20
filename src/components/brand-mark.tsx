import type {ImgHTMLAttributes} from "react";
import {BRAND_MARK} from "../lib/brand-mark";

type Props=Omit<ImgHTMLAttributes<HTMLImageElement>,"src"|"srcSet">;
export function BrandMark({alt="",sizes="56px",...props}:Props) {
  return <img src={BRAND_MARK[112]} srcSet={`${BRAND_MARK[64]} 64w, ${BRAND_MARK[112]} 112w, ${BRAND_MARK[168]} 168w`} sizes={sizes} alt={alt} decoding="async" {...props} />;
}
