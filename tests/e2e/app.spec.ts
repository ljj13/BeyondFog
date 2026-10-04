import { test, expect } from '@playwright/test';
test('visitor can search special Chinese text and switch engine',async({page,context})=>{
  await context.route('https://www.google.com/**',r=>r.fulfill({body:'Search destination'}));
  await context.route('https://www.baidu.com/**',r=>r.fulfill({body:'Search destination'}));
  await page.goto('/');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await page.getByRole('searchbox').fill('雾 & a=1 + # ?');
  const popup=page.waitForEvent('popup');
  await page.getByRole('searchbox').press('Enter');
  const target=await popup;
  await expect.poll(()=>new URL(target.url()).searchParams.get('q')).toBe('雾 & a=1 + # ?');
  await target.close();
  await page.getByLabel('搜索引擎').selectOption('baidu');
  const p=page.waitForEvent('popup'); await page.getByRole('searchbox').press('Enter');
  expect(new URL((await p).url()).hostname).toBe('www.baidu.com');
});
test('mobile settings stay within the screen and Escape returns focus',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'打开设置'}).click();
  await expect(page.getByRole('dialog',{name:'设置'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'打开设置'})).toBeFocused();
});
