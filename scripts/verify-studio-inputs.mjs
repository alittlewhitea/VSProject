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
      if(!id.startsWith('.'))return native(id);
      const target=resolve(dirname(path),id);
      return load(existsSync(target+'.ts')?target+'.ts':target+'.tsx');
    },module,module.exports);
    return module.exports;
  }
  return load;
}
const load=loader(),models=load('src/features/studio/video-models.ts'),gpt=load('src/lib/gpt-image-models.ts'),frames=load('src/lib/video-keyframes.ts'),policy=load('src/lib/studio-workspace-inputs.ts');
const source=readFileSync('src/app/studio/studio-client.tsx','utf8');
const ast=ts.createSourceFile('studio-client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function findNode(predicate){let found;function visit(node){if(!found&&predicate(node))found=node;if(!found)ts.forEachChild(node,visit);}visit(ast);assert.ok(found,'Source node not found');return found;}
function executeFunction(name,context){const node=findNode(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);const compiled=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('context',`with(context){${compiled};return ${name};}`)(context);}
function context(mode,workflow) {
  const c={...models,...gpt,...frames,...policy,mode,activeWorkflow:workflow,imageWorkflow:workflow,videoWorkflow:workflow,
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
    workflowForMode:(_mode,workflow)=>workflow,isKnownVideoDuration:()=>true,isKnownVideoResolution:()=>true,isKnownVideoRatio:()=>false,
    IMAGE_SIZE_PRESETS:[],isProviderAllowedForMode:()=>true,
    navigateStudio(href){c.sp=new URL(href,'https://studio.test').searchParams;},
    FileReader:class{readAsDataURL(file){this.result=file.dataUrl;queueMicrotask(()=>this.onload());}}
  };
  Object.defineProperty(c,'referenceImageUrls',{get:()=>[...c.referenceImagesText.split(/\r?\n|,/).filter(Boolean),...c.referenceImageFiles]});
  for(const [setter,field] of Object.entries({setReferenceImagesText:'referenceImagesText',setReferenceImageFiles:'referenceImageFiles',setPrompt:'prompt',setProvider:'provider',setImageWorkflow:'imageWorkflow',setVideoWorkflow:'videoWorkflow',setDuration:'duration',setRatio:'ratio',setVideoResolution:'videoResolution',setImageSize:'imageSize',setImageQuality:'imageQuality',setStatusTone:'statusTone',setStatusText:'statusText',setAvatarAudioUrl:'avatarAudioUrl'}))c[setter]=value=>{c[field]=typeof value==='function'?value(c[field]):value;};
  for(const name of ['isAvatarProvider','isH3MaxProvider','isH3VideoProvider','isSamplePrompt','isProviderDefaultPrompt','promptForProviderChange','defaultPromptForProvider','isModelSampleReference'])c[name]=executeFunction(name,c);
  c.applyProvider=executeFunction('applyProvider',c);c.upload=executeFunction('handleReferenceFiles',c);
  return c;
}
const file={type:'image/jpeg',size:1000,dataUrl:'data:image/jpeg;base64,USER_UPLOADED_IMAGE'};
const image=context('image','image-to-image');
image.referenceImagesText=gpt.GPT_IMAGE_EXAMPLE_REFERENCES.slice(0,2).join('\n');
await image.upload([file]);
assert.equal(image.referenceImagesText,'');assert.deepEqual(image.referenceImageFiles,[file.dataUrl]);
for(const provider of ['nano-banana-image','nano-banana-pro','nano-banana-lite','gpt-image-2.5-sunburst','chatgpt-image']) {
  image.applyProvider(provider);assert.deepEqual(image.referenceImageFiles,[file.dataUrl],provider+' must retain uploaded image');assert.deepEqual(image.referenceImageUrls,[file.dataUrl]);
}
image.referenceImagesText='https://user.test/custom.png';image.applyProvider('nano-banana-image');assert.equal(image.referenceImagesText,'https://user.test/custom.png');
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
assert.equal(video.defaultPromptForProvider('minimax-h3-max-video','avatar-video'),'avatar-max');

// Execute the URL-input effect: model-only URL changes cannot overwrite uploads/edits.
const effect=findNode(node=>ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const promptParam = sp.get("prompt")'));
const effectCode=ts.transpileModule('const apply = '+effect.arguments[0].getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const url=context('video','image-to-video');url.sp=new URLSearchParams({mode:'video',workflow:'image-to-video',provider:url.provider,prompt:'Shared URL prompt',reference:'https://user.test/original.png'});
const applyUrl=new Function('context',`with(context){${effectCode};return apply;}`)(url);
applyUrl();await url.upload([file],0);url.prompt='Edited after upload.';url.sp.set('provider','minimax-h3-max-video');applyUrl();
assert.equal(url.referenceImagesText,'');assert.deepEqual(url.referenceImageFiles,[file.dataUrl]);assert.equal(url.prompt,'Edited after upload.');
url.sp.set('reference','https://user.test/new.png');applyUrl();assert.equal(url.referenceImagesText,'https://user.test/new.png');

// Render the actual preview component and trigger explicit media clicks/play.
let cursor=0,cells=[],applied=[];
const react={useEffect(){},useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>{const i=cursor++;if(!(i in cells))cells[i]=value;return[cells[i],next=>cells[i]=next];}};
const Settings=loader({react,'./video-settings.module.css':{default:{}},'./studio-link':{default:()=>null},'./model-picker':{ModelPicker:()=>null},'./generation-cost-summary':{GenerationCostSummary:()=>null}})('src/features/studio/video-settings.tsx').VideoSettings;
const showcases=[{prompt:'Prompt for preview one.',duration:'5s',videoUrl:'https://video.test/one.mp4',posterUrl:'one.png'},{prompt:'Prompt for preview two.',duration:'10s',videoUrl:'https://video.test/two.mp4',posterUrl:'two.png'}];
const showcaseAttribute=findNode(node=>ts.isJsxAttribute(node)&&node.name.getText(ast)==='onUsePromptShowcase');
const callbackCode=ts.transpileModule('const select = '+showcaseAttribute.initializer.expression.getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const selection=context('video','image-to-video');selection.provider='minimax-h3-max-video';selection.referenceImageFiles=[file.dataUrl];selection.videoResolution='768p';selection.videoPromptAI={reset:value=>selection.prompt=value};selection.window={scrollTo(){}};
new Function('context',`with(context){${callbackCode};return select;}`)(selection)(showcases[1]);
assert.equal(selection.provider,'minimax-h3-max-video');assert.deepEqual(selection.referenceImageFiles,[file.dataUrl]);assert.equal(selection.videoResolution,'768p');assert.equal(selection.prompt,showcases[1].prompt);
const props={workflow:'text-to-video',prompt:'',referenceImageUrls:[],provider:'minimax-h3-max-video',providerOptions:[],duration:'5s',durationOptions:['5s'],ratio:'16:9',ratioOptions:['16:9'],resolution:'480p',resolutionOptions:['480p'],estimatedCredits:10,recentTasks:[],promptShowcases:showcases,translate:key=>key,promptAI:{enabled:true,busy:false},onUsePromptShowcase:showcase=>applied.push(showcase.prompt)};
function render(){cursor=0;return Settings(props);}
function elements(node,result=[]){if(!node)return result;if(Array.isArray(node)){for(const child of node)elements(child,result);}else if(node.props){result.push(node);elements(node.props.children,result);}return result;}
let tree=render();assert.deepEqual(applied,[]);
let media=elements(tree).find(node=>node.type==='video'&&node.props.controls);media.props.onClick();assert.deepEqual(applied,[showcases[0].prompt]);
applied=[];props.prompt='';media.props.onPlay();assert.deepEqual(applied,[showcases[0].prompt]);
applied=[];const second=elements(tree).find(node=>node.type==='button'&&node.props['aria-label']==='studio.workbench.sampleVideo 2');second.props.onClick();assert.deepEqual(applied,[showcases[1].prompt]);
tree=render();assert.equal(elements(tree).find(node=>node.type==='video'&&node.props.controls).props.src,showcases[1].videoUrl);
console.log('Studio input tests passed: uploaded images survive all image-edit/video model switches, start frame retained when removing unsupported end frame, H3 defaults empty, custom prompts preserved, URL inputs do not overwrite edits/uploads on model change, explicit preview click/play/selection supplies matching prompt. No database or paid calls.');
