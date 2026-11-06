// Old bookmarks/preferences migrate to 2.6; no request is sent to a 2.5 endpoint.
export const normalizeGptImageProvider = (provider: string) => provider === "gpt-image-2.5-sunburst" ? "gpt-image-2.6-sunburst" : provider;
export const isGptImageProvider = (provider: string) => ["chatgpt-image", "gpt-image-2.6-sunburst"].includes(normalizeGptImageProvider(provider));
export const gptImageEndpoint = (provider: string, edit = false) => `openai/gpt-image-2.6/${normalizeGptImageProvider(provider) === "gpt-image-2.6-sunburst" ? "sunburst" : "flare"}/${edit ? "edit" : "text-to-image"}`;
export const GPT_IMAGE_QUALITIES = ["auto", "low", "medium", "high", "xhigh", "max"] as const;
export type GptImageQuality = typeof GPT_IMAGE_QUALITIES[number];
export const gptImageQuality = (value?: string | null): GptImageQuality => GPT_IMAGE_QUALITIES.includes(value as GptImageQuality) ? value as GptImageQuality : "low";
export const GPT_IMAGE_SVG_MODELS = ["gpt-6-astra", "gpt-5.5", "gpt-5.4", "gpt-5.6-terra", "gpt-6-luna"] as const;
export type GptImageOptions = {
  width: number; height: number; background: "auto" | "transparent" | "opaque";
  reasoningEffort: "low" | "medium" | "high"; outputCompression: number;
  frameCount: number; frameDurationMs: number; svgModel: typeof GPT_IMAGE_SVG_MODELS[number];
  maskUrl: string; markupImageUrl: string; enableSafetyChecker: boolean;
};
export const DEFAULT_GPT_IMAGE_OPTIONS: GptImageOptions = {width:1024,height:768,background:"auto",reasoningEffort:"low",outputCompression:90,frameCount:9,frameDurationMs:200,svgModel:"gpt-6-astra",maskUrl:"",markupImageUrl:"",enableSafetyChecker:true};
export const GPT_IMAGE_SIZES = [
  {value:"default_4_3",label:"1024 × 768 (4:3)",width:1024,height:768},
  {value:"square_hd",label:"1024 × 1024 (1:1)",width:1024,height:1024},
  {value:"landscape_16_9",label:"1536 × 864 (16:9)",width:1536,height:864},
  {value:"portrait_4_3",label:"768 × 1024 (3:4)",width:768,height:1024},
  {value:"portrait_16_9",label:"864 × 1536 (9:16)",width:864,height:1536},
  {value:"landscape_2k",label:"2048 × 1536 (4:3)",width:2048,height:1536},
  {value:"landscape_4k",label:"3840 × 2160 (16:9)",width:3840,height:2160}
];
export function gptImageSize(value?: string | null, width?: number | null, height?: number | null): "auto" | {width:number;height:number} {
  if (value === "auto") return "auto";
  if (value === "custom") return {width:width ?? 1024,height:height ?? 768};
  const size=GPT_IMAGE_SIZES.find(s=>s.value===(value==="square"?"square_hd":value)) || GPT_IMAGE_SIZES[0];
  return {width:size.width,height:size.height};
}

export type GptImageRequestOptions = {
  prompt?: string;
  imageSize?: string | null; imageWidth?: number | null; imageHeight?: number | null;
  quality?: string | null; outputFormat?: string | null; numImages?: number | null;
  imageUrls?: string[]; background?: string | null; imageReasoningEffort?: string | null;
  outputCompression?: number | null; frameCount?: number | null; frameDurationMs?: number | null;
  svgModel?: string | null; maskUrl?: string | null; markupImageUrl?: string | null; enableSafetyChecker?: boolean;
};
export function gptImageOptionError(body: GptImageRequestOptions): string | null {
  if(body.prompt!==undefined&&(typeof body.prompt!=="string"||body.prompt.trim().length>32000))return "studio.gpt26.errorPrompt";
  const edit = Boolean(body.imageUrls?.length);
  if (body.imageUrls !== undefined && (!Array.isArray(body.imageUrls) || body.imageUrls.length>16 || body.imageUrls.some(url=>typeof url!=="string" || !url.trim()))) return "studio.gpt26.errorReferences";
  const size = gptImageSize(body.imageSize,body.imageWidth,body.imageHeight);
  if (body.imageSize!=null && !["auto","custom","square","landscape_4_3",...GPT_IMAGE_SIZES.map(s=>s.value)].includes(body.imageSize)) return "studio.gpt26.errorSize";
  if (size !== "auto" && (!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<=0||size.height<=0||size.width%16!==0||size.height%16!==0||Math.max(size.width,size.height)>3840||Math.max(size.width/size.height,size.height/size.width)>3||size.width*size.height<655360||size.width*size.height>8294400)) return "studio.gpt26.errorSize";
  if (body.quality!=null && !GPT_IMAGE_QUALITIES.includes(body.quality as GptImageQuality)) return "studio.gpt26.errorQuality";
  const format=body.outputFormat || "png";
  if (body.outputFormat!=null && !(edit ? ["jpeg","png","webp","gif"] : ["jpeg","png","webp","gif","svg"]).includes(body.outputFormat)) return "studio.gpt26.errorFormat";
  if (body.background!=null && !["auto","opaque","transparent"].includes(body.background)) return "studio.gpt26.errorBackground";
  if (body.background==="transparent" && !["png","webp","gif","svg"].includes(format)) return "studio.gpt26.errorTransparent";
  if (body.imageReasoningEffort!=null && !["low","medium","high"].includes(body.imageReasoningEffort)) return "studio.gpt26.errorReasoning";
  const count=body.numImages ?? 1;
  if (!Number.isInteger(count)||count<1||count>10||(format==="svg"&&count!==1)) return "studio.gpt26.errorCount";
  if (body.outputCompression!=null && (!["jpeg","webp"].includes(format)||!Number.isInteger(body.outputCompression)||body.outputCompression<0||body.outputCompression>100)) return "studio.gpt26.errorCompression";
  if (format==="gif") {
    const frames=body.frameCount ?? 9,ms=body.frameDurationMs ?? 200;
    if (!Number.isInteger(frames)||frames<2||frames>16||!Number.isInteger(ms)||ms<20||ms>2000) return "studio.gpt26.errorGif";
  } else if (body.frameCount!=null||body.frameDurationMs!=null) return "studio.gpt26.errorGif";
  if (body.svgModel!=null && (format!=="svg"||!GPT_IMAGE_SVG_MODELS.includes(body.svgModel as GptImageOptions["svgModel"]))) return "studio.gpt26.errorSvg";
  if (body.maskUrl && body.markupImageUrl) return "studio.gpt26.errorGuide";
  if([body.maskUrl,body.markupImageUrl].some(url=>url!=null&&typeof url!=="string"))return "studio.gpt26.errorGuide";
  if ((body.maskUrl||body.markupImageUrl) && !edit) return "studio.gpt26.errorGuide";
  if ([body.maskUrl,body.markupImageUrl].some(url=>url && !(typeof url==="string" && /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(url.trim())))) return "studio.gpt26.errorGuide";
  if(body.markupImageUrl?.startsWith("data:")&&!body.markupImageUrl.startsWith("data:image/png;base64,"))return "studio.gpt26.errorGuide";
  if (body.enableSafetyChecker!==undefined&&typeof body.enableSafetyChecker!=="boolean") return "studio.gpt26.errorSafety";
  return null;
}
export function buildGptImageInput(body: GptImageRequestOptions, prompt: string) {
  const format=body.outputFormat || "png";
  return {
    prompt, image_size:gptImageSize(body.imageSize,body.imageWidth,body.imageHeight), quality:gptImageQuality(body.quality),
    background:body.background || "auto", reasoning_effort:body.imageReasoningEffort || "low",
    num_images:body.numImages ?? 1, output_format:format, enable_safety_checker:body.enableSafetyChecker !== false,
    ...(body.imageUrls?.length ? {image_urls:body.imageUrls.map(url=>url.trim())} : {}),
    ...(["jpeg","webp"].includes(format) && body.outputCompression!=null ? {output_compression:body.outputCompression} : {}),
    ...(format==="gif" ? {frame_count:body.frameCount ?? 9,frame_duration_ms:Math.round((body.frameDurationMs ?? 200)/10)*10} : {}),
    ...(format==="svg" ? {svg_model:body.svgModel || "gpt-6-astra"} : {}),
    ...(body.maskUrl ? {mask_url:body.maskUrl.trim()} : {}), ...(body.markupImageUrl ? {markup_image_url:body.markupImageUrl.trim()} : {})
  };
}

const flarePrompt = "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912";
const sunburstPrompt = `Create a high-end hero infographic announcing "GPT Image 2.6 is here."

CONCEPT
A futuristic periodic table of visual styles fused with a museum-grade anatomical specimen plate. The whole poster reads as one precision instrument: engineered, luminous, flawlessly clean. It should feel like a limited-edition print from a Swiss design studio crossed with a launch-keynote hero slide.

FORMAT
Landscape 16:9. Near-black obsidian background with a barely visible graphite grain. A faint hairline construction grid spans the canvas; row and column coordinates (A–F, 1–4) sit in the outer margins like an engineering drawing, with tiny registration marks in the corners.

HEADLINE
"GPT Image 2.6 is here" set large and centered in the top band, in a tight, sharply kerned geometric grotesk. "GPT Image" and "is here" are flat, crisp white type. The "2.6" is a physical object: a single block of machined, brushed titanium with beveled edges, a thin ribbon of spectral light refracting along the bevel and casting a soft cyan-to-magenta glow onto the background. Perfect letterforms, perfect spelling, zero distortion.

THE ONE-SUBJECT RULE
Every panel depicts the exact same subject — a hummingbird frozen in mid-hover, wings blurred, three-quarter view, drinking from a single glowing flower — re-rendered in 24 completely different visual styles. Same pose, same angle, same framing in every tile, so the grid demonstrates identity consistency across styles.

THE GRID (shaped like the periodic table)
Two symmetrical wings of 12 tiles each (3 rows × 4 columns) flank a tall central specimen panel, echoing the two-block silhouette of the periodic table. All 24 tiles are identical in size with mathematically equal gutters, edges locked to the construction grid, nothing cropped, nothing overlapping.

Each tile is styled as an element cell: a two-letter symbol top-left, a small index number top-right, the full style name in tiny monospaced caps along the bottom edge. Borders are 1px cool-grey hairlines with a faint edge-lit glow.

Left wing: Oi Oil Painting · An Anime · Bp Blueprint · Is Isometric 3D · Ph Photorealism · Wc Watercolor · Px Pixel Art · Cl Clay Render · Ci Cinematic Lighting · Pr Product Photography · Fe Fashion Editorial · Ui UI Mockup
Right wing: Td Technical Diagram · Su Surreal Concept Art · Uk Ukiyo-e Woodblock · Ri Risograph Print · Sg Stained Glass · Nw Neon Wireframe · Mc Macro Photography · Nr Film Noir · Lp Low-Poly · Cy Cyanotype · Ho Holographic Foil · Ba Bauhaus Poster

CENTRAL SPECIMEN PANEL
A tall hero panel showing the same hummingbird at large scale in one continuous style sweep: left to right it transitions seamlessly from blueprint linework → clay render → watercolor → photorealism → holographic foil, with no visible seams. Thin anatomical leader lines with numbered callouts extend from the beak, feather groups and wing edge outward toward the matching tiles in the wings, each carrying a tiny monospaced label. A faint diffraction spectrum bleeds along the gutters nearest the panel.

EMBEDDED PROOF-OF-CAPABILITY (subtle)

- All text on every tile is real, legible and correctly spelled, including micro-labels.
- The UI Mockup tile contains a readable miniature interface with actual words and coherent icons.
- The Technical Diagram and Blueprint tiles have accurate dimension lines and readable annotations.
- The Product Photography tile renders the hummingbird as a glass sculpture with physically correct refraction and reflections.
- The Ukiyo-e tile includes a correctly formed vertical Japanese caption block.
- All photographic tiles share one consistent key light from the upper left.
- Feathers, glass, metal and fabric render with no artifacts.

COLOR & FINISH
Restrained spectral palette on obsidian: electric cyan, hot magenta, acid lime and warm amber, used only as edge glows, callout accents and the hero bevel. Thin lines everywhere, generous negative space, strong hierarchy: headline → central specimen → tile grid → micro-labels. Extremely polished, premium, electric.

TYPOGRAPHY
One geometric grotesk for the headline, one monospace for all labels. Sharp, aligned, evenly spaced.

CONSTRAINTS No date. No tagline. No extra caption. No logos or watermarks. The only text is the headline plus the tile and callout labels.`;
const examples = {
  flareText:{prompt:flarePrompt,references:[] as string[],preview:"https://v3b.fal.media/files/b/0a869129/EnWrO3XWjPE0nxBDpaQrj.png"},
  sunburstText:{prompt:sunburstPrompt,references:[] as string[],preview:"https://v3b.fal.media/files/b/0aa9a3d8/brrnJKoDXxFXhOqwcSVKy_enC0gTH3.png"},
  flareEdit:{prompt:"These two are riding together inside a street. Keep the same vibes. Both are standing.",references:["https://v3b.fal.media/files/b/0aa9a428/0cAgjWwKp23FF0Y9usWsR_029_andrew-wyeth.png","https://v3b.fal.media/files/b/0aa9a410/BcCvJXF_7XKPVH3bXMScL_114_andrew-wyeth.png"],preview:"https://v3b.fal.media/files/b/0aa9a49e/EtXID57a6RBQSY_ElY17C_ExXxAYZ2.png"},
  sunburstEdit:{prompt:"Replace her clothing with Gen-z fancy clothing",references:["https://v3b.fal.media/files/b/0aa9a3c5/vdggezMoDpj9DarckSm7y_150_johannes-vermeer.png"],preview:"https://v3b.fal.media/files/b/0aa9a3c6/mrMrDcbFOKzl75tVEdXxo_f44XKXFx.png"}
};
export const GPT_IMAGE_EXAMPLE_PROMPTS = Object.values(examples).map(e=>e.prompt);
export const GPT_IMAGE_EXAMPLE_REFERENCES = Object.values(examples).flatMap(e=>e.references);
export function gptImageExample(provider: string, workflow?: string) {
  if(!isGptImageProvider(provider) || !["text-to-image","image-to-image"].includes(workflow||"")) return null;
  const pro=normalizeGptImageProvider(provider) === "gpt-image-2.6-sunburst";
  return workflow === "image-to-image" ? pro?examples.sunburstEdit:examples.flareEdit : pro?examples.sunburstText:examples.flareText;
}
