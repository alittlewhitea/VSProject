// Keep the existing provider key as a compatibility alias for Flare.
export const isGptImageProvider = (provider: string) => provider === "chatgpt-image" || provider === "gpt-image-2.5-sunburst";
export const gptImageEndpoint = (provider: string, edit = false) => `openai/gpt-image-2.5/${provider === "gpt-image-2.5-sunburst" ? "sunburst" : "flare"}/${edit ? "edit" : "text-to-image"}`;
// Only offer quality levels with a published fal size-price baseline.
export const GPT_IMAGE_QUALITIES = ["low", "medium", "high"] as const;
export const gptImageQuality = (value?: string | null) => value === "medium" || value === "high" ? value : "low";
export const GPT_IMAGE_SIZES = [
  {value:"default_4_3",label:"1024 × 768 (4:3)",width:1024,height:768},
  {value:"square_hd",label:"1024 × 1024 (1:1)",width:1024,height:1024},
  {value:"landscape_16_9",label:"1536 × 864 (16:9)",width:1536,height:864},
  {value:"portrait_4_3",label:"768 × 1024 (3:4)",width:768,height:1024},
  {value:"portrait_16_9",label:"864 × 1536 (9:16)",width:864,height:1536}
];
export function gptImageSize(value?: string | null) {
  const size=GPT_IMAGE_SIZES.find(s=>s.value===(value==="square"?"square_hd":value)) || GPT_IMAGE_SIZES[0];
  return {width:size.width,height:size.height};
}

const flarePrompt = "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912";
const sunburstPrompt = `Create a high-end hero infographic announcing "GPT Image 2.5 is here."

CONCEPT
A futuristic periodic table of visual styles fused with a museum-grade anatomical specimen plate. The whole poster reads as one precision instrument: engineered, luminous, flawlessly clean. It should feel like a limited-edition print from a Swiss design studio crossed with a launch-keynote hero slide.

FORMAT
Landscape 16:9. Near-black obsidian background with a barely visible graphite grain. A faint hairline construction grid spans the canvas; row and column coordinates (A–F, 1–4) sit in the outer margins like an engineering drawing, with tiny registration marks in the corners.

HEADLINE
"GPT Image 2.5 is here" set large and centered in the top band, in a tight, sharply kerned geometric grotesk. "GPT Image" and "is here" are flat, crisp white type. The "2.5" is a physical object: a single block of machined, brushed titanium with beveled edges, a thin ribbon of spectral light refracting along the bevel and casting a soft cyan-to-magenta glow onto the background. Perfect letterforms, perfect spelling, zero distortion.

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
  const pro=provider === "gpt-image-2.5-sunburst";
  return workflow === "image-to-image" ? pro?examples.sunburstEdit:examples.flareEdit : pro?examples.sunburstText:examples.flareText;
}
