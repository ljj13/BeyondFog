import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('.artifacts',{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5173');await page.locator('.backdrop').evaluate(img=>img.decode());await page.screenshot({path:'.artifacts/desktop.png'});
await page.getByRole('button',{name:'打开设置'}).click();await page.screenshot({path:'.artifacts/settings.png'});
await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.artifacts/mobile.png'});await browser.close();
