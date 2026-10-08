import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { quoteConfig, validateConfig } from '../shared/domain';

test('every starter design has compatible parts and an exact catalog quote', () => {
  for (const template of catalog.templates) {
    const config = validateConfig(createDefaultConfig(template.id));
    const quote = quoteConfig(config);
    assert.equal(quote.total, quote.lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0));
    assert.equal(quote.currency, 'CNY');
  }
  assert.equal(quoteConfig(createDefaultConfig('hero')).total, 84);
});

test('rejects unknown, incompatible, missing, and unmanufacturable parts', () => {
  const unknown = createDefaultConfig('cord'); unknown.slots['left-bead'] = 'not-for-sale';
  assert.throws(() => validateConfig(unknown), /不兼容/);
  const incompatible = createDefaultConfig('cord'); incompatible.slots['left-bead'] = 'banana';
  assert.throws(() => validateConfig(incompatible), /不兼容/);
  const hero = createDefaultConfig('hero'); hero.slots.main = null; hero.slots.accent = 'star';
  assert.throws(() => validateConfig(hero), /主挂饰/);
  const chain = createDefaultConfig('chain'); chain.connectorId = 'leather';
  assert.throws(() => validateConfig(chain), /挂扣/);
  const extraSlot = createDefaultConfig('hero'); extraSlot.slots.unexpected = 'star';
  assert.throws(() => validateConfig(extraSlot), /位置/);
  assert.throws(() => validateConfig({ ...createDefaultConfig('hero'), price: 0 }), /字段/);
});

test('quantities aggregate and removing optional accents reduces the authoritative price', () => {
  const config = createDefaultConfig('cord');
  config.slots['left-bead'] = 'pearl'; config.slots['center-bead'] = 'pearl'; config.slots['right-bead'] = 'pearl';
  const quote = quoteConfig(config);
  assert.equal(quote.lines.find(line => line.id === 'part:pearl')?.quantity, 3);
  config.slots['left-bead'] = null;
  assert.equal(quoteConfig(config).total, quote.total - 12);
});
