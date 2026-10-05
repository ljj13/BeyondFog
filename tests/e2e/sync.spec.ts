import { chooseEngine } from './engine-helper';
import { test,expect,type BrowserContext,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { defaults } from '../../src/shared/preferences';
test.beforeEach(async({playwright})=>{
  const c=await playwright.request.newContext({baseURL:'http://127.0.0.1:5173',extraHTTPHeaders:{Origin:'http://127.0.0.1:5173','cf-connecting-ip':'fixture-'+randomUUID()}});
  expect((await c.post('/api/auth/sign-in/email',{data:{email:'owner@example.com',password:'BeyondFog-test-password-2026'}})).status()).toBe(200);
  const snap=await (await c.get('/api/preferences')).json() as any;expect((await c.put('/api/preferences',{data:{version:snap.version,data:defaults}})).status()).toBe(200);await c.dispose();
});
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
  const titles=await pb.locator('.shortcut-link > span:last-child').allTextContents();expect(titles.indexOf('私人测试捷径')).toBe(titles.length-2);
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
  await chooseEngine(pa, '搜索引擎', '百度');await waiting;
  await chooseEngine(pb, '搜索引擎', '必应');await pb.getByRole('button',{name:'打开设置'}).click();await expect(pb.getByText('已同步',{exact:true})).toBeVisible();release();
  await pa.getByRole('button',{name:'打开设置'}).click();await expect(pa.getByText('同步冲突',{exact:true})).toBeVisible();await expect(pa.getByLabel('搜索引擎',{exact:true})).toHaveText('百度');
  await pa.getByRole('button',{name:'加载云端（放弃本地编辑）'}).click();await expect(pa.getByLabel('搜索引擎',{exact:true})).toHaveText('必应');
  await chooseEngine(pa, '默认搜索引擎', 'Google');await expect(pa.getByText('已同步',{exact:true})).toBeVisible();await a.close();await b.close();
});
test('focus refresh during a successful in-flight autosave does not flag an own-write conflict',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  let release!:()=>void;const barrier=new Promise<void>(r=>release=r);let arrived!:()=>void;const waiting=new Promise<void>(r=>arrived=r);
  await page.route('**/api/preferences',async route=>{if(route.request().method()==='PUT'){const r=await route.fetch();arrived();await barrier;await route.fulfill({response:r});}else await route.continue();});
  await chooseEngine(page, '搜索引擎', '必应');await waiting;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForResponse(r=>r.url().endsWith('/api/preferences')&&r.request().method()==='GET');release();
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await expect(page.getByText('已同步',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/设置同步冲突/})).toHaveCount(0);
  await page.unrouteAll();await chooseEngine(page, '默认搜索引擎', 'Google');await expect(page.getByText('已同步',{exact:true})).toBeVisible();await context.close();
});
test('session expiry removes a private shortcut editor from the page',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  await page.getByRole('button',{name:'添加捷径',exact:true}).click();await page.getByLabel('网站名称').fill('未保存的私人名称');
  expect((await context.request.post('/api/auth/sign-out',{headers:{Origin:'http://127.0.0.1:5173'},data:{}})).status()).toBe(200);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect(page.getByRole('dialog',{name:'设置'})).toHaveCount(0);await expect(page.getByLabel('网站名称')).toHaveCount(0);await context.close();
});
test('a delayed focus snapshot cannot replace a newer completed save',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  let release!:()=>void;const barrier=new Promise<void>(r=>release=r);let arrived!:()=>void;const waiting=new Promise<void>(r=>arrived=r);let hold=true;
  await page.route('**/api/preferences',async route=>{if(hold&&route.request().method()==='GET'){hold=false;const response=await route.fetch();arrived();await barrier;await route.fulfill({response});}else await route.continue();});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await waiting;
  await chooseEngine(page, '搜索引擎', '必应');await page.getByRole('button',{name:'打开设置',exact:true}).click();await expect(page.getByText('已同步',{exact:true})).toBeVisible();
  const delivered=page.waitForResponse(r=>r.url().endsWith('/api/preferences')&&r.request().method()==='GET');release();await delivered;
  await expect(page.getByLabel('搜索引擎',{exact:true})).toHaveText('必应');
  await page.unrouteAll();await chooseEngine(page, '默认搜索引擎', 'Google');await expect(page.getByText('已同步',{exact:true})).toBeVisible();await context.close();
});
test('logout drains an edit still waiting for autosave debounce',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  await page.getByRole('button',{name:'打开设置',exact:true}).click();
  await chooseEngine(page, '默认搜索引擎', '百度');
  await page.getByRole('button',{name:'账号',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
  await login(context,page);await expect(page.getByLabel('搜索引擎')).toHaveText('百度');
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await chooseEngine(page, '默认搜索引擎', 'Google');await expect(page.getByText('已同步',{exact:true})).toBeVisible();await context.close();
});
test('logout drains a second edit while an earlier save response is delayed',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  let release!:()=>void;const barrier=new Promise<void>(r=>release=r);let arrived!:()=>void;const waiting=new Promise<void>(r=>arrived=r);let hold=true;
  await page.route('**/api/preferences',async route=>{if(hold&&route.request().method()==='PUT'){hold=false;const response=await route.fetch();arrived();await barrier;await route.fulfill({response});}else await route.continue();});
  await chooseEngine(page, '搜索引擎', '必应');await waiting;await chooseEngine(page, '搜索引擎', '百度');
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await page.getByRole('button',{name:'账号',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();release();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
  await page.unrouteAll();await login(context,page);await expect(page.getByLabel('搜索引擎')).toHaveText('百度');
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await chooseEngine(page, '默认搜索引擎', 'Google');await expect(page.getByText('已同步',{exact:true})).toBeVisible();await context.close();
});
test('failed final save retains edits until explicit discard and logout',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  await page.route('**/api/preferences',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'测试网络故障'}}):route.continue());
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await chooseEngine(page, '默认搜索引擎', '百度');await page.getByRole('button',{name:'账号',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();
  await expect(page.getByText(/尚有未保存的编辑/)).toBeVisible();await expect(page.getByRole('button',{name:'我的空间'})).toBeVisible();await expect(page.getByLabel('搜索引擎',{exact:true})).toHaveText('百度');
  await page.getByRole('button',{name:'放弃本地编辑并退出',exact:true}).click();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();await context.close();
});
test('shortcut capacity is visible and both addition entry points are disabled',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);
  const snap=await (await context.request.get('/api/preferences')).json() as any;
  const shortcuts=Array.from({length:100},(_,i)=>({id:'item-'+i,title:'网站 '+i,url:'https://example.com/'+i}));
  expect((await context.request.put('/api/preferences',{headers:{Origin:'http://127.0.0.1:5173'},data:{version:snap.version,data:{...defaults,shortcuts}}})).status()).toBe(200);
  await page.reload();await expect(page.getByRole('button',{name:'添加捷径',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'整理捷径'}).click();await expect(page.getByRole('button',{name:'添加',exact:true})).toBeDisabled();await context.close();
});


test('folder preferences synchronize, conflicts retain local folders and logout clears the popup',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage(); await login(a,pa);await login(b,pb);
  await pa.getByRole('button',{name:'整理捷径',exact:true}).click();
  await pa.getByRole('button',{name:'新建文件夹',exact:true}).click();await pa.getByLabel('文件夹名称',{exact:true}).fill('私人工作');await pa.getByRole('button',{name:'保存文件夹',exact:true}).click();
  await pa.getByRole('button',{name:'编辑 GitHub',exact:true}).click();await pa.getByLabel('所属文件夹',{exact:true}).selectOption({label:'私人工作'});await pa.getByRole('button',{name:'保存捷径',exact:true}).click();
  await pa.getByRole('radio',{name:'文件夹模式',exact:true}).check();await expect(pa.getByText('已同步',{exact:true})).toBeVisible();
  await pb.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(pb.getByRole('button',{name:'文件夹 私人工作',exact:true})).toBeVisible();
  await pb.getByRole('button',{name:'文件夹 私人工作',exact:true}).click();await expect(pb.getByRole('region',{name:'私人工作中的网站'}).getByRole('link',{name:'GitHub',exact:true})).toBeVisible();
  let release!:()=>void,arrived!:()=>void;const barrier=new Promise<void>(r=>release=r),waiting=new Promise<void>(r=>arrived=r);
  await pa.route('**/api/preferences',async r=>{if(r.request().method()==='PUT'){arrived();await barrier;}await r.continue();});
  await pa.getByRole('button',{name:'重命名文件夹 私人工作',exact:true}).click();await pa.getByLabel('文件夹名称',{exact:true}).fill('本地文件夹');await pa.getByRole('button',{name:'保存文件夹',exact:true}).click();await waiting;
  await pb.getByRole('button',{name:'整理捷径',exact:true}).click();await pb.getByRole('button',{name:'重命名文件夹 私人工作',exact:true}).click();await pb.getByLabel('文件夹名称',{exact:true}).fill('云端文件夹');await pb.getByRole('button',{name:'保存文件夹',exact:true}).click();await expect(pb.getByText('已同步',{exact:true})).toBeVisible();release();
  await expect(pa.getByText('同步冲突',{exact:true})).toBeVisible();await expect(pa.locator('.folder-row-name')).toHaveText('本地文件夹');
  await pa.getByRole('button',{name:'加载云端（放弃本地编辑）',exact:true}).click();await expect(pa.locator('.folder-row-name')).toHaveText('云端文件夹');
  await pa.getByRole('button',{name:'关闭设置',exact:true}).click();await pa.getByRole('button',{name:'文件夹 云端文件夹',exact:true}).click();await expect(pa.getByRole('region',{name:'云端文件夹中的网站'})).toBeVisible();
  expect((await a.request.post('/api/auth/sign-out',{headers:{Origin:'http://127.0.0.1:5173'},data:{}})).status()).toBe(200);await pa.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(pa.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect(pa.getByRole('region',{name:'云端文件夹中的网站'})).toHaveCount(0);await expect(pa.getByRole('button',{name:'文件夹 云端文件夹',exact:true})).toHaveCount(0);await expect(pa.getByRole('link',{name:'GitHub',exact:true})).toBeVisible();await a.close();await b.close();
});

test('100 sites scroll in a bounded popup, 20 folders cap creation, edges and zoom flip upward',async({browser})=>{
  const context=await browser.newContext({viewport:{width:900,height:600}}),page=await context.newPage();await login(context,page);
  const snap=await (await context.request.get('/api/preferences')).json() as any;
  const folders=Array.from({length:20},(_,i)=>({id:'f'+i,name:'文件夹 '+i})),shortcuts=Array.from({length:100},(_,i)=>({id:'s'+i,title:'网站 '+i,url:'https://example.com/'+i,folderId:'f19'}));
  expect((await context.request.put('/api/preferences',{headers:{Origin:'http://127.0.0.1:5173'},data:{version:snap.version,data:{...defaults,shortcutLayout:'folders',folders,shortcuts}}})).status()).toBe(200);
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'添加文件夹',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'文件夹 文件夹 19',exact:true}).click();const popup=page.getByRole('region',{name:'文件夹 19中的网站'});await expect(popup).toBeVisible();
  await expect(popup).toHaveAttribute('data-direction','up');
  const box=await popup.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(12);expect(box!.x+box!.width).toBeLessThanOrEqual(888);expect(box!.y).toBeGreaterThanOrEqual(12);expect(box!.y+box!.height).toBeLessThanOrEqual(588);
  const scroll=popup.locator('.folder-popup-scroll');expect(await scroll.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);await expect(popup.getByRole('button',{name:'添加网站',exact:true})).toBeDisabled();
  await popup.getByRole('link',{name:'网站 99',exact:true}).focus();await expect(popup.getByRole('link',{name:'网站 99',exact:true})).toBeInViewport();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'整理捷径',exact:true}).click();await expect(page.getByRole('button',{name:'新建文件夹',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'添加',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'关闭设置',exact:true}).click();await page.evaluate(()=>{document.documentElement.style.zoom='1.5';});
  await page.getByRole('button',{name:'文件夹 文件夹 19',exact:true}).click();await expect(popup).toBeVisible();const zoomBox=await popup.boundingBox();expect(zoomBox!.x+zoomBox!.width).toBeLessThanOrEqual(900);expect(zoomBox!.y+zoomBox!.height).toBeLessThanOrEqual(600);await context.close();
});


test('an open editor handles capacity and deleted folder after a cloud refresh without crashing',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await login(context,page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'整理捷径',exact:true}).click();await page.getByRole('button',{name:'新建文件夹',exact:true}).click();await page.getByLabel('文件夹名称',{exact:true}).fill('稍后保存');
  let snap=await (await context.request.get('/api/preferences')).json() as any;
  const folders=Array.from({length:20},(_,i)=>({id:'f'+i,name:'远端 '+i}));
  expect((await context.request.put('/api/preferences',{headers:{Origin:'http://127.0.0.1:5173'},data:{version:snap.version,data:{...defaults,folders}}})).status()).toBe(200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.folder-row-name')).toHaveCount(20);
  await page.getByRole('button',{name:'保存文件夹',exact:true}).click();await expect(page.getByRole('alert')).toContainText('最多 20');expect(errors).toEqual([]);
  await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'编辑 GitHub',exact:true}).click();await page.getByLabel('所属文件夹',{exact:true}).selectOption('f0');
  snap=await (await context.request.get('/api/preferences')).json() as any;
  expect((await context.request.put('/api/preferences',{headers:{Origin:'http://127.0.0.1:5173'},data:{version:snap.version,data:defaults}})).status()).toBe(200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.folder-row-name')).toHaveCount(0);
  await page.getByRole('button',{name:'保存捷径',exact:true}).click();await expect(page.getByText('已同步',{exact:true})).toBeVisible();expect(errors).toEqual([]);
  expect((await (await context.request.get('/api/preferences')).json() as any).data.shortcuts[0].folderId).toBe(null);await context.close();
});
