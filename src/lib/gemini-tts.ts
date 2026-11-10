export const GEMINI_TTS_PROVIDER = "gemini-flash-tts";
export const GEMINI_TTS_MODEL = "google/gemini-3.8-flash-tts";
export const GEMINI_TTS_RATE_PER_1000 = 0.045;
export const GEMINI_TTS_VOICES = ["Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe", "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux", "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Pulcherrima", "Puck", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi"] as const;

export type GeminiSpeaker = { speaker_id: string; voice: string };
export type GeminiTurn = { speaker_id: string; text: string; style_instructions?: string };
export type GeminiTtsOptions = { mode: "single" | "dialogue"; voice: string; styleInstructions: string; speakers: GeminiSpeaker[]; turns: GeminiTurn[] };
export type GeminiTtsInput = { prompt?: string; voice?: string; style_instructions?: string; speakers?: GeminiSpeaker[]; turns?: GeminiTurn[]; enable_safety_checker: true };
export type GeminiTtsError = "invalid_options" | "invalid_voice" | "missing_text" | "invalid_speakers" | "invalid_turns" | "mixed_input" | "input_too_long";

export function newGeminiTtsOptions(): GeminiTtsOptions {
  return { mode: "single", voice: "Kore", styleInstructions: "", speakers: [{ speaker_id: "A", voice: "Kore" }, { speaker_id: "B", voice: "Puck" }], turns: [{ speaker_id: "A", text: "" }, { speaker_id: "B", text: "" }] };
}

export function restoreGeminiTtsOptions(value: unknown): GeminiTtsOptions {
  const defaults = newGeminiTtsOptions();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const raw = value as Partial<GeminiTtsOptions>;
  const speakers = Array.isArray(raw.speakers) && raw.speakers.length === 2 ? raw.speakers.map((s, i) => ({ speaker_id: typeof s?.speaker_id === "string" ? s.speaker_id : defaults.speakers[i].speaker_id, voice: GEMINI_TTS_VOICES.includes(s?.voice as typeof GEMINI_TTS_VOICES[number]) ? s.voice : defaults.speakers[i].voice })) : defaults.speakers;
  const turns = Array.isArray(raw.turns) && raw.turns.length > 0 ? raw.turns.slice(0, 100).map(turn => ({ speaker_id: typeof turn?.speaker_id === "string" ? turn.speaker_id : speakers[0].speaker_id, text: typeof turn?.text === "string" ? turn.text : "", style_instructions: typeof turn?.style_instructions === "string" ? turn.style_instructions : "" })) : defaults.turns;
  return { mode: raw.mode === "dialogue" ? "dialogue" : "single", voice: GEMINI_TTS_VOICES.includes(raw.voice as typeof GEMINI_TTS_VOICES[number]) ? raw.voice! : "Kore", styleInstructions: typeof raw.styleInstructions === "string" ? raw.styleInstructions : "", speakers, turns };
}

export function geminiTtsBillableText(prompt: string, options?: Partial<GeminiTtsOptions> | null) {
  return options?.mode === "dialogue" ? (Array.isArray(options.turns) ? options.turns.map(turn => typeof turn?.text === "string" ? turn.text.trim() : "").join("") : "") : prompt.trim();
}

export function geminiTtsCharacters(text: string) { return Array.from(text).length; }

export function prepareGeminiTts(prompt: string, raw?: unknown): { input: GeminiTtsInput | null; error: GeminiTtsError | null; billableText: string; transcript: string } {
  const fail = (error: GeminiTtsError) => ({ input: null, error, billableText: "", transcript: "" });
  if (raw !== undefined && (!raw || typeof raw !== "object" || Array.isArray(raw))) return fail("invalid_options");
  const options = (raw || {}) as Partial<GeminiTtsOptions>;
  if (options.mode !== undefined && options.mode !== "single" && options.mode !== "dialogue") return fail("invalid_options");
  if (options.styleInstructions !== undefined && typeof options.styleInstructions !== "string") return fail("invalid_options");
  const style = options.styleInstructions?.trim();
  let input: GeminiTtsInput, transcript: string, billableText: string;
  const voiceValid = (voice: unknown) => typeof voice === "string" && GEMINI_TTS_VOICES.includes(voice as typeof GEMINI_TTS_VOICES[number]);
  if (options.mode === "dialogue") {
    if (prompt.trim()) return fail("mixed_input");
    if (!Array.isArray(options.speakers) || options.speakers.length !== 2 || options.speakers.some(s => !s || typeof s.speaker_id !== "string" || !s.speaker_id.trim() || !voiceValid(s.voice))) return fail("invalid_speakers");
    const speakers = options.speakers.map(s => ({ speaker_id: s.speaker_id.trim(), voice: s.voice }));
    if (speakers[0].speaker_id === speakers[1].speaker_id) return fail("invalid_speakers");
    if (!Array.isArray(options.turns) || !options.turns.length || options.turns.length > 100 || options.turns.some(t => !t || typeof t.speaker_id !== "string" || !speakers.some(s => s.speaker_id === t.speaker_id.trim()) || typeof t.text !== "string" || !t.text.trim() || (t.style_instructions !== undefined && typeof t.style_instructions !== "string"))) return fail("invalid_turns");
    const turns = options.turns.map(t => ({ speaker_id: t.speaker_id.trim(), text: t.text.trim(), ...(t.style_instructions?.trim() ? { style_instructions: t.style_instructions.trim() } : {}) }));
    input = { speakers, turns, ...(style ? { style_instructions: style } : {}), enable_safety_checker: true };
    billableText = turns.map(t => t.text).join("");
    transcript = turns.map(t => `${t.speaker_id}: ${t.text}`).join("\n");
  } else {
    const voice = options.voice ?? "Kore";
    if (!voiceValid(voice)) return fail("invalid_voice");
    if (!prompt.trim()) return fail("missing_text");
    input = { prompt: prompt.trim(), voice, ...(style ? { style_instructions: style } : {}), enable_safety_checker: true };
    transcript = billableText = prompt.trim();
  }
  // Offline conservative bound: UTF-8 bytes, not an exact Gemini token count.
  // This intentionally stays below the provider's 8,192-token combined limit.
  if (new TextEncoder().encode(JSON.stringify(input)).length > 8192) return fail("input_too_long");
  return { input, error: null, billableText, transcript };
}
