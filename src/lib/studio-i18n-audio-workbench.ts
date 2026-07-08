import type { Locale } from "../i18n/routing";

type StudioMessages = Record<string, string>;

const en: StudioMessages = {
  "studio.audioWorkbench.voiceHeroDescription": "Write a voiceover script, choose a voice, then generate polished speech with clear credit cost.",
  "studio.audioWorkbench.musicHeroDescription": "Describe the music style, mood and structure, then generate AI music with clear output settings.",
  "studio.audioWorkbench.voiceStudio": "Voice Studio",
  "studio.audioWorkbench.musicStudio": "Music Studio",
  "studio.audioWorkbench.voiceStudioDescription": "Turn text into natural speech with voice, language and timing controls.",
  "studio.audioWorkbench.musicStudioDescription": "Describe style, lyrics and output settings for AI music generation.",
  "studio.audioWorkbench.ready": "Ready to generate",
  "studio.audioWorkbench.waiting": "Add a prompt",
  "studio.audioWorkbench.voiceScript": "Voice script",
  "studio.audioWorkbench.musicPrompt": "Music prompt",
  "studio.audioWorkbench.voiceTip": "Tip: write clear, speakable sentences and keep pacing natural."
};

const zhCN: StudioMessages = {
  "studio.audioWorkbench.voiceHeroDescription": "输入配音文案，选择声音，然后在清楚看到积分成本后生成自然语音。",
  "studio.audioWorkbench.musicHeroDescription": "描述音乐风格、情绪和结构，并用清晰的输出设置生成 AI 音乐。",
  "studio.audioWorkbench.voiceStudio": "语音工作台",
  "studio.audioWorkbench.musicStudio": "音乐工作台",
  "studio.audioWorkbench.voiceStudioDescription": "将文字转换成自然语音，并保留声音、语言和时间戳控制。",
  "studio.audioWorkbench.musicStudioDescription": "描述风格、歌词和输出设置，生成 AI 音乐。",
  "studio.audioWorkbench.ready": "可以生成",
  "studio.audioWorkbench.waiting": "请输入提示词",
  "studio.audioWorkbench.voiceScript": "配音文案",
  "studio.audioWorkbench.musicPrompt": "音乐提示词",
  "studio.audioWorkbench.voiceTip": "提示：使用清晰、适合朗读的句子，并保持自然节奏。"
};

export const studioAudioWorkbenchMessages: Partial<Record<Locale, StudioMessages>> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": {
    ...zhCN,
    "studio.audioWorkbench.voiceHeroDescription": "輸入配音文案，選擇聲音，並在清楚看到點數成本後生成自然語音。",
    "studio.audioWorkbench.musicHeroDescription": "描述音樂風格、情緒和結構，並用清楚的輸出設定生成 AI 音樂。",
    "studio.audioWorkbench.voiceStudio": "語音工作台",
    "studio.audioWorkbench.musicStudio": "音樂工作台",
    "studio.audioWorkbench.voiceScript": "配音文案",
    "studio.audioWorkbench.musicPrompt": "音樂提示詞"
  },
  "pt-BR": { ...en, "studio.audioWorkbench.voiceStudio": "Estúdio de voz", "studio.audioWorkbench.musicStudio": "Estúdio de música", "studio.audioWorkbench.ready": "Pronto para gerar", "studio.audioWorkbench.waiting": "Adicione um prompt" },
  ru: { ...en, "studio.audioWorkbench.voiceStudio": "Студия голоса", "studio.audioWorkbench.musicStudio": "Студия музыки", "studio.audioWorkbench.ready": "Готово к генерации", "studio.audioWorkbench.waiting": "Добавьте промпт" },
  vi: { ...en, "studio.audioWorkbench.voiceStudio": "Studio giọng nói", "studio.audioWorkbench.musicStudio": "Studio âm nhạc", "studio.audioWorkbench.ready": "Sẵn sàng tạo", "studio.audioWorkbench.waiting": "Thêm prompt" },
  de: { ...en, "studio.audioWorkbench.voiceStudio": "Voice Studio", "studio.audioWorkbench.musicStudio": "Musikstudio", "studio.audioWorkbench.ready": "Bereit zum Generieren", "studio.audioWorkbench.waiting": "Prompt hinzufügen" },
  fr: { ...en, "studio.audioWorkbench.voiceStudio": "Studio voix", "studio.audioWorkbench.musicStudio": "Studio musique", "studio.audioWorkbench.ready": "Prêt à générer", "studio.audioWorkbench.waiting": "Ajoutez un prompt" },
  ja: { ...en, "studio.audioWorkbench.voiceStudio": "ボイススタジオ", "studio.audioWorkbench.musicStudio": "音楽スタジオ", "studio.audioWorkbench.ready": "生成準備完了", "studio.audioWorkbench.waiting": "プロンプトを追加" },
  th: { ...en, "studio.audioWorkbench.voiceStudio": "สตูดิโอเสียง", "studio.audioWorkbench.musicStudio": "สตูดิโอเพลง", "studio.audioWorkbench.ready": "พร้อมสร้าง", "studio.audioWorkbench.waiting": "เพิ่มพรอมป์ต" },
  nl: { ...en, "studio.audioWorkbench.voiceStudio": "Voice studio", "studio.audioWorkbench.musicStudio": "Muziekstudio", "studio.audioWorkbench.ready": "Klaar om te genereren", "studio.audioWorkbench.waiting": "Voeg een prompt toe" },
  he: { ...en, "studio.audioWorkbench.voiceStudio": "סטודיו קול", "studio.audioWorkbench.musicStudio": "סטודיו מוזיקה", "studio.audioWorkbench.ready": "מוכן ליצירה", "studio.audioWorkbench.waiting": "הוסף פרומפט" },
  ko: { ...en, "studio.audioWorkbench.voiceStudio": "음성 스튜디오", "studio.audioWorkbench.musicStudio": "음악 스튜디오", "studio.audioWorkbench.ready": "생성 준비 완료", "studio.audioWorkbench.waiting": "프롬프트 추가" },
  es: { ...en, "studio.audioWorkbench.voiceStudio": "Estudio de voz", "studio.audioWorkbench.musicStudio": "Estudio de música", "studio.audioWorkbench.ready": "Listo para generar", "studio.audioWorkbench.waiting": "Añade un prompt" }
};
