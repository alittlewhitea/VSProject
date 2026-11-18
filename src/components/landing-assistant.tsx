"use client";

import Link from "../features/studio/studio-link";
import { AuthLink } from "./auth-link";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Locale } from "../i18n/routing";
import { BrandMark } from "./brand-mark";
import type { AssistantAction, AssistantContext, AssistantReply, AssistantTurn } from "../lib/creation-assistant";
import { assistantKnowledgeScope, assistantScopedConversation } from "../lib/assistant-knowledge-scope";
import { assistantDirectIntent, isAssistantShortcut } from "../lib/assistant-direct-intent";
import styles from "./landing-assistant.module.css";

type Topic = "product" | "pricing" | "trial" | "image" | "general" | "prompt" | "current-cost" | "references";
type Message = { id: number; role: "user" | "assistant"; text: string; topic?: Topic; suggestedPrompt?: string; contextKey?: string; actions?: AssistantAction[] };
export type AssistantWorkspaceContext = {
  key: string; workflow: string; model: string; settings: string; credits: number;
  canApplyPrompt: boolean; busy: boolean;
  getContext: (includeImages?: boolean) => Promise<AssistantContext>;
  onApplyPrompt: (prompt: string) => void;
  onSelectAction?: (href: string) => void;
};
type IconName = "sparkles" | "video" | "image" | "credits" | "arrow" | "close" | "reset" | "send";

function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "sparkles" ? <><path d="m10 3 1.7 5.3L17 10l-5.3 1.7L10 17l-1.7-5.3L3 10l5.3-1.7L10 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></> :
      name === "video" ? <><rect x="3" y="5" width="13" height="14" rx="3" /><path d="m16 10 5-3v10l-5-3" /></> :
      name === "image" ? <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" /></> :
      name === "credits" ? <><rect x="3" y="5" width="18" height="14" rx="4" /><path d="M3 10h18M7 15h3" /></> :
      name === "arrow" ? <><path d="M5 12h14m-5-5 5 5-5 5" /></> :
      name === "send" ? <><path d="M12 19V5m-6 6 6-6 6 6" /></> :
      name === "reset" ? <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></> : <path d="m6 6 12 12M18 6 6 18" />}
  </svg>;
}

const english = {
  title: "DreamFace assistant", subtitle: "Find your next image or video model", launcher: "Help me choose", ai: "AI", close: "Close assistant", reset: "Start over",
  welcome: "What would you like to create?", intro: "Find the right model and a place to start.",
  product: "Make a product video", productHint: "Turn a product photo into a short ad", pricing: "Compare models & credits", pricingHint: "Find an option that fits your idea", trial: "Can I try it for free?", trialHint: "See how to get started",
  placeholder: "Ask about models, credits, or your idea…", send: "Send message", keyboard: "Enter to send", assistantName: "DreamFace", working: "Preparing a suggestion",
  productReply: "Start with one product photo. These two models offer a simple way in:", pricingReply: "Here are a few starting points. Credits depend on the model, duration, resolution and references.",
  trialReply: "Start in the studio to see the trial options available to your account. Every generation shows its credit cost before you continue.",
  imageReply: "For a product image or a new visual, start with Seedream 5.5. Describe your idea, or add a photo to edit.",
  generalReply: "I can help you find a video or image model, compare credits, and choose a starting point. What would you like to make?",
  videoLabel: "Product video", imageLabel: "Image creation", heygenHint: "A simple product clip", seedanceHint: "Start/end frames · native audio", imageHint: "Text to image · 1K", start: "Start creating", studio: "Explore the studio", faq: "Read common questions", credits: "credits", from: "from", fiveSeconds: "5 sec", balance: "A simple start", control: "More creative control", quoteHint: "Example quotes. Confirm your settings in the studio.", imageQuick: "Create an image", modelQuick: "Help me pick a model",
  productPrompt: "Create a polished product video from the uploaded image. Preserve the product's exact shape, colors, branding and details. Use soft studio lighting, a slow camera push-in, natural movement and a clean background. No added text or unrelated objects."
};
type Copy = typeof english;
const chinese: Copy = {
  title: "DreamFace 创作助手", subtitle: "帮你选择适合的图片与视频模型", launcher: "帮我选模型", ai: "AI", close: "关闭助手", reset: "重新开始",
  welcome: "今天，想创作什么？", intro: "选一个目标，找到适合你的模型和起点。",
  product: "制作产品广告视频", productHint: "用一张产品图，开始第一条视频", pricing: "比较模型和积分", pricingHint: "找到符合效果与预算的选择", trial: "可以免费试用吗？", trialHint: "了解试用方式和开始步骤",
  placeholder: "问问模型、积分，或描述你的想法…", send: "发送消息", keyboard: "Enter 发送", assistantName: "DreamFace", working: "正在整理建议",
  productReply: "先准备一张产品图，这两个模型都适合开始：", pricingReply: "可以先参考下面的选择。积分会随模型、时长、清晰度和素材变化。",
  trialReply: "可以先进入工作台，查看你的账号当前可用的试用权益。每次生成前，界面都会显示所需积分。",
  imageReply: "制作产品图或新画面，可以从 Seedream 5.5 开始。输入想法即可生成，也可以上传图片进行编辑。",
  generalReply: "我可以帮你选择图片或视频模型、比较积分，并找到创作入口。你想先做哪一种？",
  videoLabel: "产品视频", imageLabel: "图片创作", heygenHint: "适合先做一条产品演示", seedanceHint: "首尾帧控制 · 原生音频", imageHint: "文生图 · 1K", start: "用这个模型开始", studio: "进入工作台看看", faq: "查看常见问题", credits: "积分", from: "起", fiveSeconds: "5 秒", balance: "轻松起步", control: "更多创作控制", quoteHint: "以上为示例报价，进入工作台后可确认具体设置。", imageQuick: "生成一张图片", modelQuick: "帮我选视频模型",
  productPrompt: "根据上传的产品图，制作一段精致的产品展示视频。保留产品的形状、颜色、品牌标识和细节。使用柔和棚拍光线、缓慢推进的镜头、自然运动和干净背景，不添加额外文字或无关物品。"
};
const traditional: Copy = { ...chinese,
  title: "DreamFace 創作助手", subtitle: "幫你選擇適合的圖片與影片模型", launcher: "幫我選模型", close: "關閉助手", reset: "重新開始", welcome: "今天，想創作什麼？", intro: "選一個目標，找到適合你的模型和起點。",
  product: "製作產品廣告影片", productHint: "用一張產品圖，開始第一條影片", pricing: "比較模型和點數", pricingHint: "找到符合效果與預算的選擇", trial: "可以免費試用嗎？", trialHint: "了解試用方式和開始步驟", placeholder: "問問模型、點數，或描述你的想法…", send: "傳送訊息", keyboard: "Enter 傳送", working: "正在整理建議",
  productReply: "先準備一張產品圖，這兩個模型都適合開始：", pricingReply: "可以先參考下面的選擇。點數會隨模型、時長、清晰度和素材變化。", trialReply: "可以先進入工作台，查看你的帳號目前可用的試用權益。每次生成前，介面都會顯示所需點數。", imageReply: "製作產品圖或新畫面，可以從 Seedream 5.5 開始。輸入想法即可生成，也可以上傳圖片進行編輯。", generalReply: "我可以幫你選擇圖片或影片模型、比較點數，並找到創作入口。你想先做哪一種？",
  videoLabel: "產品影片", imageLabel: "圖片創作", heygenHint: "適合先做一條產品展示", seedanceHint: "首尾幀控制 · 原生音訊", imageHint: "文生圖 · 1K", start: "用這個模型開始", studio: "進入工作台看看", faq: "查看常見問題", credits: "點數", from: "起", fiveSeconds: "5 秒", balance: "輕鬆起步", control: "更多創作控制", quoteHint: "以上為範例報價，進入工作台後可確認具體設定。", imageQuick: "生成一張圖片", modelQuick: "幫我選影片模型"
};

const studioEnglish = { launcher: "Creation assistant", welcome: "What can I help you create?", intro: "Suggestions for your current model and settings.", prompt: "Help me write a prompt", promptHint: "Turn your idea into a clearer description", cost: "How many credits will this use?", costHint: "Check the quote for your current settings", references: "How do I use references?", referencesHint: "See what this workflow supports", promptReply: "Here is a starting point for this workflow. You can fill it into the editor, then continue editing.", costReply: "This is the current quote for your selected model and settings:", referenceReply: "For this workflow:", generalReply: "I can help with your prompt, the current credit quote, or reference requirements. Choose an option below.", apply: "Fill into editor", promptLabel: "Suggested prompt", busy: "Generation in progress", costLabel: "Estimated credits", costNote: "The estimate updates when you change settings or references.", noPrompt: "This workflow does not need a written prompt. Follow the reference steps instead." };
const studioChinese: typeof studioEnglish = { launcher: "创作助手", welcome: "这次创作，需要什么帮助？", intro: "围绕当前模型和设置，为你整理下一步。", prompt: "帮我整理提示词", promptHint: "保留你的想法，补充清晰的描述", cost: "本次会消耗多少积分？", costHint: "查看当前模型和参数的预计积分", references: "参考素材应该怎么用？", referencesHint: "了解当前工作流的素材要求", promptReply: "这里有一版适合当前工作流的示例，你可以填入编辑器后继续修改。", costReply: "按照当前模型和设置，预计消耗如下：", referenceReply: "当前工作流的素材用法：", generalReply: "我可以帮你整理提示词、查看本次积分，或者说明参考素材要求。选一个入口继续即可。", apply: "填入编辑器", promptLabel: "提示词建议", busy: "正在生成，请稍候", costLabel: "本次预计", costNote: "修改参数或素材后，预计积分会同步更新。", noPrompt: "这个工作流无需填写提示词，可以直接按素材要求操作。" };
const studioTraditional: typeof studioEnglish = { ...studioChinese, launcher: "創作助手", welcome: "這次創作，需要什麼幫助？", intro: "圍繞目前模型和設定，為你整理下一步。", prompt: "幫我整理提示詞", promptHint: "保留你的想法，補充清晰的描述", cost: "本次會消耗多少點數？", costHint: "查看目前模型和參數的預計點數", references: "參考素材應該怎麼用？", referencesHint: "了解目前工作流的素材要求", promptReply: "這裡有一版適合目前工作流的範例，你可以填入編輯器後繼續修改。", costReply: "按照目前模型和設定，預計消耗如下：", referenceReply: "目前工作流的素材用法：", generalReply: "我可以幫你整理提示詞、查看本次點數，或者說明參考素材要求。選一個入口繼續即可。", apply: "填入編輯器", promptLabel: "提示詞建議", busy: "正在生成，請稍候", costLabel: "本次預計", costNote: "修改參數或素材後，預計點數會同步更新。", noPrompt: "這個工作流無需填寫提示詞，可以直接按素材要求操作。" };

export function LandingAssistant({ locale, workspace, placement }: { locale: Locale; workspace?: AssistantWorkspaceContext; placement?: "studio" }) {
  const copy = locale === "zh-CN" ? chinese : locale === "zh-TW" ? traditional : english;
  const studioCopy = locale === "zh-CN" ? studioChinese : locale === "zh-TW" ? studioTraditional : studioEnglish;
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [failure, setFailure] = useState<"busy" | "unavailable" | "changed" | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const retryRef = useRef<{ text: string; chosen?: Topic } | null>(null);
  const composingRef = useRef(false);
  const nextId = useRef(0);
  const titleId = useId();
  const contextKey = workspace?.key;

  useEffect(() => {
    if (requestRef.current) {
      requestRef.current.abort(); requestRef.current = null; setTyping(false); setFailure("changed");
    }
  }, [contextKey]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(media.matches);
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); requestRef.current?.abort(); requestRef.current = null; };
  }, []);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    if (!mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const fitKeyboard = () => {
      if (!viewport || !panelRef.current) return;
      panelRef.current.style.setProperty("--assistant-visible-height", `${viewport.height}px`);
      panelRef.current.style.setProperty("--assistant-keyboard-inset", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    fitKeyboard(); viewport?.addEventListener("resize", fitKeyboard); viewport?.addEventListener("scroll", fitKeyboard);
    return () => {
      document.body.style.overflow = previous;
      viewport?.removeEventListener("resize", fitKeyboard); viewport?.removeEventListener("scroll", fitKeyboard);
      panelRef.current?.style.removeProperty("--assistant-visible-height"); panelRef.current?.style.removeProperty("--assistant-keyboard-inset");
    };
  }, [open, mobile]);
  useEffect(() => {
    if (!open || mobile) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target) || launcherRef.current?.contains(event.target)) return;
      // Let the clicked workspace control receive focus instead of moving it
      // back to the launcher. Keep the conversation and unsent draft intact.
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [open, mobile]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input) { input.style.height = "0px"; input.style.height = `${Math.min(88, Math.max(36, input.scrollHeight))}px`; }
  }, [draft, open]);
  useEffect(() => {
    const container = conversationRef.current;
    if (!container) return;
    const replies = container.querySelectorAll<HTMLElement>('[data-assistant-message="assistant"]');
    const latest = replies[replies.length - 1];
    if (!typing && latest && messages.at(-1)?.role === "assistant") container.scrollTop += latest.getBoundingClientRect().top - container.getBoundingClientRect().top - 16;
    else container.scrollTop = container.scrollHeight;
  }, [messages, typing, open]);

  function close() { setOpen(false); requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true })); }
  function reset() { requestRef.current?.abort(); requestRef.current = null; retryRef.current = null; setTyping(false); setMessages([]); setDraft(""); setFailure(null); setCopied(null); }
  async function send(value: string, chosen?: Topic, retry = false) {
    const text = value.trim().slice(0, 2000);
    if (!text || requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    const turns: AssistantTurn[] = messages.map(message => ({ role: message.role, content: message.text + (message.suggestedPrompt ? `\n\nSuggested prompt:\n${message.suggestedPrompt}` : "") }));
    if (!retry || turns.at(-1)?.role !== "user" || turns.at(-1)?.content !== text) turns.push({ role: "user", content: text });
    while (turns.length > 12 || turns.reduce((length, turn) => length + turn.content.length, 0) > 24000) turns.shift();
    while (turns[0]?.role !== "user") turns.shift();
    const key = workspace?.key;
    if (!retry) setMessages(current => [...current, { id: ++nextId.current, role: "user", text }]);
    setDraft(""); setTyping(true); setFailure(null); retryRef.current = { text, chosen };
    const timer = setTimeout(() => controller.abort(), 40000);
    try {
      const baseContext = await workspace?.getContext(false);
      const surface = workspace || placement === "studio" ? "studio" as const : "landing" as const;
      const shortcut = isAssistantShortcut(chosen) ? chosen : undefined;
      const request = { locale, surface, messages: turns, context: baseContext, shortcut };
      const directIntent = assistantDirectIntent(request);
      if (controller.signal.aborted) return;
      if (directIntent === "current-cost" && workspace) {
        setMessages(current => [...current, {
          id: ++nextId.current, role: "assistant", text: studioCopy.costReply,
          topic: "current-cost", contextKey: key
        }]);
        retryRef.current = null;
        return;
      }
      const scope = assistantKnowledgeScope(request);
      const needsContext = scope.usesWorkspace || directIntent === "references" || directIntent === "budget";
      const context = needsContext ? !directIntent && scope.needsImages ? await workspace?.getContext(true) : baseContext : undefined;
      if (controller.signal.aborted) throw new Error("Request cancelled");
      const response = await fetch("/api/ai/assistant", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, surface, messages:assistantScopedConversation(request,scope), context, shortcut }), signal: controller.signal });
      if (!response.ok) { setFailure(response.status === 429 ? "busy" : "unavailable"); return; }
      const result = await response.json() as AssistantReply;
      if (typeof result.reply !== "string" || !result.reply.trim() || result.reply.length > 10000 || !Array.isArray(result.actions)) throw new Error("Invalid reply");
      if (requestRef.current !== controller) return;
      setMessages(current => [...current, { id: ++nextId.current, role: "assistant", text: result.reply, suggestedPrompt: result.suggestedPrompt,
        actions: result.actions.filter(action => typeof action.href === "string" && (action.href.startsWith("/studio?") || action.href === "/video/seedance-2-5-flash" || action.href === "/auth")),
        topic: chosen === "current-cost" ? chosen : undefined, contextKey: key }]);
      retryRef.current = null;
    } catch { if (requestRef.current === controller) setFailure("unavailable"); }
    finally { clearTimeout(timer); if (requestRef.current === controller) { requestRef.current = null; setTyping(false); } }
  }
  const quickStarts: { topic: Topic; title: string; hint: string; icon: IconName }[] = workspace ? [
    { topic: "prompt", title: studioCopy.prompt, hint: studioCopy.promptHint, icon: "sparkles" },
    { topic: "current-cost", title: studioCopy.cost, hint: studioCopy.costHint, icon: "credits" },
    { topic: "references", title: studioCopy.references, hint: studioCopy.referencesHint, icon: "image" }
  ] : [
    { topic: "product", title: copy.product, hint: copy.productHint, icon: "video" },
    { topic: "pricing", title: copy.pricing, hint: copy.pricingHint, icon: "credits" },
    { topic: "trial", title: copy.trial, hint: copy.trialHint, icon: "sparkles" }
  ];
  const visibleQuickStarts = workspace && !workspace.canApplyPrompt ? quickStarts.filter(item => item.topic !== "prompt") : quickStarts;
  const zh = locale.startsWith("zh");
  const failureText = failure === "busy" ? zh ? "提问有些频繁，请稍后再试。" : "Too many requests. Please try again shortly."
    : failure === "changed" ? zh ? "创作设置已更新，可以基于新设置重新提问。" : "Your settings changed. Ask again using the updated workspace."
    : zh ? "助手暂时没有连接成功，请重试。你的创作内容已保留。" : "The assistant could not connect. Please try again; your work is preserved.";

  return createPortal(<div className={`${styles.widget} ${workspace || placement === "studio" ? styles.workspaceWidget : ""}`} dir="ltr" data-landing-assistant-preview data-assistant-workspace={workspace ? true : undefined}>
    {!open ? <button ref={launcherRef} type="button" className={styles.launcher} aria-label={workspace ? studioCopy.launcher : copy.launcher} title={workspace ? studioCopy.launcher : copy.launcher} aria-haspopup="dialog" aria-expanded={false} onClick={() => setOpen(true)} data-assistant-launcher>
      <span className={styles.launcherIcon}><Icon name="sparkles" /></span>
    </button> : <>
      {mobile ? <button type="button" className={styles.backdrop} aria-label={copy.close} onClick={close} tabIndex={-1} /> : null}
      <section ref={panelRef} role="dialog" aria-modal={mobile || undefined} aria-labelledby={titleId} className={styles.panel} tabIndex={-1} data-assistant-panel onKeyDown={event => {
        if (event.key === "Enter") event.stopPropagation();
        if (event.key === "Escape" && !composingRef.current && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); close(); }
        if (mobile && event.key === "Tab" && panelRef.current) {
          const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea'));
          const first = items[0], last = items.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <div className={styles.mobileHandle} aria-hidden="true" />
        <header className={styles.header}>
          <span className={styles.brand}><BrandMark width={34} height={34} sizes="34px" /><span><strong id={titleId}>{workspace ? studioCopy.launcher : copy.title}<span className={styles.aiBadge}>{copy.ai}</span></strong><span>{workspace ? studioCopy.intro : copy.subtitle}</span></span></span>
          <div className={styles.headerActions}><button type="button" onClick={reset} title={copy.reset} aria-label={copy.reset} disabled={!messages.length && !draft} data-assistant-reset><Icon name="reset" /></button><button type="button" onClick={close} aria-label={copy.close} data-assistant-close><Icon name="close" /></button></div>
        </header>
        {workspace ? <div className={styles.workspaceContext} data-assistant-context><span><small>{workspace.workflow}</small><strong>{workspace.model}</strong></span><span><strong>{workspace.credits.toLocaleString()} <small>{copy.credits}</small></strong><small>{workspace.settings}</small></span></div> : null}
        <div ref={conversationRef} className={styles.conversation} data-assistant-conversation>
          {!messages.length ? <div className={styles.welcome}>
            <span className={styles.welcomeMark} aria-hidden="true"><Icon name="sparkles" /></span>
            <h2>{workspace ? studioCopy.welcome : copy.welcome}</h2><p>{workspace ? studioCopy.intro : copy.intro}</p>
            <div className={styles.quickStarts}>{visibleQuickStarts.map(item => <button key={item.topic} type="button" disabled={typing} className={styles.quickStart} onClick={() => void send(item.title, item.topic)} data-assistant-topic={item.topic}>
              <span className={styles.quickIcon} data-topic={item.topic}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><span>{item.hint}</span></span><Icon name="arrow" className={styles.quickArrow} />
            </button>)}</div>
          </div> : <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions" aria-busy={typing}>
            {messages.map(message => <div key={message.id} className={message.role === "user" ? styles.userMessage : styles.assistantMessage} data-assistant-message={message.role}>
              {message.role === "assistant" ? <span className={styles.messageIdentity}><Icon name="sparkles" />{copy.assistantName}</span> : null}
              <p>{message.text}</p>
              {message.suggestedPrompt ? <div className={styles.promptCard}><span>{studioCopy.promptLabel}</span><pre>{message.suggestedPrompt}</pre>{workspace ? <button type="button" data-assistant-apply disabled={workspace.busy || !workspace.canApplyPrompt || workspace.key !== message.contextKey} onClick={() => { if (workspace.busy || !workspace.canApplyPrompt || workspace.key !== message.contextKey) return; workspace.onApplyPrompt(message.suggestedPrompt!); close(); }}>{workspace.busy ? studioCopy.busy : studioCopy.apply}<Icon name="arrow" /></button> : <button type="button" onClick={() => { void navigator.clipboard.writeText(message.suggestedPrompt!).then(() => setCopied(message.id)).catch(() => {}); }}>{copied === message.id ? zh ? "已复制" : "Copied" : zh ? "复制提示词" : "Copy prompt"}<Icon name="arrow" /></button>}</div> : null}
              {message.topic === "current-cost" && workspace && workspace.key === message.contextKey ? <div className={styles.currentQuote} data-assistant-current-quote><span>{studioCopy.costLabel}</span><strong>{workspace.credits.toLocaleString()} <small>{copy.credits}</small></strong><p>{workspace.model} · {workspace.settings}</p><span>{studioCopy.costNote}</span></div> : null}
              {message.actions?.length ? <div className={styles.assistantActions}>{message.actions.map((action, index) => {
                const ActionLink = action.href === "/auth" ? AuthLink : Link;
                return <ActionLink key={`${action.href}-${index}`} href={action.href} prefetch={false} onClick={event => {
                  if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    workspace?.onSelectAction?.(action.href);
                    close();
                  }
                }} data-assistant-action>
                  <span>
                    <strong>{action.label}</strong>
                    {action.description ? <small>{action.description}</small> : null}
                    {typeof action.credits === "number" ? <span className={styles.actionQuote} data-assistant-action-quote>{action.workflow} · {action.settings} · {action.credits.toLocaleString()} {copy.credits}{action.affordable === false ? <em>{zh ? "积分不足" : "Above balance"}</em> : null}</span> : null}
                  </span>
                  <Icon name="arrow" />
                </ActionLink>;
              })}</div> : null}
            </div>)}
            {typing ? <div className={styles.typing} role="status" aria-label={copy.working}><i /><i /><i /></div> : null}
          </div>}
        </div>
        {failure ? <div className={styles.requestFailure} role="status" data-assistant-error><span>{failureText}</span>{retryRef.current ? <button type="button" onClick={() => { const retry = retryRef.current; if (retry) void send(retry.text, retry.chosen, true); }}>{zh ? "重试" : "Retry"}</button> : null}</div> : null}
        {messages.length && !typing ? <div className={styles.followUps} aria-label={workspace ? studioCopy.launcher : copy.launcher}>{workspace ? <>{workspace.canApplyPrompt ? <button type="button" onClick={() => send(studioCopy.prompt, "prompt")}>{studioCopy.prompt}</button> : null}<button type="button" onClick={() => send(studioCopy.references, "references")}>{studioCopy.references}</button></> : <><button type="button" onClick={() => send(copy.modelQuick, "product")}>{copy.modelQuick}</button><button type="button" onClick={() => send(copy.imageQuick, "image")}>{copy.imageQuick}</button></>}</div> : null}
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); send(draft); }}>
          <div className={styles.inputRow}><textarea ref={inputRef} rows={1} maxLength={2000} value={draft} aria-label={copy.placeholder} placeholder={copy.placeholder} onChange={event => setDraft(event.target.value)} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !composingRef.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(draft); }
          }} data-assistant-input /><button type="submit" aria-label={copy.send} disabled={!draft.trim() || typing} data-assistant-send><Icon name="send" /></button></div>
          <div className={styles.composerHint}><Icon name="sparkles" /><span>DreamFace AI</span><span>{copy.keyboard}</span></div>
        </form>
      </section>
    </>}
  </div>, document.body);
}
