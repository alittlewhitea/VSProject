import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map(),token='a'.repeat(64);
let cookie=token,requestHeaders=new Headers({'origin':'https://dreamface.invalid','host':'dreamface.invalid'}),deleted=0;
const mocks={
 'next/headers':{cookies:async()=>({get:name=>name==='dreamface_session'&&cookie?{value:cookie}:undefined,delete:name=>{if(name==='dreamface_session')cookie=null;}}),headers:async()=>requestHeaders},
 'next/server':{NextResponse:Response},
 './mysql':{toMysqlDate:value=>value,mysqlExecute:async(sql,args)=>{if(sql.startsWith('delete from sessions')){deleted++;return{};}return args[0]===native('node:crypto').createHash('sha256').update(token).digest('hex')?[{id:'fixture-user',email:'fixture@example.invalid',expires_at:'2099-01-01 00:00:00'}]:[];}},
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',source)(id=>id in mocks?mocks[id]:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);return module.exports;}
const original=process.env.NEXT_PUBLIC_APP_URL;process.env.NEXT_PUBLIC_APP_URL='https://dreamface.invalid';
try{
 const auth=load('src/lib/server-auth.ts'),sessionRoute=load('src/app/api/auth/session/route.ts'),logout=load('src/app/api/auth/logout/route.ts');
 const response=await sessionRoute.GET(),data=await response.json();assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(data.session.access_token.startsWith('cookie:'),true);assert.ok(!JSON.stringify(data).includes(token));
 const placeholder=data.session.access_token;
 assert.equal((await auth.getUserFromBearerToken('Bearer '+placeholder)).id,'fixture-user');cookie=null;assert.equal(await auth.getUserFromBearerToken('Bearer '+placeholder),null);
 assert.equal((await auth.getUserFromBearerToken('Bearer '+token)).id,'fixture-user','Non-browser bearer clients remain supported');cookie=token;
 assert.equal(await auth.getUserFromBearerToken('Bearer invalid-token'),null,'Invalid bearer cannot fall through to a cookie');
 for(const origin of ['https://evil.invalid','http://dreamface.invalid','null']){requestHeaders=new Headers({origin,host:'dreamface.invalid','x-forwarded-host':'evil.invalid'});assert.equal(await auth.getUserFromBearerToken('Bearer '+placeholder),null);assert.equal((await logout.POST(new Request('https://dreamface.invalid/api/auth/logout',{method:'POST',headers:requestHeaders}))).status,403);}
 assert.equal(deleted,0);requestHeaders=new Headers({origin:'https://dreamface.invalid',host:'127.0.0.1:3000'});assert.equal((await auth.getUserFromBearerToken('Bearer '+placeholder)).id,'fixture-user');
 const result=await logout.POST(new Request('https://dreamface.invalid/api/auth/logout',{method:'POST',headers:{origin:'https://dreamface.invalid'}}));assert.equal(result.status,200);assert.equal(deleted,1);assert.equal(cookie,null);
 console.log('Session security passed: actual session GET and server auth, no browser credential, cookie placeholders, real bearer compatibility, invalid bearer isolation, strict scheme/origin, spoofed proxy hosts, protected logout and no-store. Session store and request context mocked.');
}finally{if(original===undefined)delete process.env.NEXT_PUBLIC_APP_URL;else process.env.NEXT_PUBLIC_APP_URL=original;}
