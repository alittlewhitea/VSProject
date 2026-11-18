import type { AssistantRequest, AssistantShortcut } from "./creation-assistant";

export function isAssistantShortcut(value: unknown): value is AssistantShortcut {
  return value === "current-cost" || value === "references" || value === "pricing" || value === "trial";
}

// Match explicit, short questions. Creative or combined requests use the LLM.
const currentCost = /^(?:(?:本次|这次|這次|当前|當前|现在|現在|按当前设置|按目前設定)\s*(?:生成|设置|設定|配置)?\s*)?(?:(?:会|會)?(?:消耗|扣|用|花|需要|要)?\s*多少(?:积分|積分|点数|點數)|(?:预计|預計)\s*(?:多少)?(?:积分|積分|点数|點數))$|^how many credits (?:will this use|does this cost|for (?:this|the current) (?:generation|settings))$/i;
const referenceUse = /^(?:参考素材应该怎么用|參考素材應該怎麼用|(?:参考|參考)?(?:素材|图|圖|图片|圖片|照片|视频|影片|音频|音訊)(?:要)?(?:怎么用|怎麼用|怎么上传|怎麼上傳|如何上传|如何上傳|必填吗|必填嗎|是必填的吗|是必填的嗎)|how do i (?:use|upload) references)$/i;
const referenceCount = /^(?:当前|當前|这个模型|這個模型)?\s*(?:最多)?(?:可以|能|支持)?(?:上传|上傳|传|傳|添加|用)?(?:多少|几|幾)(?:张|張|段|个|個)?(?:参考|參考)?(?:图片|圖片|图|圖|照片|视频|影片|音频|音訊|素材)$|^how many (?:reference )?(?:images|photos|videos|audio clips)(?: can i upload)?$/i;
const login = /^(?:怎么登录|如何登录|怎麼登入|如何登入|怎么登陆|在哪里登录|去哪登录|登录入口(?:在哪)?|登录邮件(?:一直)?收不到(?:怎么办)?|(?:一直)?收不到登录邮件(?:怎么办)?|登入郵件(?:一直)?收不到(?:怎麼辦)?|how (?:do|can) i (?:sign|log) in|where (?:do|can) i (?:sign|log) in|i (?:didn't|did not|can't|cannot) (?:get|receive) (?:the|my) (?:sign-in|login) email)$/i;
const projects = /^(?:(?:我)?(?:刚才|剛才|之前)?生成的(?:图片|圖片|视频|影片|作品|结果|結果)(?:在哪|在哪里|在哪裡)(?:看|查看)?|(?:在哪|在哪里|怎麼|怎么|如何)(?:看|查看)(?:我的)?(?:生成|历史|歷史)?(?:项目|項目|记录|紀錄|作品)|(?:历史记录|歷史紀錄|我的项目|我的項目)(?:在哪|在哪里|在哪裡)|where (?:are|can i (?:see|find)) my (?:projects|generations|results))$/i;
const billing = /^(?:(?:怎么|怎麼|如何)(?:充值|购买积分|購買點數|查看账单|查看帳單|查余额|查餘額)|(?:账单|帳單|积分余额|點數餘額)(?:在哪里|在哪裡|在哪|怎么看|怎麼看)|(?:我)?还剩多少(?:积分|積分|点数|點數)|how (?:do|can) i (?:buy credits|check my balance|view my (?:billing|balance)))$/i;
const trial = /^(?:(?:这|這)?(?:个|個)?平台)?(?:可以|能|有)?(?:免费|免費)(?:试用|試用)(?:吗|嗎)?$|^(?:can i try (?:it |this )?for free|is there a free trial)$/i;
const pricing = /^(?:比较模型和积分|比較模型和點數|compare models (?:&|and) credits)$/i;
const videoWorkflow = /^(?:(?:文|[图圖]|多[图圖])生(?:视频|影片)|参考视频|參考影片)/i;
const videoFromImages = /^(?:我想|我要|我有|想)?用?(?:多[张張]|(?:\d{1,2}|[两兩三四五六七八九十])[张張])(?:图|圖|图片|圖片|照片)(?:生(?:成)?|做|[转轉])(?:视频|影片)/i;
const budgetQuestion = /^[,、。]*(?:(?:选|選|用)?(?:哪个|哪個)(?:模型)?|推荐|推薦)?[,、。]*(?:最便宜|比较便宜|比較便宜|更便宜|便宜|最省积分|最省積分|尽量便宜|儘量便宜|适合试用|適合試用)?$/;
const budgetEnglish = /^(?:which (?:model|option) is (?:cheapest|cheaper) for |(?:what is |what's )?the cheapest (?:model for )?)?(?:(?:multi[- ]image|reference|image[- ]to[- ]video|text[- ]to[- ]video)(?: video)?|(?:making )?(?:a )?video (?:from|with) (?:multiple|several|\d+) (?:images|photos))(?:(?:,? (?:which model|cheapest|cheaper|lowest cost|on a budget)))?$/i;

export function assistantDirectIntent(request: Pick<AssistantRequest, "messages" | "context" | "shortcut">) {
  const question = request.messages.at(-1)?.content.normalize("NFKC").trim().replace(/[?？!！。.!]+$/, "").trim() || "";
  if (request.context && (request.shortcut === "current-cost" || currentCost.test(question))) return "current-cost";
  if (request.context && (request.shortcut === "references" || referenceUse.test(question) || referenceCount.test(question))) return "references";
  if (request.shortcut === "pricing" || pricing.test(question)) return "pricing";
  if (request.shortcut === "trial" || trial.test(question)) return "trial";
  if (login.test(question)) return "login";
  if (projects.test(question)) return "projects";
  if (billing.test(question)) return "billing";
  if (question.length <= 120) {
    const compact = question.replace(/\s+/g, "");
    const workflow = compact.match(videoWorkflow) || compact.match(videoFromImages);
    if (workflow && budgetQuestion.test(compact.slice(workflow[0].length)) || budgetEnglish.test(question)) return "budget";
  }
  return undefined;
}
