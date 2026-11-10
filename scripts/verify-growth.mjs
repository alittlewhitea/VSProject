import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const native=createRequire(import.meta.url);
function loader(mocks={}){const cache=new Map();function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(id=>{if(id in mocks)return mocks[id];if(!id.startsWith('.'))return native(id);const path=resolve(dirname(file),id);return load(existsSync(path+'.ts')?path+'.ts':path+'.tsx');},module,module.exports);return module.exports;}return load;}
const sql=[],events=[],values=new Map(),written=[];
const store={get:key=>values.has(key)?{value:values.get(key)}:undefined,set(key,value,options){values.set(key,value);written.push({key,value,options});}};
let allowAdmin=false,failGallery=false;
const mysql={toMysqlDate:value=>value.toISOString().slice(0,19).replace('T',' '),mysqlExecute:async(query,params)=>{
 sql.push({query,params});
 if(query.startsWith('update users'))return {affectedRows:1};
 if(query.includes('from analytics_events'))return [{landingPath:'/avatar/ai-avatar-generator',channel:'organic_search',visitors:'3',workspaceClicks:'2'}];
 if(query.includes('from users u'))return [{landingPath:'/avatar/ai-avatar-generator',channel:'organic_search',signups:'2',activated:'1',payers:'1'},{landingPath:'unknown',channel:'unknown',signups:'1',activated:'0',payers:'0'}];
 if(query.includes('count(*) as newUsers'))return [{newUsers:'3',attributedNewUsers:'2',earlierTouchSignups:'0'}];
 throw new Error('Unexpected SQL');
}};
const json=(body,options={})=>({body,status:options.status||200});
const load=loader({'./mysql':mysql,'next/headers':{cookies:async()=>store},'next/server':{NextResponse:{json}},'../../../../lib/server-auth':{getUserFromBearerToken:async()=>null},'../../../../lib/supabase-admin':{createSupabaseAdminClient:()=>({from:()=>({insert:async row=>{events.push(row);return {error:null};}})})},'../../../../lib/admin-auth':{getAdminUserFromRequest:async()=>allowAdmin?{id:'admin'}:null}});
const policy=load('src/lib/growth-policy.ts'),attribution=load('src/lib/growth-attribution.ts');
for(const path of ['/studio?mode=avatar','/admin','/api/auth/verify?token=secret','/en/auth','/billing','https://evil.invalid','//evil.invalid','/\\evil.invalid','/en/avatar/ai-avatar-generator','/zh-CN/video/text-to-video'])assert.equal(policy.publicLandingPath(path),null,path);
assert.equal(policy.publicLandingPath('/video/image-to-video?gclid=secret'),'/video/image-to-video');assert.equal(policy.publicLandingPath('/es/video/text-to-video'),'/es/video/text-to-video');
const cases=[['/en','https://www.google.com/search?q=private','organic_search'],['/en?gclid=secret','','paid_search'],['/en?utm_source=google&utm_medium=cpc','','paid_search'],['/en?utm_source=chatgpt.com','','ai_referral'],['/en','https://www.perplexity.ai/search/private','ai_referral'],['/en','https://dreamface.io/video/examples','direct'],['/en','https://accounts.google.com/','direct'],['/en','https://www.paypal.com/checkout','direct'],['/en?utm_source=newsletter&utm_medium=email','','campaign']];
for(const [path,ref,expected] of cases)assert.equal(policy.growthSource(path,ref,'dreamface.io').channel,expected);
const first=attribution.captureGrowthTouch(store,{pagePath:'/avatar/ai-avatar-generator?utm_source=google&utm_medium=organic&gclid=private-click-id',referrer:'https://www.google.com/search?token=private-referrer',anonymousId:'anon_fixture_browser_123'},'dreamface.io');
assert.equal(first.landingPath,'/avatar/ai-avatar-generator');assert.equal(first.channel,'paid_search');
assert.equal(JSON.stringify(first).includes('private-'),false,'Click IDs and referrer queries never enter the attribution cookie');
assert.equal(written[0].options.httpOnly,true);assert.equal(written[0].options.sameSite,'lax');assert.equal(written[0].options.maxAge,30*86400);
const signed=values.get(attribution.GROWTH_COOKIE);assert.equal(attribution.readGrowthTouch(signed).id,first.id);assert.equal(attribution.readGrowthTouch(signed+'x'),null);
assert.equal(attribution.captureGrowthTouch(store,{pagePath:'/en/price',referrer:'https://accounts.google.com/'},'dreamface.io').id,first.id,'OAuth and a later page cannot replace the first landing');
const before=sql.length;assert.equal(await attribution.recordSignupAttribution('old-user',false,signed),false);assert.equal(sql.length,before,'Existing logins do not write registration attribution');
assert.equal(await attribution.recordSignupAttribution('new-user',true,signed),true);assert.match(sql.at(-1).query,/growthAttribution.*is null/);assert.equal(JSON.parse(sql.at(-1).params[0]).id,first.id);
const track=load('src/app/api/analytics/track/route.ts');
const request=(path,properties={})=>({url:'https://dreamface.io/api/analytics/track',headers:new Headers(),json:async()=>({eventName:'landing_view',pagePath:path,anonymousId:'anon_fixture_browser_123',properties})});
let response=await track.POST(request('/avatar/ai-avatar-generator',{attribution_id:'forged',first_landing_path:'/forged'}));
assert.equal(response.status,200);assert.equal(events.at(-1).properties.attribution_id,first.id);assert.equal(events.at(-1).properties.first_landing_path,first.landingPath);
const eventCount=events.length;response=await track.POST(request('/api/auth/verify?token=secret'));assert.equal(response.status,400);assert.equal(events.length,eventCount);
const report=await load('src/lib/growth-report.ts').readGrowthReport(28,Date.parse('2026-11-10T04:00:00Z'));
assert.deepEqual(report.totals,{visitors:3,workspaceClicks:2,signups:3,activated:1,payers:1});assert.equal(report.coverage.attributedNewUsers,2);assert.equal(report.rows.find(row=>row.landingPath==='unknown').visitors,0);
const cohort=sql.find(row=>row.query.includes('from users u'));assert.match(cohort.query,/t.transport = 'real'.*t.status = 'completed'/s);assert.match(cohort.query,/t.output_url is not null/);assert.match(cohort.query,/p.status = 'completed'/);assert.doesNotMatch(cohort.query,/login_success|generation_completed/);
const adminRoute=load('src/app/api/admin/growth/route.ts'),queries=sql.length;
assert.equal((await adminRoute.GET({url:'https://dreamface.io/api/admin/growth?days=28'})).status,403);assert.equal(sql.length,queries,'Anonymous callers cannot query growth facts');
allowAdmin=true;assert.equal((await adminRoute.GET({url:'https://dreamface.io/api/admin/growth?days=7'})).body.days,7);

// Render the actual landing pages and Gallery on the server with isolated data.
const galleryRows=[{id:'12345678-1234-4234-8234-123456789abc',title:'Published portrait',category:'Daily Life',image_url:'https://example.invalid/photo.png',prompt:'A portrait.',model:'Fixture',source_url:'https://example.invalid/source',is_featured:true,created_at:'2026-11-01T00:00:00Z'}];
const navigation={useRouter:()=>({push(){}}),useSearchParams:()=>new URLSearchParams(),notFound:()=>{throw new Error('Not found');}};
const link=({href,children,prefetch,...props})=>React.createElement('a',{...props,href},children);
const uiMocks={'next/link':{__esModule:true,default:link},'next/navigation':navigation};
for(const prefix of ['../../../components/','../../components/']){
 uiMocks[prefix+'top-nav']={TopNav:()=>null};uiMocks[prefix+'site-footer']={SiteFooter:()=>null};uiMocks[prefix+'gallery-image']={GalleryImage:props=>React.createElement('img',{src:props.src,alt:props.alt||''})};
}
uiMocks['../../lib/gallery-db']={listPublishedGalleryRows:async()=>{if(failGallery)throw new Error('Fixture offline');return galleryRows;}};
const ui=loader(uiMocks);
const avatar=ui('src/app/avatar/ai-avatar-generator/page.tsx');const avatarHtml=renderToStaticMarkup(React.createElement(avatar.default));
assert.ok(avatarHtml.includes('application/ld+json'));assert.ok(avatarHtml.includes('/studio?mode=avatar'));assert.ok(avatarHtml.includes('AI avatar video'));assert.ok(avatar.metadata.alternates.canonical.endsWith('/avatar/ai-avatar-generator'));
const examples=ui('src/app/video/examples/page.tsx');const exampleHtml=renderToStaticMarkup(React.createElement(examples.default));
assert.ok(exampleHtml.includes('CollectionPage'));assert.ok(exampleHtml.includes('BreadcrumbList'));
assert.equal((exampleHtml.match(/<video /g)||[]).length,6);assert.ok(exampleHtml.includes('Supplier model and source'));assert.ok(exampleHtml.includes('estimated'));assert.ok(exampleHtml.includes('reference='));
const omni=ui('src/app/video/gemini-omni/page.tsx');const omniHtml=renderToStaticMarkup(React.createElement(omni.default));
assert.ok(omniHtml.includes('Flash 1.2'));assert.equal(omniHtml.includes('Create and Edit Videos'),false);assert.equal(omni.metadata.title.absolute.includes('Editor'),false);
const gallery=ui('src/app/gallery/page.tsx');const galleryElement=await gallery.default({searchParams:Promise.resolve({})});const galleryHtml=renderToStaticMarkup(galleryElement);
assert.ok(galleryHtml.includes('/gallery/12345678-1234-4234-8234-123456789abc-published-portrait'),'A real published detail link exists before JavaScript runs');
failGallery=true;const offline=renderToStaticMarkup(await gallery.default({searchParams:Promise.resolve({})}));assert.equal(offline.includes('/gallery/sample-'),false,'Storage failure cannot invent crawlable gallery details');
console.log('Growth passed: safe public entry paths, search/AI/campaign source classification, signed first-touch cookies, new-user-only attribution, no callback overwrite, protected analytics fields, fact-based cohort aggregation and admin authorization. Avatar/video/Omni and published Gallery links render on the server. No live accounts, database, provider or payment calls.');
