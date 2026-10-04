import { test,expect,type BrowserContext,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
async function login(context:BrowserContext,page:Page) {
  await context.setExtraHTTPHeaders({'cf-connecting-ip':'test-'+randomUUID()});
  const r=await context.request.post('/api/auth/sign-in/email',{headers:{Origin:'http://127.0.0.1:5173'},data:{email:'owner@example.com',password:'BeyondFog-test-password-2026'}});expect(r.status()).toBe(200);
  await page.goto('/');await expect(page.getByRole('button',{name:'我的空间'})).toBeVisible();
}
test('shortcut CRUD and button order sync across two browsers, logout clears private content',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage();await login(a,pa);await login(b,pb);
  await pa.getByRole('button',{name:'添加捷径',exact:true}).click();await pa.getByLabel('网站名称').fill('私人测试捷径');await pa.getByLabel('网站地址').fill('https://example.com/private');await pa.getByRole('button',{name:'保存捷径'}).click();await expect(pa.getByText('已同步',{exact:true})).toBeVisible();
  await pa.getByRole('button',{name:'上移 私人测试捷径'}).click();await expect(pa.getByText('已同步',{exact:true})).toBeVisible();
  await pb.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(pb.getByRole('link',{name:'私人测试捷径',exact:true})).toBeVisible();
  const titles=await pb.locator('.shortcut-link').allTextContents();expect(titles.indexOf('私人测试捷径')).toBe(titles.length-2);
  await pa.getByRole('button',{name:'编辑 私人测试捷径',exact:true}).click();await pa.getByLabel('网站名称').fill('修改后的私人捷径');await pa.getByRole('button',{name:'保存捷径'}).click();await expect(pa.getByText('已同步',{exact:true})).toBeVisible();
  await pa.getByRole('button',{name:'删除 修改后的私人捷径'}).click();await expect(pa.getByText('已同步',{exact:true})).toBeVisible();
  await pa.getByRole('button',{name:'添加',exact:true}).click();await pa.getByLabel('网站名称').fill('退出清除测试');await pa.getByLabel('网站地址').fill('https://example.com/logout');await pa.getByRole('button',{name:'保存捷径'}).click();await expect(pa.getByText('已同步',{exact:true})).toBeVisible();
  await pa.getByRole('button',{name:'账号',exact:true}).click();await pa.getByRole('button',{name:'退出登录',exact:true}).click();await expect(pa.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect(pa.getByRole('link',{name:'退出清除测试'})).toHaveCount(0);
  // Restore through the other session so tests leave clean preferences.
  const snap=await (await b.request.get('/api/preferences')).json() as any;await b.request.put('/api/preferences',{headers:{Origin:'http://127.0.0.1:5173'},data:{version:snap.version,data:{...snap.data,shortcuts:snap.data.shortcuts.filter((s:any)=>s.title!=='退出清除测试')}}});await a.close();await b.close();
});
test('a conflicting save preserves the local edit and offers explicit cloud reload',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage();await login(a,pa);await login(b,pb);
  let release!:()=>void;const barrier=new Promise<void>(r=>release=r);let arrived!:()=>void;const waiting=new Promise<void>(r=>arrived=r);
  await pa.route('**/api/preferences',async route=>{if(route.request().method()==='PUT'){arrived();await barrier;}await route.continue();});
  await pa.getByLabel('搜索引擎').selectOption('baidu');await waiting;
  await pb.getByLabel('搜索引擎').selectOption('bing');await pb.getByRole('button',{name:'打开设置'}).click();await expect(pb.getByText('已同步',{exact:true})).toBeVisible();release();
  await pa.getByRole('button',{name:'打开设置'}).click();await expect(pa.getByText('同步冲突',{exact:true})).toBeVisible();await expect(pa.getByLabel('搜索引擎',{exact:true})).toHaveValue('baidu');
  await pa.getByRole('button',{name:'加载云端（放弃本地编辑）'}).click();await expect(pa.getByLabel('搜索引擎',{exact:true})).toHaveValue('bing');
  await pa.getByLabel('默认搜索引擎').selectOption('google');await expect(pa.getByText('已同步',{exact:true})).toBeVisible();await a.close();await b.close();
});
test('focus refresh during a successful in-flight autosave does not flag an own-write conflict',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  let release!:()=>void;const barrier=new Promise<void>(r=>release=r);let arrived!:()=>void;const waiting=new Promise<void>(r=>arrived=r);
  await page.route('**/api/preferences',async route=>{if(route.request().method()==='PUT'){const r=await route.fetch();arrived();await barrier;await route.fulfill({response:r});}else await route.continue();});
  await page.getByLabel('搜索引擎').selectOption('bing');await waiting;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForResponse(r=>r.url().endsWith('/api/preferences')&&r.request().method()==='GET');release();
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await expect(page.getByText('已同步',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/设置同步冲突/})).toHaveCount(0);
  await page.unrouteAll();await page.getByLabel('默认搜索引擎').selectOption('google');await expect(page.getByText('已同步',{exact:true})).toBeVisible();await context.close();
});
test('session expiry removes a private shortcut editor from the page',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  await page.getByRole('button',{name:'添加捷径',exact:true}).click();await page.getByLabel('网站名称').fill('未保存的私人名称');
  expect((await context.request.post('/api/auth/sign-out',{headers:{Origin:'http://127.0.0.1:5173'},data:{}})).status()).toBe(200);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect(page.getByRole('dialog',{name:'设置'})).toHaveCount(0);await expect(page.getByLabel('网站名称')).toHaveCount(0);await context.close();
});
