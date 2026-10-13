import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { quoteConfig } from '../shared/domain';
import { designSignature } from '../shared/designState';
import { checkoutExpired, isSaved, modelContext, reconcileSavedDesign, type Preview } from '../src/chatgpt/state';
import { createLoopMcpServer } from '../server/mcp/server';
import { createStudioService } from '../server/studio-service';
import { createMcpTokens } from '../server/mcp/auth';
import { SqliteStorage } from '../server/storage';
import type { Order } from '../shared/types';

function preview(): Preview {
  const config = createDefaultConfig('hero');
  config.lockedSlots = ['main'];
  return {name:'Golden Hour', config, quote:quoteConfig(config), catalog, designId:'5c762c15-b50d-4c84-a286-b2b8c0526b87', savedSignature:designSignature(config,'Golden Hour')};
}

test('confirming an order preserves the complete editable design, draft ID, locks and selected language for the next conversation turn', () => {
  const value = preview();
  const order: Order = {id:'c26f90b6-2c15-4eb9-851c-028449d70182',designName:value.name,config:value.config,quote:value.quote,status:'test_confirmed',createdAt:new Date().toISOString()};
  const context = modelContext(value, 'zh-CN', undefined, order);
  assert.deepEqual(context.config, value.config);
  assert.equal(context.designId, value.designId);
  assert.equal(context.name, value.name);
  assert.equal(context.language, 'zh-CN');
  assert.equal(context.saveStatus, 'saved');
  assert.equal(context.order?.id, order.id);
});

test('renames, replacements and undo report saved state by content, independent of JSON field order', () => {
  const value = preview();
  assert.equal(isSaved(value), true);
  assert.equal(isSaved({...value,name:'My charm'}), false);
  const changed = {...value,config:{...value.config,slots:{...value.config.slots,main:'shell'}}};
  assert.equal(isSaved(changed), false);
  assert.equal(modelContext(changed,'en').saveStatus, 'modified');
  assert.equal(isSaved({...changed,config:value.config}), true);
  const reordered = {...value.config,slots:Object.fromEntries(Object.entries(value.config.slots).reverse())};
  assert.equal(designSignature(reordered,value.name), value.savedSignature);
  const databaseConfig = {slots: reordered.slots, cordColor: reordered.cordColor, metalTone: reordered.metalTone, templateId: reordered.templateId, connectorId: reordered.connectorId, lockedSlots: reordered.lockedSlots};
  assert.equal(designSignature(databaseConfig,value.name), value.savedSignature, 'Postgres JSONB field order must not change whether the same design is saved');
  assert.equal(isSaved({...value, config: databaseConfig}), true);
});

test('prepared checkout shares review state with the conversation without exposing its confirmation token', () => {
  const value = preview();
  const checkout = {confirmationToken:'test-confirmation-token',designName:value.name,config:value.config,quote:value.quote,expiresAt:new Date(60000).toISOString(),notice:'Test only'};
  const context = modelContext(value, 'en', checkout);
  assert.equal(context.checkout?.requiresConfirmation, true);
  assert.deepEqual(context.checkout?.config, value.config);
  assert.equal(JSON.stringify(context).includes(checkout.confirmationToken), false);
  assert.equal(checkoutExpired(checkout,59999),false);
  assert.equal(checkoutExpired(checkout,60000),true);
  assert.equal(checkoutExpired({...checkout,expiresAt:'invalid'},0),true);
});

test('a concurrent conversation save updates only the matching draft baseline and preserves unsaved card edits', () => {
  const initial = preview();
  const silver = {...initial, config: {...initial.config, metalTone: 'silver' as const}};
  const design = {id: initial.designId!, name: silver.name, config: silver.config, createdAt: '2026-10-13', updatedAt: '2026-10-13'};
  assert.equal(isSaved(silver), false);
  assert.equal(isSaved(reconcileSavedDesign(silver, design)), true);
  const localEdit = {...silver, name: 'Still editing', config: {...silver.config, slots: {...silver.config.slots, accent: 'wood'}}};
  const checked = reconcileSavedDesign(localEdit, design);
  assert.equal(checked.name, localEdit.name);
  assert.deepEqual(checked.config, localEdit.config);
  assert.equal(isSaved(checked), false);
  assert.equal(reconcileSavedDesign(localEdit, {...design, id:'another-draft'}), localEdit);
});

test('desktop collection results do not direct users to a website collection belonging to another visitor', async () => {
  const storage = new SqliteStorage(':memory:');
  const service = createStudioService(storage,{configured:()=>false,reply:async()=>{throw new Error('No AI');}});
  const server = createLoopMcpServer({storage,service,tokens:createMcpTokens('test-desktop-identity-secret-long-enough'),owner:'a'.repeat(64),audience:'http://localhost:3000/mcp',studioUrl:null});
  const client = new Client({name:'desktop-experience-check',version:'1.0'});
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const saved = await client.callTool({name:'loop_save_design',arguments:{name:'Desktop collection',config:createDefaultConfig('hero')}});
    assert.equal(saved.isError,undefined);
    const savedData = saved.structuredContent as {studioUrl?:string;design:{id:string;name:string;config:Preview['config']}};
    assert.equal(savedData.studioUrl,undefined);
    const design = savedData.design;
    const loaded = await client.callTool({name:'loop_preview_design',arguments:{name:design.name,config:design.config,designId:design.id}});
    assert.equal((loaded.structuredContent as Preview).savedSignature,designSignature(design.config,design.name));
    const revised = await client.callTool({name:'loop_preview_design',arguments:{name:design.name,config:{...design.config,metalTone:'silver'},designId:design.id}});
    assert.equal(isSaved(revised.structuredContent as Preview),false);
    const asset = await client.callTool({name:'loop_get_preview_asset',arguments:{path:'/assets/materials/pebbled-leather-color.webp'}});
    assert.equal(asset.isError,undefined);
    assert.ok((asset._meta?.asset as {base64:string}).base64.length > 0);
    assert.equal(JSON.stringify(asset.structuredContent).includes('base64'),false,'Binary assets must stay outside model-visible content');
    const forbidden = await client.callTool({name:'loop_get_preview_asset',arguments:{path:'/assets/../../.env'}});
    assert.equal(forbidden.isError,true);
  } finally {await client.close();await server.close();storage.close();}
});
