type Translate = (key: string) => string;

export function PromptEnhancementHistory({ settings, translate }: { settings?: Record<string, unknown> | null; translate: Translate }) {
  const value = settings?.prompt_enhancement || settings?.promptEnhancement;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const original = record.original_prompt ?? record.originalPrompt;
  const status = record.status;
  return (
    <div className="mt-3 border-t border-[#eaecf0] pt-3 text-xs leading-5 text-[#667085]">
      {status === "fallback" || status === "disabled" ? <p role="status">{translate(`studio.promptAI.${status}`)}</p> : null}
      {status === "enhanced" && typeof original === "string" ? <details><summary className="min-h-8 cursor-pointer">{translate("studio.promptAI.original")}</summary><p dir="auto" className="whitespace-pre-wrap break-words">{original}</p></details> : null}
    </div>
  );
}
