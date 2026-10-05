import { test, expect, type Page } from '@playwright/test';

// A real PNG response lets Chromium exercise image decoding and load/error events.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3n8AAAAASUVORK5CYII=', 'base64');
// Playwright's page.route aborts every /favicon.ico before user handlers run.
// Intercept only the external image transport through Chromium instead.
async function mockFavicons(page: Page, respond: (url: string, headers: Record<string, string>) => number | 'html' | Promise<number | 'html'>) {
  const session = await page.context().newCDPSession(page);
  await session.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*/*.ico', resourceType: 'Image' }] });
  session.on('Fetch.requestPaused', async event => {
    const response = await respond(event.request.url, event.request.headers);
    const status = response === 'html' ? 200 : response;
    await session.send('Fetch.fulfillRequest', {
      requestId: event.requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: response === 'html' ? 'text/html' : status === 200 ? 'image/png' : 'text/plain' }],
      body: (response === 'html' ? Buffer.from('<html><body>Login page</body></html>') : status === 200 ? png : Buffer.from('No icon')).toString('base64'),
    });
  });
  return session;
}
async function addShortcut(page: Page, title: string, url: string) {
  await page.getByRole('button', { name: '添加捷径', exact: true }).click();
  await page.getByLabel('网站名称').fill(title);
  await page.getByLabel('网站地址').fill(url);
  await page.getByRole('button', { name: '保存捷径' }).click();
}
async function editShortcut(page: Page, title: string, nextTitle: string, url: string) {
  await page.getByRole('button', { name: `编辑 ${title}`, exact: true }).click();
  await page.getByLabel('网站名称').fill(nextTitle);
  await page.getByLabel('网站地址').fill(url);
  await page.getByRole('button', { name: '保存捷径' }).click();
}

test('default and newly added shortcuts show original-site icons in both layouts', async ({ page }) => {
  const requests: { url: string; referer?: string }[] = [];
  await mockFavicons(page, (url, headers) => {
    requests.push({ url, referer: Object.entries(headers).find(([name]) => name.toLowerCase() === 'referer')?.[1] });
    return 200;
  });
  await page.goto('/?private=do-not-send');
  const github = page.getByRole('link', { name: 'GitHub', exact: true });
  await expect(github.locator('img')).toBeVisible();
  await expect(github.locator('img')).toHaveAttribute('src', 'https://github.com/favicon.ico');
  await expect.poll(() => github.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await expect(github.locator('.site-icon-fallback')).toHaveCount(0);
  await addShortcut(page, '京东', 'https://www.jd.com/products?token=private#fragment');
  const jd = page.getByRole('link', { name: '京东', exact: true });
  await expect(jd.locator('img')).toHaveAttribute('src', 'https://storage.360buyimg.com/retail-mall/mall-common-component/favicon.ico');
  await expect.poll(() => jd.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  const row = page.locator('.shortcut-row').filter({ has: page.getByText('京东', { exact: true }) });
  await expect(row.locator('img')).toBeVisible();
  await expect(row.locator('.site-icon-fallback')).toHaveCount(0);
  expect(requests.some(r => r.url === 'https://storage.360buyimg.com/retail-mall/mall-common-component/favicon.ico')).toBe(true);
  expect(requests.every(r => !r.referer && !r.url.includes('private'))).toBe(true);
  await expect(jd).toHaveAttribute('href', 'https://www.jd.com/products?token=private#fragment');
});

test('pending and failed icons show initials; editing the URL reloads the icon', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await mockFavicons(page, async url => {
    if (url === 'https://slow.example.com/favicon.ico') await pending;
    return url === 'https://github.com/favicon.ico' ? 200 : 404;
  });
  await page.goto('/');
  await addShortcut(page, '慢站', 'https://slow.example.com/private');
  const link = page.getByRole('link', { name: '慢站', exact: true });
  await expect(link.locator('.site-icon-fallback')).toHaveText('慢');
  release();
  await expect(link.locator('img')).toHaveCount(0);
  await expect(link.locator('.site-icon-fallback')).toHaveText('慢');
  await editShortcut(page, '慢站', '🧭导航', 'https://slow.example.com/private');
  await expect(page.getByRole('link', { name: '🧭导航', exact: true }).locator('.site-icon-fallback')).toHaveText('🧭');
  await editShortcut(page, '🧭导航', '新 GitHub', 'https://github.com/new/path?q=hidden');
  const updated = page.getByRole('link', { name: '新 GitHub', exact: true });
  await expect.poll(() => updated.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await expect(updated.locator('.site-icon-fallback')).toHaveCount(0);
  await editShortcut(page, '新 GitHub', '失败站', 'https://missing.example.com/');
  await expect(page.getByRole('link', { name: '失败站', exact: true }).locator('img')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '失败站', exact: true }).locator('.site-icon-fallback')).toHaveText('失');
});

test('HTTP shortcuts retain their URL and use initials without requesting insecure images on mobile', async ({ page }) => {
  const insecure: string[] = [];
  const session = await mockFavicons(page, () => 404);
  await session.send('Network.enable');
  session.on('Network.requestWillBeSent', event => {
    if (event.request.url.startsWith('http://intranet.example')) insecure.push(event.request.url);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await addShortcut(page, '内网站', 'http://intranet.example:8080/tools');
  const link = page.getByRole('link', { name: '内网站', exact: true });
  await expect(link).toHaveAttribute('href', 'http://intranet.example:8080/tools');
  await expect(link.locator('img')).toHaveCount(0);
  await expect(link.locator('.site-icon-fallback')).toHaveText('内');
  const row = page.locator('.shortcut-row').filter({ has: page.getByText('内网站', { exact: true }) });
  await expect(row.locator('.site-icon-fallback')).toHaveText('内');
  await page.keyboard.press('Escape');
  await expect(link).toBeVisible();
  expect(insecure).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const host of ['home.jd.com', 'jd.com', 'www.jd.com']) test(`${host} uses the website-declared JD icon without changing the shortcut`, async ({ page }) => {
  await mockFavicons(page, url => url === 'https://storage.360buyimg.com/retail-mall/mall-common-component/favicon.ico' ? 200 : 'html');
  await page.goto('/');
  await addShortcut(page, '京东', `https://${host}/products?private=value#section`);
  const link = page.getByRole('link', { name: '京东', exact: true });
  await expect(link.locator('img.is-loaded')).toBeVisible();
  await expect(link.locator('img')).toHaveAttribute('src', 'https://storage.360buyimg.com/retail-mall/mall-common-component/favicon.ico');
  await expect(link).toHaveAttribute('href', `https://${host}/products?private=value#section`);
  await expect(link.locator('.site-icon-fallback')).toHaveCount(0);
  const row = page.locator('.shortcut-row').filter({ has: page.getByText('京东', { exact: true }) });
  await expect(row.locator('img.is-loaded')).toBeVisible();
});

test('JD icon failures keep initials and lookalike domains use their own origin', async ({ page }) => {
  let ready = false;
  await mockFavicons(page, url => ready && url === 'https://notjd.com/favicon.ico' ? 200 : 404);
  await page.goto('/');
  await addShortcut(page, '京东', 'https://home.jd.com/');
  const link = page.getByRole('link', { name: '京东', exact: true });
  await expect(link.locator('.site-icon-fallback')).toHaveText('京');
  await expect(link.locator('img')).toHaveCount(0);
  await editShortcut(page, '京东', '其他网站', 'https://notjd.com/path');
  await expect(page.getByRole('link', { name: '其他网站', exact: true }).locator('.site-icon-fallback')).toHaveText('其');
  ready = true;
  await editShortcut(page, '其他网站', '其他网站', 'https://notjd.com/new-path');
  await expect(page.getByRole('link', { name: '其他网站', exact: true }).locator('img.is-loaded')).toHaveAttribute('src', 'https://notjd.com/favicon.ico');
});


test('Gmail uses its official icon and keeps initials if that image fails',async({browser})=>{
  const success=await browser.newContext(),page=await success.newPage();
  await mockFavicons(page,(url,headers)=>{expect(Object.keys(headers).some(k=>k.toLowerCase()==='referer')).toBe(false);return 200;});
  await page.goto('/?private=do-not-send');const gmail=page.getByRole('link',{name:'Gmail',exact:true});await expect(gmail.locator('img')).toHaveAttribute('src','https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico');await expect.poll(()=>gmail.locator('img').evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBe(1);await success.close();
  // Fresh context prevents a previously decoded Google icon masking a transport error.
  const failure=await browser.newContext(),failed=await failure.newPage();await mockFavicons(failed,()=>404);await failed.goto('/');await expect(failed.getByRole('link',{name:'Gmail',exact:true}).locator('.site-icon-fallback')).toHaveText('G');await expect(failed.getByRole('link',{name:'Gmail',exact:true}).locator('img')).toHaveCount(0);
  await failed.getByRole('button',{name:'整理捷径',exact:true}).click();await editShortcut(failed,'Gmail','我的 Gmail','https://mail.google.com/mail/u/1/');await expect(failed.getByRole('link',{name:'我的 Gmail',exact:true}).locator('.site-icon-fallback')).toHaveText('我');await failure.close();
});
