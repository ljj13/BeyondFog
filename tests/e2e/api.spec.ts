import { test,expect } from '@playwright/test';
import { defaults } from '../../src/shared/preferences';
const origin='http://127.0.0.1:5173';
let n=10;
test('old preference clients cannot overwrite manual folder icons',async({playwright})=>{
  const client=await playwright.request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin,'cf-connecting-ip':`icon-fixture-${Date.now()}`}});
  expect((await client.post('/api/auth/sign-in/email',{data:{email:'owner@example.com',password:'BeyondFog-test-password-2026'}})).status()).toBe(200);
  const snap=await (await client.get('/api/preferences')).json() as any;
  for(const schemaVersion of [undefined,1,3]) {
    const r=await client.put('/api/preferences',{data:{schemaVersion,version:snap.version,data:defaults}});
    expect(r.status()).toBe(409);expect((await r.json()).error).toContain('刷新');
  }
  expect((await (await client.get('/api/preferences')).json()).version).toBe(snap.version);
  const data={...defaults,folders:[{id:'mail-test',name:'邮箱',icon:'heart'}]};
  expect((await client.put('/api/preferences',{data:{schemaVersion:2,version:snap.version,data}})).status()).toBe(200);
  const manual=await (await client.get('/api/preferences')).json() as any;
  expect(manual.data.folders[0].icon).toBe('heart');
  const old={...manual.data,folders:[{id:'mail-test',name:'邮箱'}]};
  expect((await client.put('/api/preferences',{data:{version:manual.version,data:old}})).status()).toBe(409);
  expect((await (await client.get('/api/preferences')).json()).data.folders[0].icon).toBe('heart');
  expect((await client.put('/api/preferences',{data:{schemaVersion:2,version:manual.version,data:defaults}})).status()).toBe(200);
  await client.dispose();
});
test('private routes require a session; signup and cross-origin writes are blocked',async({request})=>{
  for(const path of ['/api/preferences','/api/webdav/connection','/api/webdav/files','/api/webdav/image?file=a.jpg']) {const r=await request.get(path);expect(r.status()).toBe(401);expect(r.headers()['cache-control']).toContain('no-store');}
  expect((await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data:{email:'intruder@example.com',password:'Strong-example-password',name:'x'}})).status()).toBe(403);
  expect((await request.put('/api/preferences',{headers:{Origin:'https://evil.example'},data:{schemaVersion:2,version:0,data:defaults}})).status()).toBe(403);
});
test('auth JSON requests are bounded before parsing',async({request})=>{
  expect((await request.post('/api/auth/sign-in/email',{headers:{Origin:origin},data:{email:'owner@example.com',password:'x'.repeat(70000)}})).status()).toBe(413);
});
test('wrong password fails and repeated login attempts are limited',async({playwright})=>{
  const client=await playwright.request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin,'cf-connecting-ip':'198.51.100.9'}});
  let limited=false;
  for(let i=0;i<9;i++){const r=await client.post('/api/auth/sign-in/email',{data:{email:'owner@example.com',password:'wrong-password'}});if(r.status()===429)limited=true;else expect(r.status()).toBe(401);}
  expect(limited).toBe(true);await client.dispose();
});
test('two sessions perform atomic version saves and logout invalidates access',async({playwright})=>{
  const a=await playwright.request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin,'cf-connecting-ip':`198.51.100.${n++}`}}),b=await playwright.request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin,'cf-connecting-ip':`198.51.100.${n++}`}});
  for(const c of [a,b]) {const r=await c.post('/api/auth/sign-in/email',{data:{email:'owner@example.com',password:'BeyondFog-test-password-2026'}});expect(r.status()).toBe(200);expect(r.headers()['set-cookie']).toContain('HttpOnly');expect(r.headers()['set-cookie']).toContain('SameSite=Lax');}
  const state=await (await a.get('/api/preferences')).json() as any;
  const [one,two]=await Promise.all([a.put('/api/preferences',{data:{schemaVersion:2,version:state.version,data:{...defaults,engine:'bing'}}}),b.put('/api/preferences',{data:{schemaVersion:2,version:state.version,data:{...defaults,engine:'baidu'}}})]);
  expect([one.status(),two.status()].sort()).toEqual([200,409]);
  const winner=await (await a.get('/api/preferences')).json() as any;
  expect(winner.version).toBe(state.version+1);
  const legacy={...defaults} as Record<string,unknown>;delete legacy.shortcutLayout;delete legacy.folders;
  const rejected=await a.put('/api/preferences',{data:{schemaVersion:2,version:winner.version,data:legacy}});
  expect(rejected.status()).toBe(409);expect((await rejected.json()).error).toContain('刷新');
  expect((await (await a.get('/api/preferences')).json()).version).toBe(winner.version);
  expect((await a.put('/api/preferences',{data:{schemaVersion:2,version:winner.version,data:defaults}})).status()).toBe(200);
  const config=await (await a.get('/api/webdav/connection')).json() as any;
  expect((await a.put('/api/webdav/connection',{data:{version:config.version,endpoint:'https://dav.jianguoyun.com/dav/',username:'test@example.com',password:'not-real-secret',directory:'BeyondFog/wallpapers'}})).status()).toBe(200);
  const saved=await (await a.get('/api/webdav/connection')).json() as any;
  expect(JSON.stringify(saved)).not.toContain('not-real-secret');expect(saved.configured).toBe(true);
  expect((await a.put('/api/webdav/connection',{data:{version:saved.version,endpoint:'https://169.254.169.254/',username:'x',password:'x',directory:'BeyondFog'}})).status()).toBe(400);
  expect((await a.put('/api/webdav/connection',{data:{version:saved.version,endpoint:'https://evil.example.com/',username:'x',password:'x',directory:'BeyondFog'}})).status()).toBe(400);
  expect((await a.get('/api/webdav/image?file=..%2Fsecret.jpg')).status()).toBe(400);
  expect((await a.post('/api/webdav/upload',{headers:{'X-File-Size':String(20*1024*1024+1)},data:Buffer.from('oversize')})).status()).toBe(413);
  expect((await a.delete('/api/webdav/connection',{data:{version:saved.version}})).status()).toBe(200);
  expect((await a.post('/api/auth/sign-out',{data:{}})).status()).toBe(200);
  expect((await a.get('/api/preferences')).status()).toBe(401);
  expect((await b.get('/api/preferences')).status()).toBe(200);
  await a.dispose();await b.dispose();
});
