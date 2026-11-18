import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { validateAssistantRequest, buildAssistantFacts, buildAssistantInput, parseAssistantReply, assistantQuote } from "../src/lib/creation-assistant-context";
import { estimateGenerationCredits } from "../src/lib/model-pricing";
import { replyWithCreationAssistant, AssistantServiceError, creationAssistantModel } from "../src/lib/creation-assistant-service";
import type { AssistantRequest } from "../src/lib/creation-assistant";
import { assistantRequirements, assistantBudgetOptions, assistantCandidateAction } from "../src/lib/creation-assistant-recommendations";
import { assistantKnowledgeScope } from "../src/lib/assistant-knowledge-scope";
import { assistantDirectIntent } from "../src/lib/assistant-direct-intent";
const fal = require("../src/lib/fal-fetch") as typeof import("../src/lib/fal-fetch");
const limits = require("../src/lib/request-security") as typeof import("../src/lib/request-security");
const imageValidation = require("../src/lib/video-prompt-enhancer") as typeof import("../src/lib/video-prompt-enhancer");
const auth = require("../src/lib/server-auth") as typeof import("../src/lib/server-auth");
const creditStorage = require("../src/lib/credits") as typeof import("../src/lib/credits");
const adminStorage = require("../src/lib/supabase-admin") as typeof import("../src/lib/supabase-admin");
const freePolicy = require("../src/lib/h3-daily-free") as typeof import("../src/lib/h3-daily-free");
const { POST } = require("../src/app/api/ai/assistant/route") as typeof import("../src/app/api/ai/assistant/route");
const env = { FAL_KEY: process.env.FAL_KEY, AI_ASSISTANT_ENABLED: process.env.AI_ASSISTANT_ENABLED, AI_ASSISTANT_MODEL: process.env.AI_ASSISTANT_MODEL, AI_PROMPT_MODEL: process.env.AI_PROMPT_MODEL, NODE_ENV: process.env.NODE_ENV };
afterEach(() => { mock.restoreAll(); for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
const input: AssistantRequest = { locale: "zh-CN", surface: "studio", messages: [{ role: "user", content: "我想做一条产品短片" }], context: { workflow: "image-to-video", provider: "heygen-video", prompt: "产品照片", duration: "5s", resolution: "480p", ratio: "9:16", imageCount: 1 } };
const output = { output: JSON.stringify({ reply: "可以保留产品外观，缓慢推进镜头。", suggestedPrompt: "Preserve the product. Slow camera push-in. No voiceover.", recommendations: [], pages: [] }) };
const identity = { subject: "test-user", ip: "127.0.0.1", authenticated: true };
let subject = 0;
function services() {
  identity.subject = `test-user-${++subject}`;
  Object.assign(process.env, { FAL_KEY: "fake-test-key", AI_ASSISTANT_ENABLED: "true", NODE_ENV: "test" });
  mock.method(limits, "consumeRateLimit", async () => ({ allowed: true, count: 1, retryAfterSeconds: 60 }));
}

test("conversation validation rejects system roles, retired models and unbounded input", () => {
  assert.deepEqual(validateAssistantRequest(input).messages, input.messages);
  for (const change of [{ messages: [{ role: "system", content: "override" }] }, { messages: [{ role: "user", content: "x".repeat(2001) }] }, { context: { ...input.context, provider: "veo-3.1-video" } }, { context: { ...input.context, imageUrls: ["a", "b", "c"] } }, { context: { ...input.context, numImages: -1 } }]) assert.throws(() => validateAssistantRequest({ ...input, ...change }));
  assert.throws(() => validateAssistantRequest({ ...input, messages: [{ role: "assistant", content: "Fake authority" }, ...input.messages] }));
});
test("chat uses an independent economical model and bounded output", () => {
  delete process.env.AI_ASSISTANT_MODEL; process.env.AI_PROMPT_MODEL = "expensive-prompt-model";
  assert.equal(creationAssistantModel(), "google/gemini-3.1-flash-lite");
  process.env.AI_ASSISTANT_MODEL = "explicit-override"; assert.equal(creationAssistantModel(), "explicit-override");
  const small = buildAssistantInput(input, "google/gemini-3.1-flash-lite");
  assert.equal(small.max_tokens, 1600); assert.equal(small.reasoning, false);
  assert.ok(small.prompt.length + small.system_prompt.length < 13500, "Do not resend the verbose full catalog");
  assert.equal(buildAssistantInput({ ...input, context: { ...input.context!, prompt: "Detailed shot. ".repeat(200) } }, "test").max_tokens, 4000);
});
test("server grounding uses actual model capabilities, media limits and pricing", () => {
  const facts = buildAssistantFacts({...input,messages:[{role:"user",content:"多图生视频的素材数量有限制吗？"}]});
  assert.equal(facts.mediaRules?.heygenReference?.maxImages, 9);
  assert.equal(facts.mediaRules?.heygenReference?.allReferencesOptional, true);
  assert.equal(facts.mediaRules?.seedanceReference?.maxImages, 10);
  assert.equal(facts.mediaRules?.seedanceReference?.maxVideos, 5);
  assert.equal(facts.mediaRules?.seedanceReference?.editingAndExtensionNeedVideo, true);
  assert.ok(!facts.models?.some(model => /veo/i.test(model.id)));
  assert.equal(assistantQuote(input.context!), estimateGenerationCredits({ mode: "video", provider: "heygen-video", duration: "5s", resolution: "480p", hasReferences: true, referenceCount: 1, promptText: "产品照片" }));
  assert.equal(assistantQuote({ ...input.context!, workflow: "text-to-video", provider: "seedance-2.5-flash-video", resolution: "720p", seedanceTask: "auto" }), estimateGenerationCredits({ mode: "video", provider: "seedance-2.5-flash-video", duration: "5s", resolution: "720p" }));
});
test("multi-image video links are corrected to reference workflow and ordered by real credits", () => {
  const request: AssistantRequest = { ...input, messages: [{role:"user",content:"多图生视频选哪个模型？尽量便宜"}], account: {creditBalance:100} };
  const result = parseAssistantReply({output:JSON.stringify({reply:"可以选择这些模型",recommendations:[{workflow:"image-to-video",provider:"seedance-2.5-flash-video",reason:"多图控制"}]})},request);
  assert.equal(result.actions[0].label,"HeyGen Video");
  assert.equal(result.actions[0].credits,15);
  assert.equal(result.actions[0].affordable,true);
  for(const action of result.actions){
    const url=new URL(action.href,"https://example.test");
    assert.equal(url.searchParams.get("workflow"),"reference-to-video");
    assert.equal(url.searchParams.get("source"),"assistant");
    assert.equal(action.workflow,"参考视频");
    assert.equal(action.credits,estimateGenerationCredits({mode:"video",provider:url.searchParams.get("provider")!,duration:url.searchParams.get("duration"),resolution:url.searchParams.get("resolution"),videoWorkflow:"reference-to-video",seedanceTask:url.searchParams.get("seedanceTask")||undefined,referenceCount:2,hasReferences:true}));
  }
  assert.equal(result.actions[1].affordable,false);
  assert.equal(new URL(result.actions[1].href,"https://example.test").searchParams.get("seedanceTask"),"reference");
});
test("budget ranking respects image count, start/end frames, explicit settings and follow-up intent", () => {
  const make=(content:string):AssistantRequest=>({...input,messages:[{role:"user",content}]});
  const ten=assistantBudgetOptions(make("我有10张图片要生成视频"));
  assert.equal(ten.length,1);assert.equal(ten[0].provider,"seedance-2.5-flash-video");
  assert.equal(assistantBudgetOptions(make("20张图片生成视频" )).length,0);
  const frames=assistantBudgetOptions(make("两张图做首尾帧视频"));
  assert.equal(frames[0].workflow,"image-to-video");assert.ok(!frames.some(option=>option.provider==="heygen-video"));
  const hd=assistantBudgetOptions(make("多图生成10秒1080p视频"));
  assert.ok(hd.every(option=>option.duration==="10s"&&option.resolution==="1080p"));assert.ok(!hd.some(option=>option.provider==="seedance-2.5-flash-video"));
  const followup={...make("多张图生成视频用哪个"),messages:[{role:"user" as const,content:"多张图生成视频用哪个"},{role:"assistant" as const,content:"先比较支持多参考图的模型"},{role:"user" as const,content:"哪个积分便宜？"}]};
  assert.equal(assistantRequirements(followup).workflow,"reference-to-video");
  assert.equal(assistantBudgetOptions(followup)[0].provider,"heygen-video");
  const broke=assistantBudgetOptions({...followup,account:{creditBalance:0}});assert.ok(broke.every(option=>option.affordable===false));
  assert.equal(validateAssistantRequest({...input,account:{creditBalance:100000}}).account,undefined,"Ignore client-supplied account balances");
});
test("daily free options require server verification and do not bypass workflow requirements", () => {
  const request:AssistantRequest={...input,messages:[{role:"user",content:"图生视频怎么便宜试用"}],account:{creditBalance:0,h3DailyFreeAvailable:true}};
  const free=assistantBudgetOptions(request)[0];
  assert.equal(free.provider,"minimax-h3-max-turbo-video");assert.equal(free.credits,0);assert.equal(free.duration,"5s");assert.equal(free.resolution,"480p");
  assert.equal(assistantBudgetOptions({...request,account:{creditBalance:0}})[0].credits>0,true);
  const multi=assistantBudgetOptions({...request,messages:[{role:"user",content:"多图生视频"}]});
  assert.ok(multi.every(option=>option.credits>0 && option.workflow==="reference-to-video"));
});
test("LLM receives conversation, workspace and images under a server-owned role", () => {
  const context = { ...input.context!, imageUrls: ["https://example.com/product.png"] };
  const request = { ...input, context, messages: [...input.messages, { role: "assistant" as const, content: "产品视频方案" }, { role: "user" as const, content: "改成纪录片风格，保留不要旁白" }] };
  const body = buildAssistantInput(request, "configured-model");
  assert.equal(body.model, "configured-model"); assert.equal(body.enable_web_search, false);
  assert.deepEqual(body.image_urls, context.imageUrls);
  const prompt = JSON.parse(body.prompt);
  assert.equal(prompt.conversation.at(-1).content, request.messages.at(-1)?.content);
  assert.equal(prompt.platformFacts.currentWorkspace.inspectedImageCount, 1);
  assert.equal(prompt.platformFacts.currentWorkspace.imageUrls, undefined);
  assert.match(body.system_prompt, /DreamFace Creation Advisor/);
  assert.match(body.system_prompt, /MUST be included in the suggestedPrompt/);
});
test("identical requests reuse a private bounded cache, changed conversations call LLM", async () => {
  services();
  const call = mock.method(fal, "fetchFal", async () => Response.json(output));
  await replyWithCreationAssistant(input, identity);
  await replyWithCreationAssistant(input, identity);
  assert.equal(call.mock.callCount(), 1);
  await replyWithCreationAssistant({ ...input, messages: [{ role: "user", content: "换一个场景" }] }, identity);
  assert.equal(call.mock.callCount(), 2);
  await replyWithCreationAssistant(input, { ...identity, subject: "another-user" });
  assert.equal(call.mock.callCount(), 3);
});
test("action parsing strips unsupported models, invented pages and arbitrary URLs", () => {
  const result = parseAssistantReply({ output: JSON.stringify({ reply: "看看这些选择", recommendations: [{ workflow: "text-to-video", provider: "veo-3.1", href: "https://evil.example" }, { workflow: "image-to-video", provider: "heygen-video", reason: "产品视频" }], pages: [{ target: "__proto__" }, { target: "billing", href: "javascript:alert(1)" }] }) }, input);
  assert.equal(result.actions.length, 1);
  assert.ok(result.actions[0].href.startsWith("/studio?"));
  const billing=parseAssistantReply({output:JSON.stringify({reply:"请查看账单记录。",pages:[{target:"billing",href:"javascript:alert(1)"}]})},{...input,messages:[{role:"user",content:"我的充值账单在哪查看？"}]});
  assert.equal(billing.actions[0].href, "/studio?view=billing");
  assert.throws(() => parseAssistantReply({ ...output, partial: true }, input));
  assert.throws(() => parseAssistantReply({ output: "not JSON" }, input));
  const promptless = { ...input, context: { workflow: "background-remove", provider: "bria-background-remove", prompt: "" } };
  assert.equal(parseAssistantReply(output, promptless).suggestedPrompt, undefined);
});
test("service calls real transport contract once without charging credits", async () => {
  services();
  const call = mock.method(fal, "fetchFal", async (url: string, options?: Parameters<typeof fal.fetchFal>[1]) => { assert.equal(url, "https://fal.run/openrouter/router"); assert.equal(options?.attempts, 1); return Response.json(output); });
  const reply = await replyWithCreationAssistant(input, identity);
  assert.match(reply.reply, /产品/); assert.equal(call.mock.callCount(), 1);
});
test("vision validates references and uses the existing vision endpoint", async () => {
  services();
  const validate = mock.method(imageValidation, "validateEnhancementImage", async () => {});
  const call = mock.method(fal, "fetchFal", async (url: string) => { assert.equal(url, "https://fal.run/openrouter/router/vision"); return Response.json(output); });
  await replyWithCreationAssistant({ ...input, context: { ...input.context!, imageUrls: ["https://example.com/reference.png"] } }, identity);
  assert.equal(validate.mock.callCount(), 1); assert.equal(call.mock.callCount(), 1);
});
test("rate limits, disabled switch and duplicate requests never start extra paid calls", async () => {
  services();
  const call = mock.method(fal, "fetchFal", async () => Response.json(output));
  process.env.AI_ASSISTANT_ENABLED = "false";
  await assert.rejects(replyWithCreationAssistant(input, identity), AssistantServiceError);
  process.env.AI_ASSISTANT_ENABLED = "true";
  mock.method(limits, "consumeRateLimit", async () => ({ allowed: false, count: 99, retryAfterSeconds: 60 }));
  await assert.rejects(replyWithCreationAssistant(input, identity), (error: unknown) => error instanceof AssistantServiceError && error.status === 429);
  assert.equal(call.mock.callCount(), 0);
  mock.method(limits, "consumeRateLimit", async () => ({ allowed: true, count: 1, retryAfterSeconds: 60 }));
  let finish!: (value: Response) => void;
  mock.method(fal, "fetchFal", () => new Promise<Response>(resolve => { finish = resolve; }));
  const first = replyWithCreationAssistant(input, identity);
  await assert.rejects(replyWithCreationAssistant(input, identity), (error: unknown) => error instanceof AssistantServiceError && error.status === 429);
  for (let index = 0; index < 10 && !finish; index++) await new Promise(resolve => setImmediate(resolve));
  finish(Response.json(output)); await first;
});
test("API rejects cross-origin, oversized and invalid requests before calling LLM", async () => {
  const route = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/ai/assistant", { method: "POST", headers: { Origin: origin, Host: "localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const call = mock.method(fal, "fetchFal", async () => Response.json(output));
  assert.equal((await POST(route(input, "https://evil.example"))).status, 403);
  assert.equal((await POST(route({ ...input, messages: [] }))).status, 400);
  assert.equal((await POST(route({ data: "x".repeat(1000001) }))).status, 413);
  assert.equal(call.mock.callCount(), 0);
  services(); mock.method(auth, "getUserFromBearerToken", async () => null);
  const response = await POST(route(input));
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("API budget advice uses read-only verified balance and free quota instead of client claims", async () => {
  services();mock.method(auth,"getUserFromBearerToken",async()=>({id:"verified-user",email:null}));
  mock.method(adminStorage,"createSupabaseAdminClient",()=>({}));
  const read = mock.method(creditStorage,"getCreditAccount",async()=>({user_id:"verified-user",balance:19,free_granted:true}));
  mock.method(freePolicy,"h3FreeContext",async()=>({ipHash:"test",deviceHash:"test"}));
  mock.method(freePolicy,"getH3DailyFreeStatus",async()=>({eligible:true,available:true,remaining:1,resetsAt:"2099-01-01",reason:"available"}));
  const call = mock.method(fal, "fetchFal", async () => { throw new Error("Budget cards must not call the LLM"); });
  const response=await POST(new Request("http://localhost:3000/api/ai/assistant",{method:"POST",headers:{Origin:"http://localhost:3000",Host:"localhost:3000","Content-Type":"application/json"},body:JSON.stringify({...input,messages:[{role:"user",content:"图生视频哪个模型便宜？"}],account:{creditBalance:999999}})}));
  assert.equal(response.status,200);assert.equal(read.mock.callCount(),1);
  assert.equal(call.mock.callCount(),0);
  const { actions } = await response.json();
  assert.equal(actions[0].label, "MiniMax H3 Max Turbo");
  assert.equal(actions[0].credits, 0);
  assert.equal(actions[0].affordable, true);
});
test("account questions omit every model, generation parameter, private prompt and image", () => {
  for(const question of ["登录邮件一直收不到怎么办？","登录免费吗？","How do I sign in?","充值支付成功，但是积分没到账怎么办？","在哪里查看我的历史记录？"]){
    const request:AssistantRequest={...input,messages:[{role:"user",content:question}],context:{...input.context!,prompt:"PRIVATE_CREATIVE_PROMPT",imageUrls:["https://example.com/private-photo.png"]}};
    const body=buildAssistantInput(request,"test"),facts=JSON.parse(body.prompt).platformFacts;
    assert.equal(facts.models,undefined,question);assert.equal(facts.currentWorkspace,undefined,question);
    assert.equal(facts.mediaRules,undefined,question);assert.equal(facts.budgetOptions,undefined,question);
    assert.equal(body.image_urls,undefined,question);assert.ok(!body.prompt.includes("PRIVATE_CREATIVE_PROMPT"));
    assert.ok(!body.prompt.includes("480p"));assert.ok(!body.prompt.includes("kling"));
  }
});
test("unrelated model actions, prompts and navigation cannot leak into login answers", () => {
  const request:AssistantRequest={...input,messages:[{role:"user",content:"登录邮件收不到怎么办"}]};
  const parsed=parseAssistantReply({output:JSON.stringify({reply:"请检查垃圾邮件。",suggestedPrompt:"unrelated creative prompt",recommendations:[{workflow:"image-to-video",provider:"heygen-video"}],pages:[{target:"billing"},{target:"projects"}]})},request);
  assert.deepEqual(parsed.actions,[]);assert.equal(parsed.suggestedPrompt,undefined);
});
test("reference video retrieves only compatible models and limits, while pricing omits raw prompt/images", () => {
  const request:AssistantRequest={...input,messages:[{role:"user",content:"多图生视频选哪个模型，尽量便宜"}],context:{...input.context!,prompt:"PRIVATE_CREATIVE_PROMPT",imageUrls:["https://example.com/image.png"]}};
  const body=buildAssistantInput(request,"test"),facts=JSON.parse(body.prompt).platformFacts;
  assert.deepEqual(facts.models.map((model:{id:string})=>model.id).sort(),["heygen-video","seedance-2.5-flash-video"].sort());
  assert.equal(facts.budgetOptions[0].provider,"heygen-video");assert.equal(facts.budgetOptions[0].credits,15);
  assert.equal(body.image_urls,undefined);assert.equal(facts.currentWorkspace.prompt,undefined);
  assert.equal(facts.sampleQuotes,undefined);assert.equal(facts.mediaRules.seedreamEdit,undefined);
  assert.ok(body.prompt.length+body.system_prompt.length<7000);
});
test("follow-ups inherit the conversation topic, explicit topic changes drop unrelated history", () => {
  const login:AssistantRequest={...input,messages:[{role:"user",content:"帮我写一段产品视频提示词"},{role:"assistant",content:"PRIVATE_SCRIPT_FIXTURE"},{role:"user",content:"登录邮件收不到怎么办"},{role:"assistant",content:"检查垃圾邮件"},{role:"user",content:"还是收不到"}]};
  const scope=assistantKnowledgeScope(login);assert.ok(scope.topics.includes("login"));assert.equal(scope.usesWorkspace,false);
  const body=buildAssistantInput(login,"test");assert.ok(!body.prompt.includes("PRIVATE_SCRIPT_FIXTURE"));
  assert.equal(JSON.parse(body.prompt).conversation.at(-1).content,"还是收不到");
  const pricing:AssistantRequest={...input,messages:[{role:"user",content:"多张图生成视频用哪个模型"},{role:"assistant",content:"可以比较参考视频模型"},{role:"user",content:"那哪个积分便宜？"}]};
  const facts=JSON.parse(buildAssistantInput(pricing,"test").prompt).platformFacts;
  assert.equal(facts.budgetOptions[0].workflow,"reference-to-video");assert.equal(facts.budgetOptions[0].provider,"heygen-video");
  const creative={...login,messages:[...login.messages,{role:"user" as const,content:"现在帮我写咖啡广告提示词"}]};
  assert.ok(JSON.parse(buildAssistantInput(creative,"test").prompt).platformFacts.currentWorkspace.prompt);
});
test("full model catalogs are included only when explicitly requested", () => {
  const all=buildAssistantFacts({...input,messages:[{role:"user",content:"列出平台所有模型"}]});
  assert.ok((all.models?.length||0)>10);assert.equal(all.knowledgeScope.partialCatalog,false);
  assert.ok(all.models?.every(model=>model.durations===undefined));
  const specific=buildAssistantFacts({...input,messages:[{role:"user",content:"Seedance 2.5 Flash 支持哪些时长和分辨率？"}]});
  assert.ok(specific.models?.find(model=>model.id==="seedance-2.5-flash-video")?.durations?.includes("30s"));
  assert.ok((specific.models?.length||0)<8);
});
test("writing for a selected model loads only that model and preserves the full creative brief", () => {
  const request={...input,messages:[{role:"user" as const,content:"帮我整理提示词"}],context:{...input.context!,prompt:"PRIVATE_DETAILED_SCRIPT\nNo voiceover.\n0-2s: hold the product."}};
  const facts=buildAssistantFacts(request);
  assert.deepEqual(facts.models?.map(model=>model.id),["heygen-video"]);
  assert.equal(facts.currentWorkspace?.prompt,request.context.prompt);
  assert.equal(facts.budgetOptions,undefined);assert.equal(facts.verifiedBalance,undefined);
});
test("login, material limits and budget cards work without an upstream key or an LLM call", async () => {
  services();
  delete process.env.FAL_KEY;
  const image=mock.method(imageValidation,"validateEnhancementImage",async()=>{throw new Error("Login must not inspect media");});
  const call=mock.method(fal,"fetchFal",async()=>{throw new Error("Cannot call the LLM for a direct answer");});
  const login:AssistantRequest={...input,messages:[{role:"user",content:"登录邮件收不到怎么办"}],context:{...input.context!,prompt:"PRIVATE_EDIT",imageUrls:["https://example.com/private.png"]}};
  const reply = await replyWithCreationAssistant(login,identity);
  assert.match(reply.reply, /垃圾邮件/);
  assert.equal(reply.actions[0]?.href, "/auth");
  const context = {...input.context!, workflow:"reference-to-video", provider:"seedance-2.5-flash-video", seedanceTask:"extension"};
  const limits = await replyWithCreationAssistant({...input,context,messages:[{role:"user",content:"参考素材应该怎么用？"}],shortcut:"references"},identity);
  assert.match(limits.reply, /10 张图片/);
  assert.match(limits.reply, /参考视频必填/);
  const budget = await replyWithCreationAssistant({...input,messages:[{role:"user",content:"多图生视频选哪个模型，尽量便宜"}],account:{creditBalance:10}},identity);
  assert.equal(budget.actions[0]?.credits,15);
  assert.equal(budget.actions[0]?.affordable,false);
  assert.match(budget.actions[0]?.href || "", /workflow=reference-to-video/);
  assert.match(budget.reply,/超出你的余额/);
  const ten = await replyWithCreationAssistant({...input,locale:"en",messages:[{role:"user",content:"Which model is cheapest for a video from 10 photos?"}]},identity);
  assert.equal(ten.actions[0]?.label, "Seedance 2.5 Flash");
  assert.equal(call.mock.callCount(),0);assert.equal(image.mock.callCount(),0);
});
test("clear quote questions stay local and creative requests keep model and image support", async () => {
  services();
  const quote = {...input, messages:[{role:"user" as const,content:"这次生成需要多少积分？"}]};
  assert.equal(assistantDirectIntent(quote), "current-cost");
  assert.match((await replyWithCreationAssistant(quote, identity)).reply, /15 积分/);
  const creative = {...input, messages:[{role:"user" as const,content:"图生视频哪个模型便宜？顺便帮我写个咖啡广告提示词。"}]};
  assert.equal(assistantDirectIntent(creative), undefined);
  const call = mock.method(fal, "fetchFal", async () => Response.json(output));
  const result = await replyWithCreationAssistant(creative, identity);
  assert.equal(call.mock.callCount(), 1);
  assert.equal(result.suggestedPrompt, "Preserve the product. Slow camera push-in. No voiceover.");
});
test("account questions do not read credit balances or free quotas", async () => {
  services();mock.method(auth,"getUserFromBearerToken",async()=>({id:"login-only-user",email:null}));
  const read=mock.method(creditStorage,"getCreditAccount",async()=>{throw new Error("Unrelated balance query");});
  const quota=mock.method(freePolicy,"getH3DailyFreeStatus",async()=>{throw new Error("Unrelated quota query");});
  mock.method(fal,"fetchFal",async()=>Response.json({output:JSON.stringify({reply:"检查登录邮箱和垃圾邮件。",recommendations:[],pages:[]})}));
  const response=await POST(new Request("http://localhost:3000/api/ai/assistant",{method:"POST",headers:{Origin:"http://localhost:3000",Host:"localhost:3000","Content-Type":"application/json"},body:JSON.stringify({...input,messages:[{role:"user",content:"登录邮件收不到"}]})}));
  assert.equal(response.status,200);assert.equal(read.mock.callCount(),0);assert.equal(quota.mock.callCount(),0);
});
