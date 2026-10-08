import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { quoteConfig, validateConfig } from '../shared/domain';

test('every starter design has compatible parts and an exact catalog quote', () => {
  for (const template of catalog.templates) {
    const config = validateConfig(createDefaultConfig(template.id));
    const quote = quoteConfig(config);
    assert.equal(quote.total, quote.lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0));
    assert.equal(quote.currency, 'USD');
  }
  assert.equal(quoteConfig(createDefaultConfig('hero')).total, 13);
});

test('USD catalog prices use the requested fixed 7:1 rate and rounded unit prices', () => {
  const originalTemplates = { cord: 28, chain: 38, hero: 18 };
  const originalConnectors: Record<string, number> = { ring: 12, leather: 22 };
  const originalParts: Record<string, number> = { banana: 32, orange: 28, pear: 28, cupcake: 36, cherry: 26, star: 16, heart: 18, shell: 22, flower: 20, pearl: 12, amethyst: 15, jade: 14, clear: 10, wood: 8 };
  for (const template of catalog.templates) assert.equal(template.basePrice, Math.round(originalTemplates[template.id] / 7));
  for (const connector of catalog.connectors) assert.equal(connector.price, Math.round(originalConnectors[connector.id] / 7));
  for (const part of catalog.parts) assert.equal(part.price, Math.round(originalParts[part.id] / 7));

  const starAndPearl = createDefaultConfig('cord');
  starAndPearl.slots = { 'left-bead': null, 'left-charm': null, 'center-bead': 'pearl', 'center-charm': 'star', 'right-bead': null, 'right-charm': null };
  assert.equal(quoteConfig(starAndPearl).total, 10);
  assert.equal(quoteConfig(createDefaultConfig('cord')).total, 20);
  assert.equal(quoteConfig(createDefaultConfig('chain')).total, 15);
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
  assert.equal(quoteConfig(config).total, quote.total - 2);
});
