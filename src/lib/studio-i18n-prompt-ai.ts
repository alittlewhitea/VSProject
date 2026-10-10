import type { Locale } from "../i18n/routing";
const english = {
  "studio.promptAI.optimize": "AI Optimize",
  "studio.promptAI.enhance": "AI Enhance",
  "studio.promptAI.restore": "Restore Original",
  "studio.promptAI.original": "Original Prompt",
  "studio.promptAI.optimizing": "Optimizing prompt…",
  "studio.promptAI.enhanced": "Optimized. You can edit the result before generating.",
  "studio.promptAI.fallback": "AI optimization was not applied. Your original prompt will be used.",
  "studio.promptAI.disabled": "AI optimization is disabled. Your original prompt will be used.",
  "studio.promptAI.login": "Sign in to optimize your prompt.",
  "studio.promptAI.restored": "Original prompt restored."
};
export const studioPromptAiMessages: Record<Locale, Record<string, string>> = {
"en": english,
"zh-CN": {"studio.promptAI.optimize":"AI 智能优化","studio.promptAI.enhance":"AI 智能增强","studio.promptAI.restore":"恢复原文","studio.promptAI.original":"原始提示词","studio.promptAI.optimizing":"正在优化提示词…","studio.promptAI.enhanced":"优化完成，可继续编辑后生成。","studio.promptAI.fallback":"本次未应用 AI 优化，将使用原始提示词。","studio.promptAI.disabled":"AI 优化已关闭，将使用原始提示词。","studio.promptAI.login":"请登录后优化提示词。","studio.promptAI.restored":"已恢复原始提示词。"},
"zh-TW": {"studio.promptAI.optimize":"AI 智慧優化","studio.promptAI.enhance":"AI 智慧增強","studio.promptAI.restore":"恢復原文","studio.promptAI.original":"原始提示詞","studio.promptAI.optimizing":"正在優化提示詞…","studio.promptAI.enhanced":"優化完成，可繼續編輯後生成。","studio.promptAI.fallback":"本次未套用 AI 優化，將使用原始提示詞。","studio.promptAI.disabled":"AI 優化已關閉，將使用原始提示詞。","studio.promptAI.login":"請登入後優化提示詞。","studio.promptAI.restored":"已恢復原始提示詞。"},
"pt-BR": english,
"ru": english,
"vi": english,
"de": english,
"fr": english,
"ja": english,
"th": english,
"nl": english,
"he": english,
"ko": english,
"es": english,
"it": english,
"ar": english,
};
