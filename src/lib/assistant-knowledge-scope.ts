import type { AssistantRequest, AssistantTurn } from "./creation-assistant";
import type { StudioWorkflow } from "../features/studio/studio-workspace-config";

export type AssistantTopic = "login" | "billing" | "projects" | "models" | "pricing" | "media" | "creation" | "troubleshooting" | "overview";
export type AssistantKnowledgeScope = {
  topics: AssistantTopic[]; workflows: StudioWorkflow[];
  allModels: boolean; detailedSpecs: boolean; usesWorkspace: boolean; usesPrompt: boolean;
  needsImages: boolean; needsBalance: boolean; needsRecommendations: boolean; inherited: boolean;
};
const workflowWords: [StudioWorkflow, RegExp][] = [
  ["reference-to-video", /多[图圖]|多[张張].{0,8}(?:图|圖|照片)|参考视频|參考影片|reference[- ]to[- ]video|multi[- ]?image.{0,12}video|multiple.{0,8}(?:images?|photos?)/i],
  ["image-to-video", /[图圖]生(?:视频|影片)|首尾[帧幀]|(?:图片|圖片|照片).{0,10}(?:动起来|動起來)|image[- ]to[- ]video|start.{0,10}end.{0,5}frames?/i],
  ["text-to-video", /文生(?:视频|影片)|text[- ]to[- ]video/i],
  ["image-to-image", /[图圖]生[图圖]|(?:编辑|編輯|修改).{0,6}(?:图片|圖片|照片)|image[- ]to[- ]image|image edit/i],
  ["text-to-image", /文生[图圖]|(?:生成|画|畫).{0,6}(?:图片|圖片|一[张張][图圖])|text[- ]to[- ]image/i],
  ["enhance-cleanup", /画质|畫質|超分|放大图片|upscale|enhance.{0,8}image/i],
  ["background-remove", /去(?:除|掉)背景|移除背景|抠图|摳圖|remove.{0,8}background/i],
  ["avatar-video", /数字人|數字人|口播|avatar|talking (?:photo|head)/i],
  ["text-to-audio", /配音|语音|語音|朗读|朗讀|text[- ]to[- ](?:audio|speech)|voiceover|tts\b/i],
  ["text-to-music", /音乐|音樂|作曲|歌词|歌詞|music|lyrics/i]
];
function signals(text: string) {
  const topics: AssistantTopic[] = [];
  const has = (pattern: RegExp) => pattern.test(text);
  const login = has(/登录|登陆|登入|注册|註冊|验证码|驗證碼|收不到.{0,5}(?:邮件|郵件)|邮箱.{0,5}(?:验证|登录)|sign[ -]?(?:in|up)|log[ -]?in|register|authenticat|verification|password|connexion|iniciar sesi[oó]n|ログイン|로그인/i);
  const billing = has(/充值|账单|帳單|余额|餘額|支付|付款|扣款|退款|订阅|訂閱|没到账|未到账|billing|payment|balance|refund|subscription|purchase.{0,8}credits?|checkout/i);
  const projects = has(/我的.{0,4}(?:项目|項目|作品|记录|紀錄)|历史记录|歷史紀錄|任务记录|generation history|my projects|past generations|download.{0,8}(?:result|video)|下载.{0,5}(?:作品|视频)/i);
  const models = has(/模型|选哪个|選哪個|用哪个|用哪個|推荐|推薦|model|which.{0,15}(?:choose|use)|recommend|meilleur mod[eè]le|seedance|seedream|heygen|kling|grok|flux|gemini|nano.?banana|gpt.?image|mini.?max/i);
  const pricing = has(/价格|價格|费用|費用|报价|報價|多少积分|多少積分|消耗.{0,5}(?:积分|積分)|price|pricing|cost|how (?:many|much).{0,12}credits?/i);
  const budget = has(/便宜|低[积積]分|[积積]分.{0,5}(?:低|少)|省.{0,3}(?:积分|積分|钱|錢)|积分(?:不够|不足)|積分(?:不夠|不足)|试用|試用|免费|免費|cheap|budget|afford|free|trial|low[- ]cost|lowest.{0,8}credits?/i);
  const media = has(/参考|參考|素材|上传|上傳|首尾[帧幀]|几[张張]|多少[张張]|reference|upload|start frame|end frame/i);
  let creation = has(/提示[词詞]|脚本|腳本|文案|帮我写|幫我寫|改成|改为|改為|生成|创作|創作|短片|广告|廣告|做.{0,8}(?:视频|影片)|(?:描述|分析|看看).{0,10}(?:图片|圖片|照片)|(?:这|這)(?:两|兩|几|幾|一|2|3)?[张張幅].{0,4}(?:图|圖|照片).{0,10}(?:什么|什麼|颜色|顏色|主体|主體|内容|內容|风格|風格)|看[图圖]|prompt|script|storyboard|create|generate|animate|rewrite|commercial|product clip|what.{0,15}(?:this|the).{0,6}(?:image|picture|photo)|describe.{0,10}(?:image|photo|picture)|make.{0,8}video/i);
  if ((login || billing) && !has(/提示[词詞]|脚本|腳本|文案|视频|影片|图片|圖片|照片|prompt|script|video|image|photo|music|语音|語音|音乐|音樂/i)) creation=false;
  const troubleshooting = has(/报错|報錯|错误|錯誤|失败|失敗|不行|卡住|error|fail|stuck|not working/i);
  const overview = has(/能做什么|能做什麼|有哪些功能|怎么开始|怎麼開始|what can|features|getting started/i);
  const workflows = workflowWords.filter(([,pattern])=>has(pattern)).map(([id])=>id);
  // Background music/voiceover constraints in a video prompt do not switch tools.
  const video = has(/视频|影片|video|animate/i) || workflows.some(workflow=>workflow.endsWith("video"));
  const selected = video ? workflows.filter(workflow=>workflow.endsWith("video")) : workflows;
  if (login) topics.push("login"); if (billing) topics.push("billing"); if (projects) topics.push("projects");
  if (models) topics.push("models"); if (pricing) topics.push("pricing"); if (media) topics.push("media");
  if (creation || selected.length) topics.push("creation"); if (troubleshooting) topics.push("troubleshooting"); if (overview) topics.push("overview");
  return { topics, workflows: selected, budget, video, creative:creation,
    allModels: has(/(?:所有|全部|全站|all|every).{0,12}(?:模型|model)|(?:模型|models?).{0,8}(?:列表|清单|清單|list)/i),
    detailedSpecs: has(/时长|時長|分辨率|清晰度|参数|參數|规格|規格|duration|resolution|specification|specs|\b\d{3,4}p\b/i) };
}
export function assistantKnowledgeScope(request: AssistantRequest): AssistantKnowledgeScope {
  const users = request.messages.filter(turn=>turn.role==="user");
  const latest = users.at(-1)?.content || "";
  const current = signals(latest);
  const directCreation = current.creative;
  const factsQuestion = current.budget || current.topics.some(topic=>["models","pricing","media"].includes(topic));
  let inherited = false;
  // Resolve short follow-ups against the last substantive user question, rather
  // than blindly taking an unrelated editor that happens to remain open.
  const substantive = current.workflows.length || current.topics.some(topic=>["login","billing","projects","models","creation","overview"].includes(topic));
  if (!substantive && !/^(?:你好|您好|嗨|hello|hi|hey)[!！。.\s]*$/i.test(latest)) {
    const prior = users.slice(0,-1).reverse().map(turn=>signals(turn.content)).find(value=>value.workflows.length || value.topics.some(topic=>["login","billing","projects","models","creation"].includes(topic)));
    if (prior) { current.topics = [...new Set([...current.topics,...prior.topics])]; current.workflows=prior.workflows; current.video ||= prior.video; inherited=true; }
  }
  const accountOnly = current.topics.some(topic=>["login","billing","projects"].includes(topic)) && !current.workflows.length && !current.topics.some(topic=>["models","creation","media"].includes(topic));
  if (accountOnly) current.topics=current.topics.filter(topic=>!["pricing","troubleshooting"].includes(topic));
  const generation = !accountOnly && (current.topics.some(topic=>["models","creation","media","pricing"].includes(topic)) || current.budget || current.topics.includes("troubleshooting") && Boolean(request.context));
  const workflows = generation ? current.workflows.length ? current.workflows : current.allModels ? [] : request.context ? [request.context.workflow as StudioWorkflow] : current.video ? ["text-to-video" as const] : [] : [];
  const usesPrompt = generation && (directCreation || current.topics.includes("troubleshooting") || !factsQuestion && current.topics.includes("creation"));
  const needsImages = usesPrompt && !current.topics.includes("troubleshooting") && !/^(?:如何|怎么|怎麼|how).{0,10}(?:上传|上傳|upload)/i.test(latest);
  const needsRecommendations = generation && (current.budget || current.topics.includes("pricing") || current.topics.includes("models") && (!current.detailedSpecs && !current.allModels || /推荐|推薦|选哪个|選哪個|用哪个|用哪個|便宜|比较|比較|对比|對比|recommend|choose|compare|cheaper/i.test(latest)));
  return { topics: current.topics.length ? current.topics : ["overview"], workflows: [...new Set(workflows)], allModels: current.allModels,
    detailedSpecs: current.detailedSpecs, usesWorkspace: generation, usesPrompt, needsImages,
    needsBalance: needsRecommendations || current.topics.includes("billing"), needsRecommendations, inherited };
}
export function assistantScopedConversation(request: AssistantRequest, scope = assistantKnowledgeScope(request)): AssistantTurn[] {
  const accountTopics: AssistantTopic[] = ["login","billing","projects"];
  const accountOnly = !scope.usesWorkspace && scope.topics.some(topic=>accountTopics.includes(topic));
  if (!accountOnly) return request.messages;
  const result: AssistantTurn[] = [];
  let relevant = false;
  for (const turn of request.messages) {
    if (turn.role === "user") {
      const topic = signals(turn.content).topics;
      if (topic.some(value=>accountTopics.includes(value))) relevant=topic.some(value=>scope.topics.includes(value));
      else if (topic.some(value=>["creation","models","media","overview"].includes(value))) relevant=false;
      if (turn === request.messages.at(-1)) relevant=true;
    }
    if (relevant) result.push(turn);
  }
  return result.length ? result : request.messages.slice(-1);
}
