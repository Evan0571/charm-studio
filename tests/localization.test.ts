import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { quoteConfig } from '../shared/domain';
import { formatMoney, localizeCatalog, resolveLanguage, translate } from '../shared/localization';

test('new and invalid language preferences default to English', () => {
  for (const value of [null, undefined, '', 'fr', 'zh', {}, 'en']) assert.equal(resolveLanguage(value), 'en');
  assert.equal(resolveLanguage('zh-CN'), 'zh-CN');
});

test('both catalogs preserve identifiers, pricing and compatibility without mutating the source', () => {
  const original = structuredClone(catalog);
  const en = localizeCatalog(catalog, 'en');
  assert.doesNotMatch(JSON.stringify(en), /\p{Script=Han}/u);
  assert.deepEqual(localizeCatalog(en, 'zh-CN'), original);
  assert.deepEqual(catalog, original);
  for (const template of en.templates) {
    assert.deepEqual(template.slots.map(slot => [slot.id, slot.categories]), original.templates.find(item => item.id === template.id)!.slots.map(slot => [slot.id, slot.categories]));
    const quote = quoteConfig(createDefaultConfig(template.id));
    for (const line of quote.lines) assert.doesNotMatch(translate(line.name, 'en'), /\p{Script=Han}/u);
  }
  assert.deepEqual(en.parts.map(part => [part.id, part.price]), original.parts.map(part => [part.id, part.price]));
  assert.equal(formatMoney(148, 'en'), '$148');
  assert.equal(formatMoney(12.5, 'en'), '$12.5');
  assert.equal(formatMoney(148, 'zh-CN'), 'US$148');
  assert.match(formatMoney(148, 'en', 'CNY'), /CN¥148/);
});

test('interpolated labels and server errors localize while unknown text is preserved', () => {
  assert.equal(translate('锁定{0}', 'en', 'Main charm'), 'Lock Main charm');
  assert.equal(translate('左侧珠子的零件不兼容，请重新选择。', 'en'), 'The piece in Left bead is incompatible. Please choose another.');
  assert.equal(translate('Trio base structure', 'zh-CN'), '三重奏基础结构');
  assert.equal(translate('My own name / 自己的名字', 'en'), 'My own name / 自己的名字');
});
