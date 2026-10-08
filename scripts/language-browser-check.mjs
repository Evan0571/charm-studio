// Run after pnpm build. Uses a temporary database and a deterministic AI stub.
// Set PLAYWRIGHT_MODULE if Playwright is provided by an external runtime.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import express from 'express';
import { createApp } from '../server/app.ts';
import { SqliteStorage } from '../server/storage.ts';
import { createDefaultConfig } from '../shared/catalog.ts';
import { quoteConfig } from '../shared/domain.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const storage = new SqliteStorage(':memory:');
const aiLanguages = [];
const app = createApp(storage, { configured: () => true, reply: async request => {
  aiLanguages.push(request.language);
  const config = request.currentConfig ?? createDefaultConfig('hero');
  const en = request.language === 'en';
  return { message: en ? 'A playful charm for your bag.' : '为你的包搭一件活泼的小挂饰。', suggestions: [en ? 'Switch to silver' : '换成银色'], proposal: { config, quote: quoteConfig(config), name: en ? 'A little sunshine' : '一点阳光', reasons: [en ? 'A fruit charm with a pearl accent.' : '水果挂饰配珍珠点缀。'] } };
} });
let vite;
if (process.env.LOOP_UI_DEV === '1') {
  vite = await (await import('vite')).createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  app.use(vite.middlewares);
  app.get('/{*path}', async (req, res, next) => {
    try { res.type('html').send(await vite.transformIndexHtml(req.originalUrl, await readFile(req.path === '/mcp-demo.html' ? 'mcp-demo.html' : 'index.html', 'utf8'))); }
    catch (error) { next(error); }
  });
} else {
  app.use(express.static('dist'));
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
}
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const language = value => page.locator('.language-switcher select').selectOption(value);
const records = async path => (await (await page.request.get(base + path)).json());
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow at ${page.viewportSize().width}px`);
async function englishOnly() {
  const chinese = await page.evaluate(() => {
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, element = node.parentElement;
      if (element?.closest('select, option, script, style') || !element?.checkVisibility()) continue;
      if (/\p{Script=Han}/u.test(node.textContent)) found.push(node.textContent.trim());
    }
    return found;
  });
  assert.deepEqual(chinese, [], 'Untranslated visible copy');
  assert.doesNotMatch(await page.locator('body').innerText(), /CNY|CN¥|¥/, 'Old currency in the interface');
}
try {
  await mkdir('tmp/language-review', { recursive: true });
  await page.goto(base);
  await page.getByRole('button', { name: 'Design it yourself' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await englishOnly();
  await page.screenshot({ path: 'tmp/language-review/home-desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(); }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'tmp/language-review/home-mobile.png', fullPage: true });
  await language('zh-CN');
  await page.getByRole('button', { name: '自己动手搭配' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '自己动手搭配' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await language('en');
  await page.getByRole('button', { name: 'Design it yourself' }).click();
  await page.getByRole('heading', { name: 'Make it yours' }).waitFor();
  await page.getByRole('button', { name: 'Reset view', exact: true }).waitFor();
  await englishOnly();
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(); }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('textbox', { name: 'Search accessories' }).fill('WOOD');
  assert.equal(await page.locator('.part-card').count(), 1);
  await page.locator('.part-card').click();
  await page.getByRole('button', { name: 'Lock Left bead', exact: true }).click();
  await page.getByRole('button', { name: 'On a bag', exact: true }).click();
  await page.getByRole('button', { name: 'Shoulder bag', exact: true }).click();
  await page.getByRole('button', { name: 'Bag color: Burgundy', exact: true }).click();
  await language('zh-CN');
  await page.getByRole('button', { name: '解锁左侧珠子', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '腋下肩包', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: '包包颜色：酒红色', exact: true }).getAttribute('aria-pressed'), 'true');
  await language('en');
  await page.getByRole('button', { name: 'Unlock Left bead', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.screenshot({ path: 'tmp/language-review/studio-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({ path: 'tmp/language-review/studio-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await page.getByRole('textbox', { name: 'Design name' }).fill('My custom design');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await language('zh-CN');
  await page.getByRole('button', { name: '保存设计', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '设计名称' }).inputValue(), 'My custom design');
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await language('en');
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await page.getByRole('button', { name: 'Save this design', exact: true }).click();
  await page.getByText('Design saved. Continue editing in My designs.').waitFor();
  const saved = await records('/api/designs');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].config.slots['left-bead'], 'wood');
  assert.deepEqual(saved[0].config.lockedSlots, ['left-bead']);
  await page.getByRole('button', { name: 'Review test order', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await englishOnly();
  assert.equal(await records('/api/orders').then(items => items.length), 0);
  await page.getByRole('button', { name: 'Confirm test order', exact: true }).click();
  await page.getByRole('button', { name: 'View my test orders', exact: true }).waitFor();
  await englishOnly();
  assert.equal(await records('/api/orders').then(items => items.length), 1);
  assert.equal((await records('/api/orders'))[0].quote.currency, 'USD');
  await page.getByRole('button', { name: 'View my test orders', exact: true }).click();
  await page.getByRole('heading', { name: 'Keep what you love.' }).waitFor();
  await englishOnly();
  await page.getByRole('button', { name: 'Find inspiration', exact: true }).click();
  await englishOnly();
  await page.getByRole('button', { name: /A vintage touch for brown bags/ }).click();
  assert.doesNotMatch(await page.getByRole('textbox', { name: 'Describe your bag charm idea' }).inputValue(), /\p{Script=Han}/u);
  await page.getByRole('button', { name: 'Send idea', exact: true }).click();
  await page.getByRole('heading', { name: 'A little sunshine', exact: true }).waitFor();
  await englishOnly();
  assert.match(await page.locator('.ai-proposal').innerText(), /\$\d+/);
  await page.screenshot({ path: 'tmp/language-review/ai-mobile.png', fullPage: true });
  await language('zh-CN');
  await page.getByRole('textbox', { name: '描述你的包挂想法' }).fill('换成银色');
  await page.getByRole('button', { name: '发送灵感', exact: true }).click();
  await page.getByRole('heading', { name: '一点阳光', exact: true }).waitFor();
  assert.deepEqual(aiLanguages, ['en', 'zh-CN']);
  await language('en');
  await page.goto(base + '/mcp-demo.html');
  await page.getByRole('button', { name: 'Connect to the studio', exact: true }).click();
  await page.getByRole('button', { name: 'Try a catalog example', exact: true }).click();
  await page.getByRole('heading', { name: /Catalog example/ }).waitFor();
  await englishOnly();
  await noOverflow();
  await page.getByRole('button', { name: 'Review quote and test order', exact: true }).click();
  await page.getByRole('heading', { name: 'Review this design', exact: true }).waitFor();
  await englishOnly();
  await noOverflow();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }); });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(base);
  await blockedPage.getByRole('button', { name: 'Design it yourself' }).waitFor();
  await blockedPage.locator('.language-switcher select').selectOption('zh-CN');
  await blockedPage.getByRole('button', { name: '自己动手搭配' }).waitFor();
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', cases: ['English default with Chinese browser locale', 'language persistence', 'mobile layout at 320/390/768px', 'case-insensitive English search', 'design, locks, bag and name preservation', 'localized save and test checkout', 'AI language preference', 'MCP demo catalog and checkout', 'storage unavailable'], screenshots: 'tmp/language-review', errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'tmp/language-review/failure.png', fullPage: true }).catch(() => {});
  console.error({ errors, visibleText: (await page.locator('body').innerText().catch(() => '')).slice(0,1800) });
  throw error;
} finally {
  await browser.close(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve)); app.locals.closeMcp(); storage.close(); await vite?.close();
}
