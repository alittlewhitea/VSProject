import { PROVIDER_META } from "../features/studio/studio-workspace-config";
import { assistantDirectIntent } from "./assistant-direct-intent";
import { assistantQuote } from "./assistant-generation-context";
import { assistantBudgetOptions, assistantCandidateAction, assistantRequirements } from "./creation-assistant-recommendations";
import { HEYGEN_REFERENCE_IMAGE_LIMIT, HEYGEN_REFERENCE_VIDEO_LIMIT, HEYGEN_REFERENCE_AUDIO_LIMIT, HEYGEN_REFERENCE_IMAGE_BYTES, HEYGEN_REFERENCE_UPLOAD_BYTES } from "./heygen-reference-video";
import { SEEDANCE_FLASH_PROVIDER, SEEDANCE_FLASH_IMAGE_LIMIT, SEEDANCE_FLASH_MEDIA_LIMIT } from "./seedance-flash";
import { SEEDREAM_55_PROVIDER, SEEDREAM_55_REFERENCE_LIMIT } from "./seedream-55";
import { isH3DailyFreeRequest } from "./h3-daily-free-policy";
import { videoSupportsEndFrame } from "./video-keyframes";
import type { AssistantContext, AssistantReply, AssistantRequest } from "./creation-assistant";

type Translate = (en: string, cn: string, tw: string) => string;
const studioHome = "/studio?view=home&assistant=preview";

function referenceHelp(context: AssistantContext, t: Translate) {
  const { workflow, provider, seedanceTask } = context;
  if (workflow === "reference-to-video") {
    if (provider === "heygen-video") {
      const fileMB = HEYGEN_REFERENCE_IMAGE_BYTES / 1024 ** 2;
      const totalMB = HEYGEN_REFERENCE_UPLOAD_BYTES / 1024 ** 2;
      return t(
        `HeyGen accepts up to ${HEYGEN_REFERENCE_IMAGE_LIMIT} images, ${HEYGEN_REFERENCE_VIDEO_LIMIT} video links and ${HEYGEN_REFERENCE_AUDIO_LIMIT} audio links. All references are optional. A prompt is required. Images can be up to ${fileMB} MB each and ${totalMB} MB total.`,
        `HeyGen 最多可用 ${HEYGEN_REFERENCE_IMAGE_LIMIT} 张图片、${HEYGEN_REFERENCE_VIDEO_LIMIT} 段视频和 ${HEYGEN_REFERENCE_AUDIO_LIMIT} 段音频。素材均为选填，提示词必填。图片每张不超过 ${fileMB} MB，合计不超过 ${totalMB} MB，视频和音频使用公开链接。`,
        `HeyGen 最多可用 ${HEYGEN_REFERENCE_IMAGE_LIMIT} 張圖片、${HEYGEN_REFERENCE_VIDEO_LIMIT} 段影片及 ${HEYGEN_REFERENCE_AUDIO_LIMIT} 段音訊。素材皆為選填，提示詞必填。圖片每張不超過 ${fileMB} MB，合計不超過 ${totalMB} MB，影片和音訊使用公開連結。`
      );
    }
    if (provider === SEEDANCE_FLASH_PROVIDER) {
      const videoRequired = seedanceTask === "editing" || seedanceTask === "extension";
      const limits = t(
        `Seedance 2.5 Flash accepts up to ${SEEDANCE_FLASH_IMAGE_LIMIT} images, ${SEEDANCE_FLASH_MEDIA_LIMIT} video links and ${SEEDANCE_FLASH_MEDIA_LIMIT} audio links. Type @ in the prompt to select a reference.`,
        `Seedance 2.5 Flash 最多可用 ${SEEDANCE_FLASH_IMAGE_LIMIT} 张图片、${SEEDANCE_FLASH_MEDIA_LIMIT} 段视频和 ${SEEDANCE_FLASH_MEDIA_LIMIT} 段音频。在提示词里输入 @ 可以选择素材，视频和音频使用公开链接。`,
        `Seedance 2.5 Flash 最多可用 ${SEEDANCE_FLASH_IMAGE_LIMIT} 張圖片、${SEEDANCE_FLASH_MEDIA_LIMIT} 段影片及 ${SEEDANCE_FLASH_MEDIA_LIMIT} 段音訊。在提示詞輸入 @ 可選擇素材，影片和音訊使用公開連結。`
      );
      const requirement = videoRequired
        ? t("The selected editing or extension task requires a reference video.", "当前是编辑或延长任务，参考视频必填。", "目前是編輯或延長任務，參考影片必填。")
        : t("Video is optional for reference generation. Editing or extending a video requires a reference video.", "参考生成可不填视频。编辑和延长任务需要参考视频。", "參考生成可不填影片。編輯和延長任務需要參考影片。");
      return `${limits}\n\n${requirement}`;
    }
  }
  if (workflow === "image-to-video") {
    return videoSupportsEndFrame(provider)
      ? t("Upload a start frame. You can add a second image as the end frame. Use Reference Video for multiple subject images.", "上传一张首帧图，第二张图可作为尾帧。要把多张人物、物体或场景图用作参考，请切换到「参考视频」。", "上傳一張首幀圖，第二張圖可作為尾幀。要使用多張人物、物件或場景圖作參考，請切換到「參考影片」。")
      : t("Upload one image as the starting frame. Use Reference Video for multiple subject images.", "当前模型需要上传一张首帧图。要使用多张主体图，请切换到「参考视频」。", "目前模型需要上傳一張首幀圖。要使用多張主體圖，請切換到「參考影片」。");
  }
  if (workflow === "image-to-image" && provider === SEEDREAM_55_PROVIDER) {
    return t(`Upload up to ${SEEDREAM_55_REFERENCE_LIMIT} reference images and describe what to change.`, `最多上传 ${SEEDREAM_55_REFERENCE_LIMIT} 张参考图，再说明要修改的内容。`, `最多上傳 ${SEEDREAM_55_REFERENCE_LIMIT} 張參考圖，再說明要修改的內容。`);
  }
  if (workflow === "enhance-cleanup" || workflow === "background-remove") {
    return t("Upload one image, then click Generate.", "上传一张要处理的图片，再点击生成。", "上傳一張要處理的圖片，再按生成。");
  }
  if (workflow === "text-to-video" || workflow === "text-to-image") {
    return t("This workflow starts with a prompt. Switch to an image or reference workflow to use a source image.", "当前工作流直接填写提示词。要用原图，请切换到图生图、图生视频或参考视频。", "目前工作流程直接填寫提示詞。要用原圖，請切換到圖生圖、圖生影片或參考影片。");
  }
  // Leave model-specific questions for which we have no exact rule to the advisor.
  return undefined;
}

export function directAssistantReply(request: AssistantRequest): AssistantReply | undefined {
  const t: Translate = (en, cn, tw) => request.locale === "zh-TW" ? tw : request.locale.startsWith("zh") ? cn : en;
  const context = request.context;
  const intent = assistantDirectIntent(request);
  switch (intent) {
    case "current-cost": {
      if (!context) return;
      const free = request.account?.h3DailyFreeAvailable && ["text-to-video", "image-to-video"].includes(context.workflow) &&
        isH3DailyFreeRequest({ ...context, mode: "video" });
      const credits = free ? 0 : assistantQuote(context);
      const model = PROVIDER_META[context.provider]?.label || context.provider;
      return {
        reply: t(
          `${model} at these settings is estimated at ${credits} credits. Confirm the final amount on Generate.`,
          `${model} 按当前参数预计消耗 ${credits} 积分，以生成按钮显示为准。`,
          `${model} 按目前設定預計消耗 ${credits} 點數，以「生成」按鈕顯示為準。`
        ),
        actions: []
      };
    }
    case "references": {
      const reply = context && referenceHelp(context, t);
      return reply ? { reply, actions: [] } : undefined;
    }
    case "login":
      return {
        reply: t(
          "Sign in with Google or an email link. If the email hasn’t arrived, check the address and spam folder, then use the latest link.",
          "可以用 Google 或邮箱链接登录。没收到邮件时，先检查邮箱地址和垃圾邮件文件夹，再使用最新的登录链接。",
          "可以用 Google 或電子郵件連結登入。若未收到郵件，請先檢查信箱地址和垃圾郵件資料夾，再使用最新的登入連結。"
        ),
        actions: [{ label: t("Sign in", "打开登录", "開啟登入"), description: "", href: "/auth" }]
      };
    case "projects":
      return {
        reply: t("Sign in with the account you used to generate, then open My projects to see your results.", "用生成时的账号登录，然后在「我的项目」查看作品。", "用生成時的帳號登入，再到「我的項目」查看作品。"),
        actions: [{ label: t("My projects", "我的项目", "我的項目"), description: "", href: "/studio?view=projects" }]
      };
    case "billing": {
      const balance = request.account?.creditBalance;
      const reply = balance === undefined
        ? t("Open Credits & billing to check your balance and available packs.", "在「积分与账单」中可以查看余额、充值记录和可购买的积分包。", "在「點數與帳單」中可查看餘額、儲值記錄和可購買的點數包。")
        : t(`Your balance is ${balance} credits. Open Credits & billing for details.`, `当前余额为 ${balance} 积分。详情可在「积分与账单」查看。`, `目前餘額為 ${balance} 點數。可在「點數與帳單」查看詳情。`);
      return { reply, actions: [{ label: t("Credits & billing", "积分与账单", "點數與帳單"), description: "", href: "/studio?view=billing" }] };
    }
    case "trial":
      return {
        reply: t("Sign in and open the studio to check your available trial credits or free allowance. The Generate button shows the estimate before you submit.", "登录后可以在工作台查看账号可用的试用积分或免费额度。提交前，生成按钮会显示预计消耗。", "登入後可在工作台查看帳號可用的試用點數或免費額度。送出前，「生成」按鈕會顯示預計消耗。"),
        actions: [{ label: t("Open studio", "打开工作台", "開啟工作台"), description: "", href: studioHome }]
      };
    case "pricing": {
      const examples = ["text-to-image", "text-to-video", "reference-to-video"].flatMap(workflow => {
        const options = assistantBudgetOptions({ ...request, context: undefined, messages: [{ role: "user", content: workflow }] });
        return options.slice(0, 1);
      });
      return {
        reply: t("Here are low-credit starting points by workflow. Select one to check the live estimate in the studio.", "这里是三种工作流的低积分入门选项。点击卡片后可以在工作台核对当前估价。", "這裡是三種工作流程的低點數入門選項。點選卡片後可在工作台核對目前估價。"),
        actions: examples.map(option => assistantCandidateAction(option, request, ""))
      };
    }
    case "budget": {
      const requirement = assistantRequirements(request);
      if (!requirement.explicit) return;
      const choices = assistantBudgetOptions(request).slice(0, 2);
      const [first] = choices;
      if (!first) {
        return {
          reply: t("No option in this workflow matches the requested references and settings. Try fewer references or check the workflow limits.", "当前没有同时满足这些素材和参数的选项。可以减少参考素材，或先查看工作流的上传限制。", "目前沒有同時符合這些素材和設定的選項。可減少參考素材，或先查看工作流程的上傳限制。"),
          actions: []
        };
      }
      const reply = first.affordable === false
        ? t(`The lowest estimate is ${first.credits} credits with ${first.label}, above your current balance.`, `当前最低估价是 ${first.label} 的 ${first.credits} 积分，超出你的余额。`, `目前最低估價是 ${first.label} 的 ${first.credits} 點數，超出你的餘額。`)
        : t(`Start with ${first.label}. It has the lowest estimated cost for this workflow and your references.`, `建议先用 ${first.label}。它符合当前工作流和素材需求，预计积分最低。`, `建議先用 ${first.label}。它符合目前工作流程和素材需求，預計點數最低。`);
      return {
        reply,
        actions: choices.map(option => assistantCandidateAction(option, request, ""))
      };
    }
    default:
      return undefined;
  }
}
