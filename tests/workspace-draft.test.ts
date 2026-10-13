import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig } from '../shared/catalog';
import { parseWorkspaceDraft, designSignature, visualKey } from '../src/workspaceDraft';

test('restores a valid workspace draft and rejects stale incompatible parts', () => {
  const config = createDefaultConfig('hero');
  assert.deepEqual(parseWorkspaceDraft(JSON.stringify({ version: 1, config, name: 'Banana days' }))?.config, config);
  assert.equal(parseWorkspaceDraft(JSON.stringify({ version: 1, config: { ...config, slots: { main: 'unknown', accent: 'pearl' } }, name: 'Draft' })), null);
  assert.equal(parseWorkspaceDraft('{broken'), null);
  assert.equal(parseWorkspaceDraft(JSON.stringify({ version: 2, config, name: 'Old draft' })), null);
});
test('renaming changes the save signature while locks do not change a product image', () => {
  const config = createDefaultConfig('hero');
  assert.notEqual(designSignature(config, 'First'), designSignature(config, 'Second'));
  assert.equal(visualKey(config), visualKey({ ...config, lockedSlots: ['main'] }));
  assert.notEqual(visualKey(config), visualKey({ ...config, metalTone: 'silver' }));
});
