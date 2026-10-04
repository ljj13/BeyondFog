import { test, expect } from '@playwright/test';
// Expose native scrollbars, which headless Chromium otherwise hides.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

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

test('a compact settings popup stays open while its scrollbar is dragged', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.getByRole('button', { name: '打开设置' }).click();
  const trigger = page.getByRole('combobox', { name: '默认搜索引擎', exact: true });
  await trigger.click();
  const menu = page.getByRole('listbox', { name: '默认搜索引擎', exact: true });
  const bounds = (await menu.boundingBox())!;
  expect(await menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const initialScroll = await menu.evaluate(el => el.scrollTop);
  await page.mouse.move(bounds.x + bounds.width - 4, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(bounds.x + bounds.width - 4, bounds.y + bounds.height - 5, { steps: 8 });
  await page.mouse.up();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => menu.evaluate(el => el.scrollTop)).toBeGreaterThan(initialScroll);
  await page.getByRole('option', { name: '百度', exact: true }).click();
  await expect(trigger).toHaveText('百度'); await expect(trigger).toBeFocused();
  await trigger.press('ArrowDown'); await trigger.press('Escape');
  await expect(page.getByRole('dialog', { name: '设置' })).toBeVisible();
  await trigger.press('Home'); await trigger.press('Tab');
  await expect(trigger).toHaveText('Google');
  await expect(page.getByRole('checkbox', { name: '在新标签页打开搜索结果' })).toBeFocused();
});

test('opening the last selected engine keeps it visible without scrolling the settings panel', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await page.getByRole('combobox', { name: '搜索引擎', exact: true }).click();
  await page.getByRole('option', { name: '百度', exact: true }).click();
  await page.getByRole('button', { name: '打开设置' }).click();
  const trigger = page.getByRole('combobox', { name: '默认搜索引擎', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  const before = (await trigger.boundingBox())!;
  await trigger.click();
  const menu = page.getByRole('listbox', { name: '默认搜索引擎', exact: true });
  await menu.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = (await menu.boundingBox())!;
  const selected = (await page.getByRole('option', { name: '百度', exact: true }).boundingBox())!;
  expect(selected.y).toBeLessThan(bounds.y + bounds.height);
  expect((await trigger.boundingBox())!.y).toBeCloseTo(before.y, 0);
});
