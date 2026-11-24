"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GEMINI_TTS_PROVIDER, geminiTtsBillableText, geminiTtsCharacters, newGeminiTtsOptions, prepareGeminiTts } from "../../lib/gemini-tts";
import { HEYGEN_VOICE_PROVIDER, heygenVoiceCharacters, isHeygenVoiceFree, newHeygenVoiceOptions, prepareHeygenVoice } from "../../lib/heygen-voice";
import type { StudioMode } from "./studio-storage";
import { ELEVENLABS_VOICE_GENDER_OPTIONS, ELEVENLABS_VOICE_META } from "./studio-workspace-config";

type AudioStateOptions = {
  mode: StudioMode;
  provider: string;
  prompt: string;
  pricingTime: number;
};

export function useStudioAudioState({ mode, provider, prompt, pricingTime }: AudioStateOptions) {
  const [ttsVoice, setTtsVoice] = useState("Rachel");
  const [geminiTts, setGeminiTts] = useState(newGeminiTtsOptions);
  const [heygenVoice, setHeygenVoice] = useState(newHeygenVoiceOptions);
  const heygenVoiceFreeIntentRef = useRef(false);
  const [avatarVoiceGender, setAvatarVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [audioVoiceGender, setAudioVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [ttsStability, setTtsStability] = useState(0.5);
  const [ttsTimestamps, setTtsTimestamps] = useState(false);
  const [ttsLanguageCode, setTtsLanguageCode] = useState("");
  const [textNormalization, setTextNormalization] = useState("auto");
  const [musicLyrics, setMusicLyrics] = useState("[Verse]\nStreetlights flicker, the night breeze sighs\nShadows stretch as I walk alone\n\n[Chorus]\nWandering, longing, where should I go");
  const [lyricsOptimizer, setLyricsOptimizer] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [musicSampleRate, setMusicSampleRate] = useState(44100);
  const [musicBitrate, setMusicBitrate] = useState(256000);
  const [musicFormat, setMusicFormat] = useState<"mp3" | "wav" | "pcm">("mp3");
  const [musicAdvancedOpen, setMusicAdvancedOpen] = useState(false);

  const avatarVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => avatarVoiceGender === "all" || voice.gender === avatarVoiceGender).map((voice) => voice.name) as string[],
    [avatarVoiceGender]
  );
  const audioVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => audioVoiceGender === "all" || voice.gender === audioVoiceGender).map((voice) => voice.name) as string[],
    [audioVoiceGender]
  );

  useEffect(() => {
    if (mode !== "avatar") return;
    if (avatarVoiceOptions.length && !avatarVoiceOptions.includes(ttsVoice)) {
      setTtsVoice(avatarVoiceOptions[0]);
    }
  }, [avatarVoiceOptions, mode, ttsVoice]);

  useEffect(() => {
    if (mode !== "audio" || provider !== "elevenlabs-tts") return;
    if (audioVoiceOptions.length && !audioVoiceOptions.includes(ttsVoice)) {
      setTtsVoice(audioVoiceOptions[0]);
    }
  }, [audioVoiceOptions, mode, provider, ttsVoice]);

  const isMiniMaxMusic = mode === "audio" && provider === "minimax-music-2.6";
  const isElevenLabsAudio = mode === "audio" && provider === "elevenlabs-tts";
  const isGeminiTts = mode === "audio" && provider === GEMINI_TTS_PROVIDER;
  const isHeygenVoice = mode === "audio" && provider === HEYGEN_VOICE_PROVIDER;
  const heygenVoiceFree = isHeygenVoice && isHeygenVoiceFree(pricingTime);
  const heygenVoiceError = isHeygenVoice ? prepareHeygenVoice(prompt, heygenVoice).error : null;
  const geminiSpeech = prepareGeminiTts(geminiTts.mode === "dialogue" ? "" : prompt, geminiTts);
  const speechBillableText = isGeminiTts ? geminiTtsBillableText(prompt, geminiTts) : prompt;
  const audioCharacterCount = mode === "audio"
    ? isHeygenVoice
      ? heygenVoiceCharacters(prompt)
      : isGeminiTts
        ? geminiTtsCharacters(speechBillableText)
        : prompt.trim().length
    : 0;

  return {
    ttsVoice,
    setTtsVoice,
    geminiTts,
    setGeminiTts,
    heygenVoice,
    setHeygenVoice,
    heygenVoiceFreeIntentRef,
    avatarVoiceGender,
    setAvatarVoiceGender,
    audioVoiceGender,
    setAudioVoiceGender,
    ttsStability,
    setTtsStability,
    ttsTimestamps,
    setTtsTimestamps,
    ttsLanguageCode,
    setTtsLanguageCode,
    textNormalization,
    setTextNormalization,
    musicLyrics,
    setMusicLyrics,
    lyricsOptimizer,
    setLyricsOptimizer,
    isInstrumental,
    setIsInstrumental,
    musicSampleRate,
    setMusicSampleRate,
    musicBitrate,
    setMusicBitrate,
    musicFormat,
    setMusicFormat,
    musicAdvancedOpen,
    setMusicAdvancedOpen,
    avatarVoiceOptions,
    audioVoiceOptions,
    isMiniMaxMusic,
    isElevenLabsAudio,
    isGeminiTts,
    isHeygenVoice,
    heygenVoiceFree,
    heygenVoiceError,
    geminiSpeech,
    speechBillableText,
    audioCharacterCount
  };
}
