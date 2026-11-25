import { WORKFLOW_META, PROVIDER_META, type StudioWorkflow } from "../features/studio/studio-workspace-config";
import { VIDEO_MODEL_CONFIGS } from "../features/studio/video-models";
import { assistantKnowledgeScope, type AssistantKnowledgeScope } from "./assistant-knowledge-scope";
import { assistantRequirements, assistantBudgetOptions, type AssistantCandidate } from "./creation-assistant-recommendations";
import { assistantCanApply, assistantQuote } from "./assistant-generation-context";
import { HEYGEN_REFERENCE_IMAGE_LIMIT, HEYGEN_REFERENCE_VIDEO_LIMIT, HEYGEN_REFERENCE_AUDIO_LIMIT } from "./heygen-reference-video";
import { SEEDANCE_FLASH_PROVIDER, SEEDANCE_FLASH_IMAGE_LIMIT, SEEDANCE_FLASH_MEDIA_LIMIT } from "./seedance-flash";
import { SEEDREAM_55_PROVIDER, SEEDREAM_55_REFERENCE_LIMIT } from "./seedream-55";
import { videoSupportsEndFrame } from "./video-keyframes";
import type { AssistantRequest } from "./creation-assistant";

type ModelFacts = { id: string; name: string; for: string; workflows: string[]; durations?: readonly string[]; resolutions?: readonly string[]; ratios?: unknown; nativeAudioControl?: boolean };
type MediaRules = {
  heygenReference?: { maxImages:number; maxVideos:number; maxAudio:number; requiresImageOrVideo:true; audioOptional:true; promptRequired:true; imageUploadMB:number; combinedImageUploadMB:number };
  seedanceReference?: { maxImages:number; maxVideos:number; maxAudio:number; referenceTaskVideoOptional:true; editingAndExtensionNeedVideo:true; promptMentions:string };
  seedreamEdit?: { maxImages:number };
  currentImages?: { maxImages:number; meaning:string };
  general?: string;
};
export type AssistantRetrievedFacts = {
  knowledgeScope: { topics: AssistantKnowledgeScope["topics"]; partialCatalog: boolean };
  workflows?: {id:string; name:string; models?:string[]}[];
  models?: ModelFacts[];
  recommendationIntent?: ReturnType<typeof assistantRequirements>;
  budgetOptions?: AssistantCandidate[];
  verifiedBalance?: number; verifiedH3DailyFreeAvailable?: boolean;
  mediaRules?: MediaRules;
  accountRules?: string;
  accountHelp?: { login?: string; billing?: string; projects?: string };
  unavailableModels?: string[];
  currentWorkspace?: {workflow:string; provider:string; modelLabel?:string; canApplyPrompt:boolean; prompt?:string;
    duration?:string; resolution?:string; ratio?:string; imageSize?:string; quality?:string; numImages?:number;
    imageCount?:number; videoCount?:number; audioCount?:number; task?:string; inspectedImageCount:number; estimatedCredits?:number; supportsEndFrame?:boolean};
};
function mentionedModels(request: AssistantRequest, scope: AssistantKnowledgeScope) {
  const latest = request.messages.at(-1)!.content;
  const text = (scope.inherited ? request.messages.slice(-5).map(turn=>turn.content).join(" ") : latest).toLowerCase().replace(/[\s_.-]/g, "");
  return Object.entries(PROVIDER_META).filter(([id,meta]) => [id,meta.label,meta.shortLabel,meta.label.replace(/\s*Flash$/i, "")].some(alias=>alias.length>3 && text.includes(alias.toLowerCase().replace(/[\s_.-]/g,"")))).map(([id])=>id);
}
export function buildAssistantFacts(request: AssistantRequest, scope = assistantKnowledgeScope(request)): AssistantRetrievedFacts {
  const facts: AssistantRetrievedFacts = { knowledgeScope: { topics:scope.topics, partialCatalog:!scope.allModels } };
  const context = request.context;
  const topics = new Set(scope.topics);
  if (topics.has("login") || topics.has("billing") || topics.has("projects")) {
    facts.accountHelp = {};
    if (topics.has("login")) facts.accountHelp.login = "Sign in using Google or an email sign-in link. Check the address and spam folder, use the latest link, and wait before requesting another if rate limited. Never ask for a password, sign-in link or verification code. Login is opened in a dialog from the site's sign-in button.";
    if (topics.has("billing")) facts.accountHelp.billing = "Open Credits & billing to check purchases and current payment options. For a completed payment without credits, keep the payment reference and check the billing record; do not invent payment status or suggest repeatedly paying. No payment/refund can be performed by chat.";
    if (topics.has("projects")) facts.accountHelp.projects = "Sign in to the same account and open My projects to view available generation history and results. The assistant cannot read private task records or restore deleted history.";
  }
  if (scope.needsBalance) {
    facts.accountRules = "Sign in to generate. Only server-verified balance/free quota may be used; unknown trial rights are not guaranteed. Final credits and eligibility are checked on Generate.";
    facts.verifiedBalance = request.account?.creditBalance;
    facts.verifiedH3DailyFreeAvailable = request.account?.h3DailyFreeAvailable;
  }
  if (!scope.usesWorkspace) {
    if (topics.has("overview")) facts.workflows = Object.entries(WORKFLOW_META).map(([id,meta])=>({id,name:meta.label}));
    return facts;
  }

  const intent = assistantRequirements(request);
  const mentioned = mentionedModels(request,scope);
  const broad = scope.allModels && !scope.workflows.length;
  const workflowIds = broad ? Object.keys(WORKFLOW_META) as StudioWorkflow[] : intent.explicit && intent.workflow && !scope.allModels ? [intent.workflow] : scope.workflows;
  const relevant = new Set(workflowIds);
  // A named model can be discussed without assuming the currently open editor
  // is the requested workflow. The matching scans local data, not another LLM.
  if (!relevant.size && mentioned.length) for (const [workflow,meta] of Object.entries(WORKFLOW_META)) if (meta.providers.some(id=>mentioned.includes(id))) relevant.add(workflow as StudioWorkflow);
  const options = assistantBudgetOptions(request).filter(option=>!relevant.size || relevant.has(option.workflow));
  const selection = new Set<string>(mentioned);
  const currentRelevant = Boolean(context && (!relevant.size || relevant.has(context.workflow as StudioWorkflow)));
  if (scope.needsRecommendations || !mentioned.length && !currentRelevant) for (const option of options) selection.add(option.provider);
  if (currentRelevant && context) selection.add(context.provider);
  if (scope.allModels) for (const workflow of relevant) for (const id of WORKFLOW_META[workflow].providers) selection.add(id);
  if (!selection.size && !relevant.size) {
    // An open-ended "choose a model" question gets a few cheap starting points,
    // not the whole catalog. The advisor can then ask which task the user wants.
    for (const option of options) selection.add(option.provider);
  }
  if (scope.allModels && broad) for (const meta of Object.values(WORKFLOW_META)) for (const id of meta.providers) selection.add(id);
  const allowedIds = new Set(Object.values(WORKFLOW_META).flatMap(meta=>meta.providers));
  const modelIds = [...selection].filter(id=>allowedIds.has(id));
  facts.models = modelIds.map(id=>{
    const meta=PROVIDER_META[id], config=VIDEO_MODEL_CONFIGS[id];
    const detail = scope.detailedSpecs || scope.usesPrompt && id===context?.provider || mentioned.includes(id);
    return {id,name:meta?.label || id,for:meta?.bestFor || "",workflows:Object.entries(WORKFLOW_META).filter(([,workflow])=>workflow.providers.includes(id)).map(([workflow])=>workflow),
      ...(detail && config ? {durations:config.durations,resolutions:config.resolutions,ratios:config.workflows,nativeAudioControl:Boolean(config.showAudioControl)} : {})};
  });
  facts.workflows = [...relevant].map(id=>({id,name:WORKFLOW_META[id].label,models:WORKFLOW_META[id].providers.filter(provider=>selection.has(provider))}));
  if (!broad) facts.recommendationIntent = intent;
  if (scope.needsRecommendations) facts.budgetOptions=options;
  if (/veo\s*3[. -]?1/i.test(request.messages.at(-1)!.content)) facts.unavailableModels=["Veo 3.1"];

  if (topics.has("media") || scope.usesPrompt || relevant.has("reference-to-video")) {
    const rules: MediaRules = {};
    const reference = relevant.has("reference-to-video") || topics.has("media") && /多[图圖]|几[张張]|多少[张張]|max.{0,8}images?/i.test(request.messages.at(-1)!.content);
    if (reference && selection.has("heygen-video")) rules.heygenReference={maxImages:HEYGEN_REFERENCE_IMAGE_LIMIT,maxVideos:HEYGEN_REFERENCE_VIDEO_LIMIT,maxAudio:HEYGEN_REFERENCE_AUDIO_LIMIT,requiresImageOrVideo:true,audioOptional:true,promptRequired:true,imageUploadMB:30,combinedImageUploadMB:40};
    if (reference && selection.has(SEEDANCE_FLASH_PROVIDER)) rules.seedanceReference={maxImages:SEEDANCE_FLASH_IMAGE_LIMIT,maxVideos:SEEDANCE_FLASH_MEDIA_LIMIT,maxAudio:SEEDANCE_FLASH_MEDIA_LIMIT,referenceTaskVideoOptional:true,editingAndExtensionNeedVideo:true,promptMentions:"Type @ to select uploaded entities. Images are references, not start/end frames."};
    if (relevant.has("image-to-image") && selection.has(SEEDREAM_55_PROVIDER)) rules.seedreamEdit={maxImages:SEEDREAM_55_REFERENCE_LIMIT};
    if (context && relevant.has("image-to-video")) rules.currentImages={maxImages:videoSupportsEndFrame(context.provider)?2:1,meaning:videoSupportsEndFrame(context.provider)?"First image is the start frame; optional second image is the end frame, not another subject reference.":"One start image. Use reference-to-video to combine multiple subject references."};
    if (topics.has("media") || relevant.has("reference-to-video")) rules.general="Pasted video/audio URLs must be publicly accessible. Limits shown in the selected workflow apply. Editing/extension require a reference video. Image enhancement/background removal need an image, not a written prompt.";
    if (Object.keys(rules).length) facts.mediaRules=rules;
  }
  if (context && !broad) facts.currentWorkspace={workflow:context.workflow,provider:context.provider,modelLabel:currentRelevant?PROVIDER_META[context.provider]?.label:undefined,
    canApplyPrompt:assistantCanApply(context),prompt:scope.usesPrompt?context.prompt:undefined,
    ...(currentRelevant ? {duration:context.duration,resolution:context.resolution,ratio:context.ratio,imageSize:context.imageSize,quality:context.quality,numImages:context.numImages,
      estimatedCredits:topics.has("pricing")||scope.needsBalance?assistantQuote(context):undefined} : {}),
    imageCount:context.imageCount,videoCount:context.videoCount,audioCount:context.audioCount,task:relevant.has("reference-to-video")?context.seedanceTask:undefined,
    inspectedImageCount:scope.needsImages?context.imageUrls?.length||0:0,supportsEndFrame:relevant.has("image-to-video")?videoSupportsEndFrame(context.provider):undefined};
  return facts;
}
