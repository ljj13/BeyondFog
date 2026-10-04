import { test, expect } from '@playwright/test';

test('engine picker opens a readable menu and selects without submitting search', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('combobox', { name: '搜索引擎', exact: true });
  await page.getByRole('searchbox').fill('不应提交');
  await trigger.click();
  await expect(page.getByRole('listbox', { name: '搜索引擎', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Google', exact: true })).toHaveAttribute('aria-selected', 'true');
  let submitted = false;
  page.on('popup', () => { submitted = true; });
  await page.getByRole('option', { name: '必应', exact: true }).click();
  await expect(trigger).toHaveText('必应');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  expect(submitted).toBe(false);
  await expect(page.getByRole('searchbox')).toHaveValue('不应提交');
});

test('keyboard browsing commits on Enter and Tab but Escape cancels', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('combobox', { name: '搜索引擎', exact: true });
  await trigger.focus();
  await trigger.press('ArrowDown');
  await trigger.press('End');
  await expect(trigger).toHaveText('Google');
  await trigger.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveText('Google');
  await trigger.press('Space');
  await trigger.press('ArrowDown');
  await trigger.press('Enter');
  await expect(trigger).toHaveText('必应');
  await trigger.press('Home');
  await trigger.press('Tab');
  await expect(trigger).toHaveText('Google');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('outside clicks and toggling the trigger dismiss without changing the engine', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('combobox', { name: '搜索引擎', exact: true });
  await trigger.click(); await trigger.press('End');
  await page.getByRole('searchbox').click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveText('Google');
  await trigger.click(); await trigger.press('End'); await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveText('Google');
});

test('settings picker shares the value and first Escape closes only the menu', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '打开设置' }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  const trigger = page.getByRole('combobox', { name: '默认搜索引擎', exact: true });
  await trigger.click(); await trigger.press('End'); await trigger.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(settings).toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole('option', { name: '百度', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '搜索引擎', exact: true })).toHaveText('百度');
  await trigger.press('Escape'); await expect(settings).not.toBeVisible();
  await expect(page.getByRole('button', { name: '打开设置' })).toBeFocused();
});

test('menus fit narrow screens and the scrollable settings panel', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await page.goto('/');
  const trigger = page.getByRole('combobox', { name: '搜索引擎', exact: true });
  await trigger.tap();
  const menu = page.getByRole('listbox', { name: '搜索引擎', exact: true });
  const bounds = await menu.boundingBox(); expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  const option = page.getByRole('option', { name: '百度', exact: true });
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await option.tap(); await expect(trigger).toHaveText('百度');
  await page.getByRole('button', { name: '打开设置' }).tap();
  await page.getByRole('combobox', { name: '默认搜索引擎', exact: true }).tap();
  const panelBounds = await page.locator('.panel-content').boundingBox();
  const settingsMenu = await page.getByRole('listbox', { name: '默认搜索引擎', exact: true }).boundingBox();
  expect(settingsMenu!.y).toBeGreaterThanOrEqual(panelBounds!.y);
  expect(settingsMenu!.y + settingsMenu!.height).toBeLessThanOrEqual(panelBounds!.y + panelBounds!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('option', { name: '必应', exact: true }).tap();
  await expect(page.getByRole('combobox', { name: '默认搜索引擎', exact: true })).toHaveText('必应');
  await context.close();
});
