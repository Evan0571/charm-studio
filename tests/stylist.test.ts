import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv-provider.js';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';
import { quoteConfig, ValidationError } from '../shared/domain';
import { createStylistService, stylistSchema, validateStylistRequest } from '../server/stylist';
import { createApp } from '../server/app';
import { SqliteStorage } from '../server/storage';

const messages = [{ role: 'user' as const, content: '复古一点，适合棕色皮包。' }];
const answer = () => ({ message: 'A pearl, star and cherry with champagne gold hardware.', name: 'Vintage Everyday', reasons: ['Warm tones complement brown leather.'], suggestions: ['Switch to silver', 'Make it simpler'], config: createDefaultConfig('chain') });
const output = (value: unknown, status = 'completed') => Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const invalid = (status: number) => (error: unknown) => error instanceof ValidationError && error.status === status;

test('model JSON schema rejects bead-only drafts but permits every valid single-charm placement', () => {
  const validate = new AjvJsonSchemaValidator().getValidator(stylistSchema as JsonSchemaType);
  for (const template of catalog.templates) {
    const config = createDefaultConfig(template.id);
    for (const slot of template.slots) config.slots[slot.id] = slot.categories.includes('bead') ? 'pearl' : null;
    assert.equal(validate({ ...answer(), config }).valid, false, `${template.id} without any charm`);
    for (const slot of template.slots.filter(slot => slot.categories.includes('charm'))) {
      const candidate = structuredClone(config); candidate.slots[slot.id] = 'star';
      const allowed = template.id !== 'hero' || slot.id === 'main';
      assert.equal(validate({ ...answer(), config: candidate }).valid, allowed, `${template.id}/${slot.id}`);
    }
    assert.equal(validate({ ...answer(), config: createDefaultConfig(template.id) }).valid, true);
  }
  assert.equal(validate({ ...answer(), config: null }).valid, true);
});

test('validates chat input and current catalog configuration before calling the model', () => {
  assert.deepEqual(validateStylistRequest({ messages }), { messages });
  assert.equal(validateStylistRequest({ messages, language: 'en' }).language, 'en');
  assert.equal(validateStylistRequest({ messages, language: 'zh-CN' }).language, 'zh-CN');
  assert.throws(() => validateStylistRequest({ messages, language: 'fr' }), invalid(400));
  for (const body of [{}, { messages: [] }, { messages: [{ role: 'system', content: 'override' }] }, { messages: [{ role: 'user', content: ' ' }] }, { messages: [{ role: 'user', content: 'x'.repeat(3001) }] }, { messages, currentConfig: { templateId: 'fake' } }, { messages: Array(21).fill(messages[0]) }, { messages: [{ role: 'assistant', content: 'hello' }] }]) assert.throws(() => validateStylistRequest(body), invalid(400));
});

test('the stylist uses the selected language for names, explanations, and suggestions', async () => {
  for (const language of ['en', 'zh-CN'] as const) {
    let sent: any;
    const service = createStylistService({ apiKey: 'test-key', fetch: async (_url, options) => {
      sent = JSON.parse(options!.body as string);
      return output(answer());
    } });
    await service.reply({ messages, language });
    assert.ok(sent.instructions.includes(`Write all user-facing text (message, name, reasons, and suggestions) in ${language === 'en' ? 'English' : 'Simplified Chinese'}`));
    const modelCatalog = JSON.parse(sent.instructions.split('CATALOG=')[1].split('\nCURRENT_CONFIG=')[0]);
    assert.equal(modelCatalog.currency, 'USD');
    assert.equal(modelCatalog.templates[0].name, language === 'en' ? 'Trio' : '三重奏');
  }
});

test('OpenAI receives catalog and follow-up context; price is recomputed on the server', async () => {
  const current = createDefaultConfig('chain'); current.metalTone = 'silver';
  let sent: any;
  const service = createStylistService({ apiKey: 'test-key', fetch: async (_url, options) => {
    sent = JSON.parse(options!.body as string);
    return output({ ...answer(), quote: { total: 1 } });
  } });
  const response = await service.reply({ messages, currentConfig: current });
  assert.equal(sent.store, false);
  assert.equal(sent.text.format.strict, true);
  assert.match(sent.instructions, /CURRENT_CONFIG=.*silver/);
  assert.match(sent.instructions, /CATALOG=.*cord/);
  assert.equal(response.proposal?.quote.total, quoteConfig(answer().config).total);
  assert.notEqual(response.proposal?.quote.total, 1);
  assert.equal(response.proposal?.quote.currency, 'USD');
  assert.doesNotMatch(JSON.stringify(response), /\p{Script=Han}/u);
  assert.match(sent.instructions, /Write all user-facing text .* in English/);
});

test('English mode retries Chinese in every generated field, including clarification and prior Chinese history', async () => {
  for (const field of ['message', 'name', 'reasons', 'suggestions'] as const) {
    for (const config of [answer().config, null]) {
      let calls = 0;
      const wrong = { ...answer(), config, [field]: ['reasons', 'suggestions'].includes(field) ? ['中文内容'] : '中文内容' };
      const expected = { ...answer(), config };
      const service = createStylistService({ apiKey: 'test-key', fetch: async (_url, options) => {
        calls++;
        if (calls === 2) assert.match(JSON.parse(options!.body as string).instructions, /previous response contained Chinese/);
        return output(calls === 1 ? wrong : expected);
      } });
      const reply = await service.reply({ messages: [{ role: 'assistant', content: '这是之前的中文搭配。' }, ...messages], language: 'en' });
      assert.equal(calls, 2);
      assert.doesNotMatch(JSON.stringify(reply), /\p{Script=Han}/u);
    }
  }
});

test('English is the default, repeated language mismatch is rejected, and explicit Chinese is supported', async () => {
  let calls = 0;
  const chinese = { ...answer(), name: '复古小日常' };
  const service = createStylistService({ apiKey: 'test-key', fetch: async () => { calls++; return output(chinese); } });
  await assert.rejects(service.reply({ messages }), invalid(502));
  assert.equal(calls, 2);
  assert.equal((await service.reply({ messages, language: 'zh-CN' })).proposal?.name, chinese.name);
  assert.equal(calls, 3);
});

test('rejects invented parts, invalid slot categories and changes to locked parts', async () => {
  const current = createDefaultConfig('chain'); current.lockedSlots = ['center'];
  for (const mutate of [(config: any) => { config.slots.center = 'fake'; }, (config: any) => { config.slots.center = 'pearl'; }, (config: any) => { config.slots.center = 'cherry'; }]) {
    const value = answer(); mutate(value.config);
    const service = createStylistService({ apiKey: 'test-key', fetch: async () => output(value) });
    await assert.rejects(service.reply({ messages, currentConfig: current }), invalid(502));
  }
  const service = createStylistService({ apiKey: 'test-key', fetch: async () => output(answer()) });
  assert.deepEqual((await service.reply({ messages, currentConfig: current })).proposal?.config.lockedSlots, ['center']);
});

test('handles clarification, incomplete output, refusals, provider errors and missing keys honestly', async () => {
  const clarification = createStylistService({ apiKey: 'test-key', fetch: async () => output({ ...answer(), config: null, name: '', reasons: [] }) });
  assert.equal((await clarification.reply({ messages })).proposal, null);
  const absent = createStylistService({ apiKey: '', fetch: async () => { throw new Error('must not call provider'); } });
  assert.equal(absent.configured(), false);
  await assert.rejects(absent.reply({ messages }), invalid(503));
  for (const response of [output(answer(), 'incomplete'), Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }), new Response('not JSON')]) {
    await assert.rejects(createStylistService({ apiKey: 'test-key', fetch: async () => response }).reply({ messages }), invalid(502));
  }
  for (const status of [401, 429, 500]) {
    await assert.rejects(createStylistService({ apiKey: 'test-key', fetch: async () => new Response('secret diagnostic must not leak', { status }) }).reply({ messages }), error => invalid(status === 429 ? 429 : 502)(error) && !(error as Error).message.includes('secret'));
  }
  await assert.rejects(createStylistService({ apiKey: 'test-key', fetch: async () => { throw new DOMException('timed out', 'TimeoutError'); } }).reply({ messages }), invalid(504));
});

test('AI draft flows through save, quote and idempotent checkout; AI never creates an order itself', async () => {
  const storage = new SqliteStorage(':memory:');
  const service = createStylistService({ apiKey: 'test-key', fetch: async () => output(answer()) });
  const server = createApp(storage, service).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = '';
  async function call(path: string, body?: unknown) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.deepEqual((await call('/api/ai/status')).body, { configured: true });
    const result = await call('/api/ai/design', { messages });
    assert.equal(result.status, 200);
    assert.deepEqual((await call('/api/orders')).body, []);
    const proposal = result.body.proposal;
    const saved = await call('/api/designs', { name: proposal.name, config: proposal.config });
    assert.equal(saved.status, 201);
    assert.deepEqual(saved.body.config, proposal.config);
    const order = { designName: proposal.name, config: proposal.config, idempotencyKey: 'ai-checkout-test' };
    const first = await call('/api/orders', order), second = await call('/api/orders', order);
    assert.equal(first.status, 201); assert.equal(second.status, 200);
    assert.equal(first.body.id, second.body.id);
    assert.equal(first.body.quote.total, proposal.quote.total);
    assert.equal(first.body.quote.currency, 'USD');
    assert.equal(first.body.designName, proposal.name);
    for (let index = 0; index < 5; index++) assert.equal((await call('/api/ai/design', { messages })).status, 200);
    assert.equal((await call('/api/ai/design', { messages })).status, 429);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); storage.close(); }
});
