import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, mkdir } from 'node:fs/promises';
import express from 'express';
import { build } from 'vite';
import { createApp } from '../server/app.ts';
import { SqliteStorage } from '../server/storage.ts';
// Like chatgpt-browser-check.mjs, set PLAYWRIGHT_MODULE when the browser
// runtime is supplied outside this checkout. All storage is isolated.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const storage = new SqliteStorage(':memory:');
const app = createApp(storage, { configured: () => false, reply: async () => { throw new Error('No model calls'); } });
app.use('/assets', (_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); }, express.static('public/assets'));
await mkdir('tmp', { recursive: true });
await build({ configFile: false, logLevel: 'silent', publicDir: false, build: { target: 'es2022', outDir: 'tmp/strict-csp-host', minify: false, lib: { entry: 'scripts/chatgpt-harness.ts', formats: ['es'], fileName: () => 'host.js' } } });
app.use(express.static('tmp/strict-csp-host'));
app.get('/harness', async (_req, res) => res.type('html').send((await readFile('scripts/chatgpt-harness.html', 'utf8')).replace('/scripts/chatgpt-harness.ts', '/host.js')));
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
const errors = [], failed = [], calls = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error' && !e.text().includes('405 (Method Not Allowed)')) errors.push(e.text().slice(0, 900)); });
page.on('requestfailed', r => { if (!r.url().endsWith('/mcp')) failed.push({ url: r.url().slice(0, 160), error: r.failure()?.errorText }); });
page.on('request', r => { if (r.url().endsWith('/mcp') && r.method() === 'POST') { const rpc = r.postDataJSON(); if (rpc.method === 'tools/call') calls.push(rpc.params.name); } });
await page.route('**/host.js', async route => {
 const response = await route.fetch(); const js = (await response.text()).replace("'wasm-unsafe-eval'", '').replace("connect-src ${location.origin} data: blob:", "connect-src 'none'");
 await route.fulfill({ response, body: js });
});
try {
 await page.goto(`http://127.0.0.1:${server.address().port}/harness`);
 const card = page.frameLocator('#widget');
 await card.getByRole('heading', { name: '珍珠与星光' }).waitFor();
 await page.evaluate(async () => {
   const result = await window.loopHarness.client.callTool({ name: 'loop_preview_design', arguments: { name: 'Midnight Starlight', config: { templateId: 'hero', connectorId: 'leather', cordColor: 'ink', metalTone: 'silver', slots: { main: 'star', accent: 'wood' }, lockedSlots: [] } } });
   await window.loopHarness.bridge.sendToolResult(result);
 });
 await card.getByRole('heading', { name: 'Midnight Starlight' }).waitFor();
 const frame = await (await page.locator('#widget').elementHandle()).contentFrame();
 await frame.waitForFunction(() => ['failed','ready'].includes(document.querySelector('.preview')?.dataset.renderState), { timeout: 30000 });
 await page.waitForTimeout(3000);
 const status = await frame.evaluate(() => ({ canvas: !!document.querySelector('canvas'), fallback: document.querySelector('.preview[data-render-state="failed"] .preview-note')?.textContent, price: document.querySelector('.price')?.textContent, csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content }));
 await page.locator('#widget').screenshot({ path: 'tmp/strict-csp-widget.png' });
 if (process.argv.includes('--verify')) {
   assert.equal(status.canvas, true); assert.equal(status.fallback, undefined); assert.match(status.price, /\$9/);
   const before = await card.locator('canvas').screenshot();
   const box = await card.locator('canvas').boundingBox();
   await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
   await page.mouse.move(box.x + box.width * .7, box.y + box.height * .45, { steps: 12 }); await page.mouse.up();
   await page.waitForTimeout(800);
   assert.equal(before.equals(await card.locator('canvas').screenshot()), false, 'Dragging must rotate the 3D render');
   const rotated = await card.locator('canvas').screenshot();
   await page.mouse.wheel(0, -200); await page.waitForTimeout(800);
   assert.equal(rotated.equals(await card.locator('canvas').screenshot()), false, 'Scrolling must zoom the 3D render');
   await card.getByRole('button', { name: 'On a bag', exact: true }).click(); await page.waitForTimeout(3000);
   assert.equal(await card.locator('canvas').count(), 1); assert.equal(await card.locator('.preview[data-render-state="failed"]').count(), 0);
   await card.getByRole('button', { name: 'Change Accent', exact: true }).click();
   await card.locator('.part-options').getByRole('button', { name: 'Soft glow pearl', exact: true }).click();
   await page.waitForFunction(() => window.loopHarness.trace.at(-1)?.structuredContent?.config.slots.accent === 'pearl');
   assert.match(await card.locator('.price').innerText(), /\$10/);
   await page.locator('#widget').screenshot({ path: 'tmp/strict-csp-widget-bag.png' });
   // An incoming preview must recover the scene even with identical geometry.
   await page.evaluate(async () => {
     const current = window.loopHarness.trace.at(-1).structuredContent;
     const result = await window.loopHarness.client.callTool({ name: 'loop_preview_design', arguments: { name: current.name, config: current.config } });
     await window.loopHarness.bridge.sendToolResult(result);
   });
   await frame.waitForFunction(() => document.querySelector('.preview')?.dataset.renderState === 'ready', { timeout: 30000 }).catch(async error => {
     console.log(JSON.stringify({ phase: 'incoming preview', status: await frame.evaluate(() => ({ state: document.querySelector('.preview')?.dataset.renderState, canvas: !!document.querySelector('canvas'), note: document.querySelector('.preview-note')?.textContent })), errors, failed }, null, 2));
     throw error;
   });
   assert.equal(calls.some(name => /save|order/.test(name)), false);
   assert.deepEqual(errors, []); assert.deepEqual(failed, []);
 }
 const saved = await (await page.request.get(`http://127.0.0.1:${server.address().port}/api/designs`)).json();
 const orders = await (await page.request.get(`http://127.0.0.1:${server.address().port}/api/orders`)).json();
 assert.deepEqual(saved, []); assert.deepEqual(orders, []);
 console.log(JSON.stringify({ status, errors, failed, calls, saved, orders, result: process.argv.includes('--verify')?'PASS':'diagnostic' }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); app.locals.closeMcp(); storage.close(); }
