import { strict as assert } from 'node:assert';
import { fetch,ProxyAgent } from 'undici';
const origin='https://beyondfog.cc.cd';
const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY,dispatcher=proxy?new ProxyAgent(proxy):undefined;
async function call(path,method='GET',data) {return fetch(origin+path,{method,dispatcher,signal:AbortSignal.timeout(30000),headers:data===undefined?{}:{Origin:origin,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});}
const homepage=await call('/');assert.equal(homepage.status,200);
assert.equal(homepage.headers.get('referrer-policy'),'no-referrer');assert.equal(homepage.headers.get('x-frame-options'),'DENY');assert(homepage.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
const html=await homepage.text();assert(html.includes('BeyondFog'));console.log('HTTPS 首页与文档安全响应头：通过');
const asset=html.match(/src="([^"]+\.js)"/)?.[1];assert(asset);
const bundle=await call(asset);assert.equal(bundle.status,200);assert(!(await bundle.text()).includes('fogpurification@gmail.com'));console.log('前端资源与私人账号信息隔离：通过');
const session=await call('/api/auth/get-session');assert.equal(session.status,200);assert.equal(await session.json(),null);
for(const path of ['/api/preferences','/api/webdav/connection','/api/webdav/files']) {const r=await call(path);assert.equal(r.status,401);assert(r.headers.get('cache-control')?.includes('no-store'));await r.body?.cancel();}
console.log('未登录私人接口与禁止缓存：通过');
const signup=await call('/api/auth/sign-up/email','POST',{email:'intruder@example.com',password:'Test-only-password-2026',name:'x'});assert.equal(signup.status,403);await signup.body?.cancel();
const started=Date.now();const wrong=await call('/api/auth/sign-in/email','POST',{email:'fogpurification@gmail.com',password:'Not-the-owner-password-2026'});assert.equal(wrong.status,401);await wrong.body?.cancel();console.log(`公开注册关闭与真实账号错误密码：通过（往返 ${Date.now()-started} ms）`);
if(process.argv.includes('--send-reset')) {const reset=await call('/api/auth/request-password-reset','POST',{email:'fogpurification@gmail.com',redirectTo:origin});if(reset.status!==200)console.log('重置邮件失败状态：',reset.status,await reset.text());assert.equal(reset.status,200);await reset.body?.cancel();console.log('已请求发送一封真实密码重置邮件；请由邮箱持有人确认收件。');}
