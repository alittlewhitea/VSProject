import {readStudioSource} from './studio-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const native = createRequire(import.meta.url);
function loader(overrides={}) {
  const cache=new Map();
  function load(path) {
    path=resolve(path);if(cache.has(path))return cache.get(path).exports;
    const module={exports:{}};cache.set(path,module);
    const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    new Function('require','module','exports',code)(id=>{
      if(overrides[id])return overrides[id];
      if(id.endsWith('.module.css'))return new Proxy({},{get:(_target,key)=>String(key)});
      if(!id.startsWith('.'))return native(id);
      const target=resolve(dirname(path),id);
      return load(existsSync(target+'.ts')?target+'.ts':target+'.tsx');
    },module,module.exports);
    return module.exports;
  }
  return load;
}
const load=loader(),models=load('src/features/studio/video-models.ts'),gpt=load('src/lib/gpt-image-models.ts'),frames=load('src/lib/video-keyframes.ts'),policy=load('src/lib/studio-workspace-inputs.ts');
const source=readStudioSource();
const ast=ts.createSourceFile('studio-client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function findNode(predicate){let found;function visit(node){if(!found&&predicate(node))found=node;if(!found)ts.forEachChild(node,visit);}visit(ast);assert.ok(found,'Source node not found');return found;}
function executeFunction(name,context){const node=findNode(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);const compiled=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('context',`with(context){${compiled};return ${name};}`)(context);}
const workflowMeta=findNode(node=>ts.isVariableDeclaration(node)&&node.name.getText(ast)==='WORKFLOW_META');
const WORKFLOW_META=new Function('VIDEO_PROVIDERS_BY_WORKFLOW','GEMINI_TTS_PROVIDER',`return (${workflowMeta.initializer.getText(ast)});`)(models.VIDEO_PROVIDERS_BY_WORKFLOW,load('src/lib/gemini-tts.ts').GEMINI_TTS_PROVIDER);
function context(mode,workflow) {
  const c={...models,...gpt,...frames,...policy,...load('src/lib/mischief.ts'),WORKFLOW_META,mode,activeWorkflow:workflow,imageWorkflow:workflow,videoWorkflow:workflow,
    provider:mode==='image'?'chatgpt-image':'minimax-h3-max-turbo-video',prompt:'',referenceImagesText:'',referenceImageFiles:[],
    duration:'5s',ratio:mode==='image'?'auto':'source',videoResolution:'480p',imageSize:'square',hasCompletedCreation:false,accessToken:null,isPromptlessImageWorkflow:false,
    sp:new URLSearchParams({mode,workflow}),MINIMAX_MUSIC_DEFAULT_PROMPT:'music-default',KLING_AVATAR_DEFAULT_SCRIPT:'avatar-script',
    MINIMAX_H3_MAX_AVATAR_PROMPT:'avatar-max',MINIMAX_H3_MAX_TURBO_AVATAR_PROMPT:'avatar-turbo',
    YOUNG_KOREAN_WOMAN_PROMPT:'young-korean',EASTBOURNE_KOREAN_WOMAN_PROMPT:'eastbourne',SPORTS_BROADCAST_PROMPT:'sports',
    st:key=>key,trackEvent(){},safeSetLocalStorage(){},lastModelStorageKey:workflow=>workflow,
    defaultImageSizeForProvider:()=> 'square',defaultImageRatioForProvider:()=> 'auto',
    defaultVideoResolutionForProvider:provider=>models.videoModelDefaultResolution(provider),
    modelSampleReferenceForProvider:provider=>models.videoExampleSourceFor(provider),
    stripAvatarDefaultReferences:value=>policy.referenceTextWithoutExamples(value),
    lastAppliedPromptUrlRef:{current:null},lastAppliedReferenceUrlRef:{current:null},
    lastStudioModeRef:{current:mode},referenceUploadScopeRef:{current:0},previousReferenceWorkflow:{current:workflow==='reference-to-video'},
    initialProvider:mode==='image'?'chatgpt-image':'minimax-h3-max-turbo-video',selectedProvider:mode==='image'?'chatgpt-image':'minimax-h3-max-turbo-video',
    readRememberedModel:()=>null,
    workflowForMode:(_mode,workflow)=>workflow,isKnownVideoDuration:()=>true,isKnownVideoResolution:()=>true,isKnownVideoRatio:()=>false,
    IMAGE_SIZE_PRESETS:[],isProviderAllowedForMode:()=>true,
    navigateStudio(href){c.sp=new URL(href,'https://studio.test').searchParams;},
    FileReader:class{readAsDataURL(file){this.result=file.dataUrl;queueMicrotask(()=>this.onload());}}
  };
  Object.defineProperty(c,'referenceImageUrls',{get:()=>[...policy.parseStudioReferenceImages(c.referenceImagesText),...c.referenceImageFiles]});
  for(const [setter,field] of Object.entries({setReferenceImagesText:'referenceImagesText',setReferenceImageFiles:'referenceImageFiles',setPrompt:'prompt',setProvider:'provider',setImageWorkflow:'imageWorkflow',setVideoWorkflow:'videoWorkflow',setAudioWorkflow:'audioWorkflow',setDuration:'duration',setRatio:'ratio',setVideoResolution:'videoResolution',setImageSize:'imageSize',setImageQuality:'imageQuality',setStatusTone:'statusTone',setStatusText:'statusText',setAvatarAudioUrl:'avatarAudioUrl'}))c[setter]=value=>{c[field]=typeof value==='function'?value(c[field]):value;};
  for(const name of ['isAvatarProvider','isH3MaxProvider','isH3VideoProvider','isNanoBananaProvider','isSamplePrompt','isProviderDefaultPrompt','promptForProviderChange','defaultPromptForProvider','isModelSampleReference','workflowForMode','providerForWorkflow'])c[name]=executeFunction(name,c);
  c.applyProvider=executeFunction('applyProvider',c);c.applyWorkflow=executeFunction('applyWorkflow',c);c.upload=executeFunction('handleReferenceFiles',c);
  return c;
}
const file={type:'image/jpeg',size:1000,dataUrl:'data:image/jpeg;base64,USER_UPLOADED_IMAGE'};
const image=context('image','image-to-image');
image.referenceImagesText=gpt.GPT_IMAGE_EXAMPLE_REFERENCES.slice(0,2).join('\n');
await image.upload([file]);
assert.equal(image.referenceImagesText,'');assert.deepEqual(image.referenceImageFiles,[file.dataUrl]);
for(const provider of ['nano-banana-image','nano-banana-pro','nano-banana-lite','gpt-image-2.6-sunburst','chatgpt-image']) {
  image.applyProvider(provider);assert.deepEqual(image.referenceImageFiles,[file.dataUrl],provider+' must retain uploaded image');assert.deepEqual(image.referenceImageUrls,[file.dataUrl]);
}
image.referenceImagesText='https://user.test/custom.png';image.applyProvider('nano-banana-image');assert.equal(image.referenceImagesText,'https://user.test/custom.png');
const templateCatalog=JSON.parse(readFileSync('public/data/studio-image-templates.json','utf8'));
for(const template of templateCatalog.items)assert.deepEqual(policy.parseStudioReferenceImages(template.imageUrl),[template.imageUrl],'Do not split public CDN transformation commas');
const templateUrl=templateCatalog.items[0].imageUrl;
assert.deepEqual(policy.parseStudioReferenceImages(`${templateUrl}, https://user.test/custom.png`),[templateUrl,'https://user.test/custom.png']);
assert.deepEqual(policy.parseStudioReferenceImages('data:image/png;base64,IMAGE_DATA'),['data:image/png;base64,IMAGE_DATA']);
const templateImage=context('image','image-to-image');templateImage.referenceImagesText=templateUrl;
await templateImage.upload([file]);assert.deepEqual(templateImage.referenceImageUrls,[templateUrl,file.dataUrl]);
for(const provider of ['nano-banana-image','nano-banana-pro','nano-banana-lite','gpt-image-2.6-sunburst','chatgpt-image']){
  templateImage.applyProvider(provider);assert.deepEqual(templateImage.referenceImageUrls,[templateUrl,file.dataUrl],'Template must remain image 1, user upload image 2 across model changes');
}
const templateLinks=load('src/features/studio/studio-image-template-link.ts');
const templateHref=new URL(templateLinks.studioImageTemplateHref({id:'template-test',imageUrl:templateUrl},'Use the first image as a style template.'),'https://studio.test');
assert.equal(templateHref.pathname,'/studio');assert.equal(templateHref.searchParams.get('workflow'),'image-to-image');assert.equal(templateHref.searchParams.get('reference'),templateUrl);assert.equal(templateHref.searchParams.get('templateId'),'template-test');
assert.equal(templateHref.searchParams.get('prompt'),'Use the first image as a style template.');
const video=context('video','image-to-video');await video.upload([file],0);
for(const provider of Object.values(models.VIDEO_MODEL_CONFIGS).filter(config=>config.workflows['image-to-video']).map(config=>config.id)) {
  video.applyProvider(provider);assert.deepEqual(video.referenceImageFiles,[file.dataUrl],provider+' must retain start frame');assert.deepEqual(video.referenceImageUrls,[file.dataUrl]);
}
video.provider='minimax-h3-max-turbo-video';video.referenceImageFiles=[file.dataUrl,'data:image/jpeg;base64,END_FRAME'];video.applyProvider('kling-video');
assert.deepEqual(video.referenceImageFiles,[file.dataUrl]);assert.equal(video.statusText,'studio.videoWorkbench.endFrameRemoved');
for(const provider of ['minimax-h3-max-video','minimax-h3-max-turbo-video']) for(const workflow of ['text-to-video','image-to-video']) {
  assert.equal(video.defaultPromptForProvider(provider,workflow),'');
  video.prompt=models.videoExampleFor(provider,workflow).prompts[0];video.applyProvider(provider);assert.equal(video.prompt,'');
  video.prompt='Keep my custom motion instructions.';video.applyProvider(provider);assert.equal(video.prompt,'Keep my custom motion instructions.');
}
for(const provider of ['minimax-h3-max-video','minimax-h3-max-turbo-video','kling-avatar-standard','kling-avatar-pro']) {
  assert.equal(video.defaultPromptForProvider(provider,'avatar-video'),'');
  const avatar=context('avatar','avatar-video');
  avatar.applyProvider(provider);
  assert.equal(avatar.prompt,'');assert.equal(avatar.referenceImagesText,'');assert.deepEqual(avatar.referenceImageFiles,[]);
  avatar.prompt='My own speaking script';avatar.referenceImageFiles=[file.dataUrl];
  avatar.applyProvider(provider);
  assert.equal(avatar.prompt,'My own speaking script');assert.deepEqual(avatar.referenceImageFiles,[file.dataUrl]);
  avatar.referenceImagesText='https://user.test/avatar.png';avatar.referenceImageFiles=[];avatar.applyProvider(provider);
  assert.equal(avatar.referenceImagesText,'https://user.test/avatar.png');
}

// Execute the URL-input effect: model-only URL changes cannot overwrite uploads/edits.
const effect=findNode(node=>ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const promptParam = sp.get("prompt")'));
const effectCode=ts.transpileModule('const apply = '+effect.arguments[0].getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const initialReferences=findNode(node=>ts.isVariableDeclaration(node)&&node.name.getText(ast)==='[referenceImagesText, setReferenceImagesText]').initializer.arguments[0].getText(ast);
for(const workflow of ['text-to-image','image-to-image']) for(const provider of ['chatgpt-image','gpt-image-2.6-sunburst','nano-banana-image','nano-banana-pro','nano-banana-lite','flux-image','flux-dev']) {
  const image=context('image',workflow);
  Object.assign(image,{initialProvider:provider,initialWorkflow:workflow,initialVideoWorkflow:'text-to-video',initialReferenceUrl:null});
  assert.equal(image.defaultPromptForProvider(provider,workflow),'');
  assert.equal(new Function('context',`with(context){return (${initialReferences})();}`)(image),'');
  image.applyProvider(provider);assert.equal(image.prompt,'');assert.equal(image.referenceImagesText,'');assert.deepEqual(image.referenceImageFiles,[]);
  image.prompt='Preserve my own image instructions.';image.referenceImageFiles=[file.dataUrl];image.applyProvider(provider);
  assert.equal(image.prompt,'Preserve my own image instructions.');assert.deepEqual(image.referenceImageFiles,[file.dataUrl]);
  image.initialReferenceUrl='https://user.test/explicit-image.png';
  assert.equal(new Function('context',`with(context){return (${initialReferences})();}`)(image),'https://user.test/explicit-image.png');
}
assert.doesNotMatch(source,/gptImageExample\(|imageSamplePreviewUrl/);
assert.doesNotMatch(readFileSync('src/features/studio/unified-workbench-layout.tsx','utf8'),/imageSamplePreview/);
for(const provider of ['minimax-h3-max-video','minimax-h3-max-turbo-video','kling-avatar-standard','kling-avatar-pro']) {
  const avatar=context('avatar','avatar-video');
  Object.assign(avatar,{initialProvider:provider,initialWorkflow:'avatar-video',initialVideoWorkflow:'avatar-video',initialReferenceUrl:null});
  assert.equal(new Function('context',`with(context){return (${initialReferences})();}`)(avatar),'');
  avatar.sp=new URLSearchParams({mode:'avatar',workflow:'avatar-video',provider});
  const apply=new Function('context',`with(context){${effectCode};return apply;}`)(avatar);
  apply();assert.equal(avatar.prompt,'');assert.equal(avatar.referenceImagesText,'');
  avatar.prompt='User script';avatar.referenceImageFiles=[file.dataUrl];
  avatar.sp.set('provider','minimax-h3-max-video');apply();
  assert.equal(avatar.prompt,'User script');assert.deepEqual(avatar.referenceImageFiles,[file.dataUrl]);
  avatar.sp.set('reference','https://user.test/avatar-new.png');apply();assert.equal(avatar.referenceImagesText,'https://user.test/avatar-new.png');
}
const url=context('video','image-to-video');url.sp=new URLSearchParams({mode:'video',workflow:'image-to-video',provider:url.provider,prompt:'Shared URL prompt',reference:'https://user.test/original.png'});
const applyUrl=new Function('context',`with(context){${effectCode};return apply;}`)(url);
applyUrl();await url.upload([file],0);url.prompt='Edited after upload.';url.sp.set('provider','minimax-h3-max-video');applyUrl();
assert.equal(url.referenceImagesText,'');assert.deepEqual(url.referenceImageFiles,[file.dataUrl]);assert.equal(url.prompt,'Edited after upload.');
url.sp.set('reference','https://user.test/new.png');applyUrl();assert.equal(url.referenceImagesText,'https://user.test/new.png');

// Run real route effects: Avatar images cannot leak across workspace boundaries.
const routeEffect=findNode(node=>ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const workflowParam = workflowForMode'));
const routeEffectCode=ts.transpileModule('const apply = '+routeEffect.arguments[0].getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function applyRoute(c, mode, workflow, params={}) {
  c.mode=mode;c.activeWorkflow=workflow;c.sp=new URLSearchParams({mode,workflow,...params});
  new Function('context',`with(context){${routeEffectCode};apply();}`)(c);
  new Function('context',`with(context){${effectCode};apply();}`)(c);
}
for(const script of ['', 'My own speaking script']) for(const reference of ['upload','url']) {
  const avatar=context('avatar','avatar-video');avatar.prompt=script;
  if(reference==='upload')await avatar.upload([file]);else avatar.referenceImagesText='https://user.test/portrait.png';
  applyRoute(avatar,'video','image-to-video');
  assert.deepEqual(avatar.referenceImageUrls,[],'Avatar portrait must not become the video start frame, with or without a script');
  applyRoute(avatar,'avatar','avatar-video');
  assert.deepEqual(avatar.referenceImageUrls,[],'Returning to Avatar must not resurrect a cleared portrait');
}
const explicit=context('avatar','avatar-video');await explicit.upload([file]);
applyRoute(explicit,'video','image-to-video',{reference:'https://user.test/new-video-frame.png'});
assert.deepEqual(explicit.referenceImageUrls,['https://user.test/new-video-frame.png'],'Destination URL reference must replace the previous workspace upload');
const reverse=context('video','image-to-video');await reverse.upload([file],0);
applyRoute(reverse,'avatar','avatar-video');assert.deepEqual(reverse.referenceImageUrls,[]);
const sameWorkspace=context('avatar','avatar-video');await sameWorkspace.upload([file]);
applyRoute(sameWorkspace,'avatar','avatar-video',{provider:'kling-avatar-pro'});
assert.deepEqual(sameWorkspace.referenceImageUrls,[file.dataUrl],'Changing the Avatar model must retain its portrait');
for(const [mode,workflow,nextWorkflow] of [['avatar','avatar-video','image-to-video'],['video','image-to-video','avatar-video']]) {
  const c=context(mode,workflow);c.referenceImagesText='https://user.test/portrait.png';c.referenceImageFiles=[file.dataUrl];
  c.sp.set('reference',c.referenceImagesText);c.sp.set('templateId','old-template');
  c.applyWorkflow(nextWorkflow);
  assert.deepEqual(c.referenceImageUrls,[],'Workflow action must clear the previous workspace references');
  assert.equal(c.sp.has('reference'),false,'Copied URL must not reapply the old portrait');
  assert.equal(c.sp.has('templateId'),false);
  applyRoute(c,nextWorkflow==='avatar-video'?'avatar':'video',nextWorkflow,Object.fromEntries(c.sp));
  assert.deepEqual(c.referenceImageUrls,[]);
}
for(const [mode,workflow] of [['avatar','avatar-video'],['video','image-to-video'],['video','reference-to-video']]) {
  const c=context(mode,workflow);c.HEYGEN_REFERENCE_IMAGE_LIMIT=4;
  let finishRead;
  c.FileReader=class{readAsDataURL(file){finishRead=()=>{this.result=file.dataUrl;this.onload();};}};
  const pending=c.upload([file]);
  applyRoute(c,mode==='avatar'?'video':'avatar',mode==='avatar'?'image-to-video':'avatar-video');
  c.referenceImageFiles=['data:image/png;base64,DESTINATION_IMAGE'];
  finishRead();await pending;
  assert.deepEqual(c.referenceImageUrls,['data:image/png;base64,DESTINATION_IMAGE'],'A late upload must not overwrite destination images');
}

// Render the creation form after removing its side preview; exercise retained controls.
let cursor=0,cells=[],applied=[];
const react={useEffect(){},useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>{const i=cursor++;if(!(i in cells))cells[i]=value;return[cells[i],next=>cells[i]=typeof next==='function'?next(cells[i]):next];}};
const Settings=loader({react,'./video-settings.module.css':{default:{}},'./studio-link':{default:()=>null},'./studio-navigation':{StudioIcon:()=>null},'./model-picker':{ModelPicker:()=>null},'./generation-cost-summary':{GenerationCostSummary:()=>null}})('src/features/studio/video-settings.tsx').VideoSettings;
const props={workflow:'text-to-video',prompt:'My real prompt',referenceImageUrls:[],referenceVideoUrl:'https://video.test/reference.mp4',provider:'heygen-video',providerOptions:[],duration:'5s',durationOptions:['5s','10s'],ratio:'16:9',ratioOptions:['16:9','9:16'],showResolutionControl:true,resolution:'768p',resolutionOptions:['768p','1080p'],estimatedCredits:18,creditBalance:1000,generateDisabled:false,isSubmitting:false,isAuthenticated:true,translate:key=>key,promptAI:{enabled:true,busy:false,edit(){},reset(){},setEnabled(){}},onPromptChange:value=>applied.push(['prompt',value]),onGenerate:()=>applied.push(['generate']),onDurationChange:value=>applied.push(['duration',value]),onRatioChange:value=>applied.push(['ratio',value]),onResolutionChange:value=>applied.push(['resolution',value]),onReferenceFiles:async(files,index)=>applied.push(['file',files,index]),onFileError(){}};
function render(){cursor=0;return Settings(props);}
function elements(node,result=[]){if(!node)return result;if(node.type?.name==="StudioComposerGenerate")return elements(node.type(node.props),result);if(Array.isArray(node)){for(const child of node)elements(child,result);}else if(node.props){result.push(node);elements(node.props.children,result);}return result;}
for(const workflow of ['text-to-video','image-to-video','reference-to-video']) {
 cells=[];applied=[];props.workflow=workflow;props.referenceImageUrls=['data:image/png;base64,fixture'];
 let tree=render(),nodes=elements(tree);
 assert.equal(nodes.find(node=>node.props['data-video-workspace']).props['data-video-workspace'],workflow);
 assert.equal(nodes.some(node=>node.props['data-video-prompt-section']!==undefined),true);
 assert.equal(nodes.some(node=>node.props['data-video-config']!==undefined),true);
 assert.equal(nodes.some(node=>node.type==='video'||String(node.props.className||'').includes('df-preview-stage')),false,'Removed side preview must not mount media');
 assert.equal(nodes.find(node=>node.type==='textarea').props.value,props.prompt);
 nodes.find(node=>node.type==='textarea').props.onChange({target:{value:'Keep this revised prompt'}});
 for(const [label,value] of [['duration','10s'],['aspectRatio','9:16'],['resolution','1080p']])nodes.find(node=>node.props.label==='studio.field.'+label).props.onValueChange(value);
 const action=nodes.find(node=>node.props['data-video-action-bar']!==undefined);
 elements(action).find(node=>node.type==='button').props.onClick();
 assert.deepEqual(applied.slice(0,4),[['prompt','Keep this revised prompt'],['duration','10s'],['ratio','9:16'],['resolution','1080p']]);
 assert.ok(applied.some(item=>item[0]==='generate'));
 if(workflow==='image-to-video') {
  const fileInput=nodes.find(node=>node.type==='input'&&node.props.type==='file');
  await fileInput.props.onChange({target:{files:['fixture-file'],value:'fixture'}});
  assert.ok(applied.some(item=>item[0]==='file'&&item[2]===0));
 }
 if(workflow==='reference-to-video')assert.ok(nodes.some(node=>node.props.videoUrl===props.referenceVideoUrl&&node.props.images===props.referenceImageUrls));
 nodes.find(node=>node.props['data-video-advanced-trigger']!==undefined).props.onClick();tree=render();nodes=elements(tree);
 assert.equal(nodes.find(node=>node.props['data-video-advanced-trigger']!==undefined).props['aria-expanded'],true);
 props.dailyFreeLabel='Free today: 480p / 5s';tree=render();
 assert.ok(elements(tree).some(node=>node.props.role==='status'&&node.props.children===props.dailyFreeLabel));
 props.dailyFreeLabel=undefined;
}
console.log('Studio input tests passed: Avatar workspace images are isolated across navigation, explicit URL references work, stale uploads are ignored, and model changes retain user inputs. Video controls remain intact. No database or paid calls.');
