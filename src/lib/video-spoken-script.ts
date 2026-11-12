import { heygenAvatarTiming } from "./heygen-avatar";

export type VideoDialogue = { kind: "standalone" | "embedded"; text: string; segments: string[] };

/** Only classify clear personal speech; ordinary scene descriptions stay visual prompts. */
export function videoDialogue(prompt: string): VideoDialogue | null {
  const text = prompt.trim();
  if (!text) return null;
  const spoken: { index: number; text: string }[] = [];
  const labels = /(?:\b(?:dialogue|spoken dialogue|spoken text|spoken script|voice[- ]?over|narration|narrator)|台词|臺詞|对白|對白|旁白)[ \t]*[:：][ \t]*([^\n]+)/gi;
  for (const match of text.matchAll(labels)) {
    if (!/^["“]/.test(match[1])) spoken.push({ index: match.index!, text: match[1].trim() });
  }
  for (const match of text.matchAll(/"((?:\\.|[^"\\])*)"|“([^”]+)”/g)) {
    const before = text.slice(Math.max(0, match.index! - 100), match.index);
    const marker = /(?:\b(?:dialogue|spoken dialogue|spoken text|spoken script|voice[- ]?over|narration|narrator|says?|speaks?|whispers?|shouts?|asks?|replies|recites?)|台词|臺詞|对白|對白|旁白|说|說)[^.!?\n]*[:：,]?\s*$/i;
    const displayText = /\b(?:shirt|poster|sign|caption|title|text|logo|label|screen)\b[^.!?\n]*\b(?:says?|reads?)\s*[:：]?\s*$/i;
    const silent = /\b(?:no|without|avoid)\s+(?:spoken\s+)?(?:dialogue|speech|voiceover|narration)\b/i;
    if (!marker.test(before) || displayText.test(before) || silent.test(before)) continue;
    let dialogue = match[2] ?? match[1];
    if (match[1] !== undefined) {
      try { dialogue = JSON.parse(match[0]) as string; } catch { /* Keep literal text if user quotes are not JSON. */ }
    }
    if (dialogue.trim()) spoken.push({ index: match.index!, text: dialogue.trim() });
  }
  if (spoken.length) {
    const segments = spoken.sort((a, b) => a.index - b.index).map(item => item.text);
    return { kind: "embedded", text: segments.join("\n"), segments };
  }

  let standalone = text;
  if (text.startsWith('"') && text.endsWith('"')) {
    try { const decoded: unknown = JSON.parse(text); if (typeof decoded === "string") standalone = decoded; } catch {}
  }
  // These words describe directing/animation rather than a message to be spoken.
  if (/\b(?:camera|cinematic|close[- ]?up|wide[- ]?shot|lighting|bokeh|pan|zoom|montage|keyframe|animate|render|reference image|text.to.video|image.to.video|on.screen|typography|caption|title card|logo|poster|lettering|3d text)\b|镜头|鏡頭|运镜|運鏡|生成视频|生成影片|电影感|電影感/i.test(standalone)) return null;
  if (/\b(?:create|generate|make|show|depict|imagine|film|shoot)\s+(?:me\s+)?(?:a|an|the|this|video|clip)\b/i.test(standalone)) return null;
  const greeting = /^(?:hello|hi|hey)\b/i.test(standalone) && /\b(?:you|your|my love|everyone|world|there|friends|guys)\b/i.test(standalone);
  const personal = /^(?:dear\b|good (?:morning|afternoon|evening)\b|welcome\b|thank(?:s| you)\b|i(?:'m| am| love| hope| miss| just want| want to (?:tell|know|say))\b|how (?:are|was|is|have|did|do)\b|you(?:'re| are)\b|we(?:'re| are)\b|bonjour\b|bonsoir\b|salut\b|coucou\b|mon amour\b|je t'aime\b|hola\b|buenos días\b|mi amor\b|te (?:quiero|amo)\b|olá\b|bom dia\b|meu amor\b|hallo\b|guten morgen\b|mein schatz\b|ciao\b|buongiorno\b|你好|您好|大家好|嗨|哈喽|哈囉|亲爱的|親愛的|早上好|晚上好|我爱你|我愛你|我想你|谢谢|謝謝|こんにちは|おはよう|こんばんは|안녕하세요|안녕|مرحبا|أهلا|שלום|привет|สวัสดี)/i.test(standalone);
  return greeting || personal ? { kind: "standalone", text: standalone.trim(), segments: [standalone.trim()] } : null;
}

export function videoDialogueTiming(prompt: string, duration: string) {
  const dialogue = videoDialogue(prompt);
  if (!dialogue) return null;
  const { speechSeconds, requiredSeconds } = heygenAvatarTiming(dialogue.text);
  const selectedSeconds = Number.parseInt(duration, 10);
  return { dialogue, speechSeconds, requiredSeconds, selectedSeconds, maxSeconds: 15,
    tooLong: Number.isFinite(selectedSeconds) && requiredSeconds > selectedSeconds,
    exceedsModelLimit: requiredSeconds > 15 };
}

/** Raw speech is explicitly marked even with AI Enhance switched off or unavailable. */
export function heygenVideoSpokenPrompt(prompt: string) {
  const dialogue = videoDialogue(prompt);
  if (dialogue?.kind !== "standalone") return prompt;
  return `Create one continuous video shot with a speaker delivering the dialogue below naturally. Preserve the identity and visual details of any supplied reference. Use clear native speech and natural lip movements. Speak every word verbatim in its original language, in order. Do not translate, paraphrase, omit or add spoken words. Do not replace dialogue with a description of its meaning. No extra speakers, captions or music.\nDialogue: ${JSON.stringify(dialogue.text)}`;
}

export function shouldDisableHeygenEnhancement(prompt: string, metadata?: { status?: string }) {
  return Boolean(videoDialogue(prompt)) || ["enhanced", "fallback", "disabled", "off"].includes(metadata?.status ?? "");
}
