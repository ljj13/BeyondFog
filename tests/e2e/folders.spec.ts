import { test, expect, type Page } from '@playwright/test';

async function folder(page: Page, name: string) {
  await page.getByRole('button', { name: '新建文件夹', exact: true }).click();
  await page.getByLabel('文件夹名称', { exact: true }).fill(name);
  await page.getByRole('button', { name: '保存文件夹', exact: true }).click();
}
async function assign(page: Page, title: string, name: string) {
  await page.getByRole('button', { name: `编辑 ${title}`, exact: true }).click();
  await page.getByLabel('所属文件夹', { exact: true }).selectOption({ label: name });
  await page.getByRole('button', { name: '保存捷径', exact: true }).click();
}
async function setup(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '整理捷径', exact: true }).click();
  await folder(page, '工作'); await folder(page, '娱乐'); await assign(page, 'GitHub', '工作');
  await page.getByRole('radio', { name: '文件夹模式', exact: true }).check();
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
}

test('folder CRUD and layout switches preserve URLs, membership and order', async ({ page }) => {
  await setup(page);
  const work = page.getByRole('button', { name: '文件夹 工作', exact: true });
  await work.hover();
  const popup = page.getByRole('region', { name: '工作中的网站', exact: true });
  await expect(popup).toBeVisible(); await expect(popup.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/');
  await popup.hover(); await page.waitForTimeout(300); await expect(popup).toBeVisible();
  await page.mouse.move(0, 0); await expect(popup).toBeHidden();
  await page.getByRole('button', { name: '整理捷径', exact: true }).click();
  await page.getByRole('radio', { name: '平铺模式', exact: true }).check();
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  expect(await page.locator('.shortcut-link > span:last-child').allTextContents()).toEqual(['GitHub', 'Gmail', '哔哩哔哩', '维基百科', 'Cloudflare']);
  await page.getByRole('button', { name: '整理捷径', exact: true }).click();
  await page.getByRole('button', { name: '重命名文件夹 工作', exact: true }).click();
  await page.getByLabel('文件夹名称', { exact: true }).fill('开发'); await page.getByRole('button', { name: '保存文件夹', exact: true }).click();
  await page.getByRole('button', { name: '上移文件夹 娱乐', exact: true }).click();
  expect(await page.locator('.folder-row-name').allTextContents()).toEqual(['娱乐', '开发']);
  await page.getByRole('button', { name: '删除文件夹 开发', exact: true }).click();
  await expect(page.getByText('网站将移至未分类，网站不会被删除。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '确定删除文件夹', exact: true }).click();
  await page.getByRole('radio', { name: '文件夹模式', exact: true }).check();
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  await page.getByRole('button', { name: '文件夹 未分类', exact: true }).click();
  await expect(page.getByRole('region', { name: '未分类中的网站' }).getByRole('link', { name: 'GitHub', exact: true })).toBeVisible();
});

test('folder keyboard, hover and focus keep one usable popup and Escape restores focus', async ({ page }) => {
  await setup(page); const work=page.getByRole('button',{name:'文件夹 工作',exact:true});
  await work.focus(); await page.keyboard.press('Enter'); const popup=page.getByRole('region',{name:'工作中的网站'});
  await expect(popup).toBeVisible(); await page.keyboard.press('Tab');
  await expect(popup.getByRole('link',{name:'GitHub',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'文件夹 娱乐',exact:true}).hover(); await page.waitForTimeout(350); await expect(popup).toBeVisible(); await expect(popup.getByRole('link',{name:'GitHub',exact:true})).toBeFocused();
  await page.mouse.move(0,0); await page.waitForTimeout(350); await expect(popup).toBeVisible();
  await page.keyboard.press('Escape'); await expect(work).toBeFocused(); await expect(popup).toBeHidden();
  await page.getByRole('button',{name:'文件夹 娱乐',exact:true}).hover(); await expect(page.getByRole('region',{name:'娱乐中的网站'})).toBeVisible();
  await expect(page.getByRole('region',{name:'娱乐中的网站'}).getByText('暂无网站')).toBeVisible();
  await work.hover(); await expect(popup).toBeVisible(); await expect(page.getByRole('region',{name:'娱乐中的网站'})).toBeHidden();
  await page.getByRole('button',{name:'打开设置',exact:true}).click(); await expect(popup).toBeHidden();
});

test('touch folder toggles, outside dismissal and narrow viewport remain usable with reduced motion', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage(); await setup(page);
  const work=page.getByRole('button',{name:'文件夹 工作',exact:true}); await work.tap();
  const popup=page.getByRole('region',{name:'工作中的网站'}); await expect(popup).toBeVisible();
  const box=await popup.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(12); expect(box!.x+box!.width).toBeLessThanOrEqual(378);
  expect(await popup.evaluate(e=>getComputedStyle(e).animationDuration)).toBe('0s');
  await work.tap(); await expect(popup).toBeHidden(); await work.tap(); await page.getByRole('searchbox').tap(); await expect(popup).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); await context.close();
});


test('folder and filtered website drag and button ordering preserve other groups', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: '整理捷径', exact: true }).click();
  await assign(page, '哔哩哔哩', '工作'); await assign(page, 'Cloudflare', '工作');
  await page.getByLabel('查看文件夹', {exact:true}).selectOption({label:'工作'});
  await page.getByRole('button', { name: '上移 Cloudflare', exact:true }).click();
  let rows=page.locator('.shortcut-list .shortcut-row');
  await rows.filter({hasText:'GitHub'}).dragTo(rows.filter({hasText:'Cloudflare'}));
  expect(await rows.locator('strong').allTextContents()).toEqual(['Cloudflare','GitHub','哔哩哔哩']);
  const folders=page.locator('.folder-settings-list .shortcut-row');
  await folders.filter({hasText:'工作'}).dragTo(folders.filter({hasText:'娱乐'}));
  expect(await page.locator('.folder-row-name').allTextContents()).toEqual(['娱乐','工作']);
  await page.getByRole('radio',{name:'平铺模式',exact:true}).check();
  await page.getByRole('button',{name:'关闭设置',exact:true}).click();
  expect(await page.locator('.shortcut-link > span:last-child').allTextContents()).toEqual(['Cloudflare','Gmail','GitHub','维基百科','哔哩哔哩']);
  await page.getByRole('button',{name:'整理捷径',exact:true}).click();
  await page.getByRole('radio',{name:'文件夹模式',exact:true}).check(); await page.getByRole('button',{name:'关闭设置',exact:true}).click();
  await page.getByRole('button',{name:'文件夹 娱乐',exact:true}).click();
  await page.getByRole('region',{name:'娱乐中的网站'}).getByRole('button',{name:'添加网站',exact:true}).click();
  await expect(page.getByLabel('所属文件夹',{exact:true})).toHaveValue(await page.getByLabel('所属文件夹',{exact:true}).locator('option').filter({hasText:'娱乐'}).getAttribute('value') as string);
  await page.getByLabel('网站名称').fill('新网站'); await page.getByLabel('网站地址').fill('https://example.com/new'); await page.getByRole('button',{name:'保存捷径',exact:true}).click();
  await page.getByRole('button',{name:'关闭设置',exact:true}).click(); await expect(page.getByRole('button',{name:'文件夹 娱乐',exact:true})).toBeFocused(); await page.getByRole('button',{name:'文件夹 娱乐',exact:true}).click();
  await expect(page.getByRole('region',{name:'娱乐中的网站'}).getByRole('link',{name:'新网站',exact:true})).toHaveAttribute('href','https://example.com/new');
});


test('unsaved website and folder drafts survive settings tab switches',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'添加捷径',exact:true}).click();await page.getByLabel('网站名称').fill('草稿网站');await page.getByLabel('网站地址').fill('https://example.com/draft');
  await page.getByRole('button',{name:'外观',exact:true}).click();await page.getByRole('button',{name:'捷径',exact:true}).click();await expect(page.getByLabel('网站名称')).toHaveValue('草稿网站');await expect(page.getByLabel('网站地址')).toHaveValue('https://example.com/draft');
  await page.getByRole('button',{name:'新建文件夹',exact:true}).click();await page.getByLabel('文件夹名称',{exact:true}).fill('草稿分组');await page.getByRole('button',{name:'外观',exact:true}).click();await page.getByRole('button',{name:'捷径',exact:true}).click();await expect(page.getByLabel('文件夹名称',{exact:true})).toHaveValue('草稿分组');
});
