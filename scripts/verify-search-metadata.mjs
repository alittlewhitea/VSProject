// Run against an isolated local production build, never against production.
import assert from 'node:assert/strict';
const base=process.env.SEO_TEST_BASE || 'http://127.0.0.1:3109';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('SEO_TEST_BASE must be a local HTTP server.');
const locales=['en','zh-CN','zh-TW','pt-BR','ru','vi','de','fr','ja','th','nl','he','ko','es','it','ar'];
async function page(path){
 const response=await fetch(base+path,{headers:{'user-agent':'Googlebot'},redirect:'manual'});
 const html=await response.text();
 const head=html.split('</head>')[0];
 return {response,head,html};
}
function canonical(head){return [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)].map(m=>m[1]);}
function robots(head){return head.match(/<meta\b[^>]*name="robots"[^>]*content="([^"]+)"/)?.[1]||'';}
function title(head){return head.match(/<title>(.*?)<\/title>/)?.[1]||'';}
for(const locale of locales){
 const auth=await page(`/${locale}/auth?next=%2Fstudio`);
 assert.equal(auth.response.status,200,locale);
 assert.doesNotMatch(robots(auth.head),/noindex/,locale);
 assert.deepEqual(canonical(auth.head),[`https://dreamface.io/${locale}/auth`],locale);
 assert.equal((auth.head.match(/hreflang=/gi)||[]).length,17,locale);
 for(const suffix of ['', '/price']){
  const item=await page(`/${locale}${suffix}`);
  assert.equal(item.response.status,200,`${locale}${suffix}`);
  assert.deepEqual(canonical(item.head),[`https://dreamface.io/${locale}${suffix}`]);
  assert.equal((item.head.match(/hreflang=/gi)||[]).length,17,`${locale}${suffix} alternates`);
  assert.doesNotMatch(robots(item.head),/noindex/);
 }
}
const redirect=await page('/auth?next=%2Fstudio');
assert.ok([307,308].includes(redirect.response.status));
assert.match(redirect.response.headers.get('location'),/\/en\/auth\?next=%2Fstudio/i);
for(const path of ['/studio','/studio?utm_source=test']){
 const item=await page(path);assert.equal(item.response.status,200,path);
 assert.deepEqual(canonical(item.head),['https://dreamface.io/studio']);
 assert.doesNotMatch(robots(item.head),/noindex/);assert.match(title(item.head),/AI Creative Studio/);
}
for(const path of ['/studio?mode=video&workflow=image-to-video','/studio?mode=image&workflow=text-to-image&provider=chatgpt-image','/studio?unknown=value']){
 const item=await page(path);assert.equal(item.response.status,200,path);
 assert.deepEqual(canonical(item.head),[],path);assert.doesNotMatch(robots(item.head),/noindex/,path);
}
for(const path of ['/studio?view=projects','/studio?view=referrals','/studio?taskId=fixture']){
 const item=await page(path);assert.equal(item.response.status,200,path);assert.match(robots(item.head),/noindex/,path);assert.deepEqual(canonical(item.head),[]);
}
for(const path of ['/gallery','/gallery?utm_source=test']){
 const item=await page(path);assert.equal(item.response.status,200,path);
 assert.deepEqual(canonical(item.head),['https://dreamface.io/gallery']);assert.match(title(item.head),/AI Prompt Gallery/);
}
for(const path of ['/gallery?q=portrait','/gallery?category=Portrait','/gallery?sort=latest']){
 const item=await page(path);assert.equal(item.response.status,200,path);assert.deepEqual(canonical(item.head),[],path);
}
const about=await page('/about');assert.equal(about.response.status,200);
assert.deepEqual(canonical(about.head),['https://dreamface.io/about']);
assert.equal(title(about.head),'About Us | DreamFace');
const robotResponse=await fetch(base+'/robots.txt');const robotText=await robotResponse.text();
assert.match(robotText,/Disallow:\s*\/auth(?:\s|$)/i);
assert.match(robotText,/Disallow:\s*\/api(?:\s|$)/i);
const sitemap=await (await fetch(base+'/sitemap.xml')).text();
assert.match(sitemap,/<loc>https:\/\/dreamface\.io\/studio<\/loc>/);
assert.match(sitemap,/<loc>https:\/\/dreamface\.io\/gallery<\/loc>/);
assert.doesNotMatch(sitemap,/<loc>https:\/\/dreamface\.io\/(?:[\w-]+\/)?auth(?:[<\/])/);
console.log('Search metadata passed against local production: existing 16 login indexing settings, 32 marketing canonical/hreflang pages, robots, sitemap, Studio and Gallery query policies, About, auth redirect. No production traffic.');
