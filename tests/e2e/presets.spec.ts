import { test, expect, type Page } from '@playwright/test';
import { defaults, preferencesSchema } from '../../src/shared/preferences';

async function settings(page:Page){await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'整理捷径',exact:true}).click();}
async function addFolder(page:Page,name:string){await page.getByRole('button',{name:'新建文件夹',exact:true}).click();await page.getByLabel('文件夹名称',{exact:true}).fill(name);await page.getByRole('button',{name:'保存文件夹',exact:true}).click();}

test('folder pickers use glass options, icons/counts, keyboard and first Escape preserves settings',async({page})=>{
  await settings(page);await addFolder(page,'邮箱');await page.getByRole('button',{name:'编辑 Gmail',exact:true}).click();
  const picker=page.getByRole('combobox',{name:'所属文件夹',exact:true});await picker.click();const menu=page.getByRole('listbox',{name:'所属文件夹',exact:true});await expect(menu).toBeVisible();
  expect(await menu.evaluate(e=>getComputedStyle(e).borderRadius)).toBe('14px');await expect(menu.getByRole('option',{name:'邮箱',exact:true})).toBeVisible();await expect(menu.getByRole('option',{name:'邮箱',exact:true}).locator('svg')).toHaveCount(1);
  await picker.press('End');await picker.press('Enter');await expect(picker).toContainText('邮箱');await expect(page.getByLabel('网站名称')).toHaveValue('Gmail');
  await picker.press('ArrowDown');await picker.press('Escape');await expect(menu).toBeHidden();await expect(page.getByRole('dialog',{name:'设置'})).toBeVisible();
  await page.getByRole('button',{name:'保存捷径',exact:true}).click();
  const filter=page.getByRole('combobox',{name:'查看文件夹',exact:true});await filter.click();await page.getByRole('listbox',{name:'查看文件夹',exact:true}).getByRole('option',{name:'邮箱',exact:true}).click();
  await expect(page.locator('.shortcut-list .shortcut-row')).toHaveCount(1);await expect(page.locator('.shortcut-list strong')).toHaveText('Gmail');
});

test('preset checkboxes span categories, move existing unclassified, import once and preserve layout',async({page})=>{
  await settings(page);await page.getByRole('button',{name:'添加常用网站',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'选择 Gmail',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'选择 Outlook',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'预设分类 购物',exact:true}).click();await page.getByRole('checkbox',{name:'选择 京东',exact:true}).check();
  await page.getByRole('button',{name:'预设分类 邮箱',exact:true}).click();await expect(page.getByRole('checkbox',{name:'选择 Outlook',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'添加所选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已添加'})).toContainText('4');
  expect(await page.locator('.folder-row-name').allTextContents()).toEqual(['邮箱','购物']);await expect(page.getByRole('radio',{name:'平铺模式',exact:true})).toBeChecked();await expect(page.locator('.shortcut-list strong').filter({hasText:/^Gmail$/})).toHaveCount(1);
  await page.getByRole('button',{name:'添加所选',exact:true}).click();await expect(page.locator('.shortcut-list .shortcut-row')).toHaveCount(9);
  await page.getByRole('button',{name:'重命名文件夹 邮箱',exact:true}).click();await page.getByRole('button',{name:'文件夹图标 爱心',exact:true}).click();await page.getByLabel('文件夹名称',{exact:true}).fill('私人信箱');await page.getByRole('button',{name:'保存文件夹',exact:true}).click();
  await page.getByRole('radio',{name:'文件夹模式',exact:true}).check();await page.getByRole('button',{name:'关闭设置',exact:true}).click();const mail=page.getByRole('button',{name:'文件夹 私人信箱',exact:true});await expect(mail.locator('svg')).toHaveAttribute('data-folder-icon','heart');await mail.click();await expect(page.getByRole('region',{name:'私人信箱中的网站'}).getByRole('link',{name:'Gmail',exact:true})).toBeVisible();
});

test('long folder menus fit touch screens, scroll the active option and retain drafts across tabs',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:600},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
  const data=preferencesSchema.parse({...defaults,folders:Array.from({length:20},(_,i)=>({id:'f'+i,name:'邮箱 '+i}))});
  await page.route('**/api/auth/get-session',r=>r.fulfill({json:{user:{id:'fixture',email:'fixture@example.com',name:'Fixture'}}}));
  await page.route('**/api/preferences',r=>r.fulfill({json:{version:1,data}}));
  await settings(page);await page.getByRole('button',{name:'编辑 Gmail',exact:true}).click();await page.getByLabel('网站名称').fill('手机草稿');
  const picker=page.getByRole('combobox',{name:'所属文件夹',exact:true});await picker.tap();const menu=page.getByRole('listbox',{name:'所属文件夹',exact:true});await expect(menu).toBeVisible();
  const box=(await menu.boundingBox())!,panel=(await page.locator('.panel-content').boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(382);expect(box.y).toBeGreaterThanOrEqual(panel.y);expect(box.y+box.height).toBeLessThanOrEqual(Math.min(600,panel.y+panel.height));
  expect(await menu.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);expect((await menu.getByRole('option',{name:'邮箱 0',exact:true}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await picker.press('End');await expect(menu.getByRole('option',{name:'邮箱 19',exact:true})).toBeInViewport();await picker.press('Tab');await expect(picker).toContainText('邮箱 19');await expect(page.getByRole('button',{name:'保存捷径',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'外观',exact:true}).tap();await page.getByRole('button',{name:'捷径',exact:true}).tap();await expect(page.getByLabel('网站名称')).toHaveValue('手机草稿');await expect(picker).toContainText('邮箱 19');
  await picker.tap();await page.getByLabel('网站名称').tap();await expect(menu).toBeHidden();await expect(page.getByRole('dialog',{name:'设置'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});

test('preset capacity rejection leaves the whole cloud snapshot unchanged',async({page})=>{
  const data=preferencesSchema.parse({...defaults,shortcuts:Array.from({length:100},(_,i)=>({id:'s'+i,title:'站点'+i,url:'https://example.com/'+i}))});let writes=0;
  await page.route('**/api/auth/get-session',r=>r.fulfill({json:{user:{id:'fixture',email:'fixture@example.com',name:'Fixture'}}}));
  await page.route('**/api/preferences',r=>{if(r.request().method()==='PUT')writes++;return r.fulfill({json:{version:1,data}});});
  await settings(page);await expect(page.locator('.shortcut-list .shortcut-row')).toHaveCount(100);await page.getByRole('button',{name:'添加常用网站',exact:true}).click();await expect(page.getByRole('alert')).toContainText('最多 100');await expect(page.getByRole('button',{name:'添加所选',exact:true})).toBeDisabled();await page.waitForTimeout(650);expect(writes).toBe(0);await expect(page.locator('.folder-row-name')).toHaveCount(0);
});

test('repeating an already imported selection does not save or create a new cloud revision',async({page})=>{
  let data=structuredClone(defaults),version=1,writes=0;
  await page.route('**/api/auth/get-session',r=>r.fulfill({json:{user:{id:'fixture',email:'fixture@example.com',name:'Fixture'}}}));
  await page.route('**/api/preferences',r=>{if(r.request().method()==='PUT'){writes++;data=r.request().postDataJSON().data;version++;}return r.fulfill({json:{version,data}});});
  await settings(page);await page.getByRole('button',{name:'添加常用网站',exact:true}).click();await page.getByRole('button',{name:'添加所选',exact:true}).click();await expect(page.getByText('已同步',{exact:true})).toBeVisible();expect(writes).toBe(1);
  await page.getByRole('button',{name:'添加所选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'无需重复'})).toBeVisible();await page.waitForTimeout(700);expect(writes).toBe(1);expect(version).toBe(2);
});
