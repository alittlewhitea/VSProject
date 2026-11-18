/** Shared wire format. Credentials and the assistant's instructions stay on the server. */
export type AssistantTurn = { role: "user" | "assistant"; content: string };
export type AssistantShortcut = "current-cost" | "references" | "pricing" | "trial";
export type AssistantContext = {
  workflow: string; provider: string; prompt: string;
  duration?: string; resolution?: string; ratio?: string; imageSize?: string;
  numImages?: number; quality?: string; generateAudio?: boolean; seedanceTask?: string;
  imageCount?: number; videoCount?: number; audioCount?: number;
  imageUrls?: string[]; dialogueMode?: boolean;
  imageWidth?: number; imageHeight?: number; outputFormat?: string;
  imageReasoningEffort?: string; frameCount?: number; svgModel?: string;
  enableWebSearch?: boolean; thinkingLevel?: string;
};
export type AssistantRequest = { locale: string; surface: "landing" | "studio"; messages: AssistantTurn[]; context?: AssistantContext; shortcut?: AssistantShortcut; account?: { creditBalance: number; h3DailyFreeAvailable?: boolean } };
export type AssistantAction = { label: string; description: string; href: string; workflow?: string; credits?: number; settings?: string; affordable?: boolean };
export type AssistantReply = { reply: string; suggestedPrompt?: string; actions: AssistantAction[]; model?: string };
