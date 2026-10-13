import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { catalog as sourceCatalog, createDefaultConfig } from '../../shared/catalog';
import { quoteConfig, validateConfig, validateName, ValidationError } from '../../shared/domain';
import { localizeCatalog } from '../../shared/localization';
import { designSignature } from '../../shared/designState';
import { PREVIEW_ASSETS, type PreviewAssetPath } from '../../shared/previewAssets';
import type { Storage } from '../storage';
import type { StudioService } from '../studio-service';
import type { McpTokens } from './auth';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { registerLoopWidget, WIDGET_URI } from './widget';

const catalog = localizeCatalog(sourceCatalog, 'en');

const configSchema = z.strictObject({
  templateId: z.enum(['cord', 'chain', 'hero']),
  connectorId: z.string(), cordColor: z.string(), metalTone: z.enum(['gold', 'silver']),
  slots: z.record(z.string(), z.string().nullable()).describe('Every slot of the chosen template, including null for empty slots. Use IDs from loop_get_catalog.'),
  lockedSlots: z.array(z.string()).max(6).describe('Preserve these parts when revising a design.'),
});
const nameSchema = z.string().trim().min(1).max(50);
const idSchema = z.uuidv4();
const pageSchema = { offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(50).default(20) };
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

async function result(action: () => unknown | Promise<unknown>): Promise<CallToolResult> {
  try {
    const value = await action() as Record<string, unknown>;
    return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    const known = error instanceof ValidationError;
    const value = { error: known ? error.message : '数据服务暂时不可用，请稍后重试。', status: known ? error.status : 503 };
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  }
}

export function createLoopMcpServer(context: { storage: Storage; service: StudioService; tokens: McpTokens; owner: string; audience: string; studioUrl?: string | null }) {
  const { storage, service, tokens, owner, audience } = context;
  const studioUrl = context.studioUrl === null ? undefined : context.studioUrl ?? `${new URL(audience).origin}/#/saved`;
  const server = new McpServer({ name: 'loop-charm-studio', version: '0.2.0' }, {
    instructions: 'LOOP creates editable bag-charm designs inside this conversation. Read loop_get_catalog, design using your own reasoning, then call loop_preview_design to display the final configuration and authoritative USD quote inline. Repeat preview after conversational edits or loading a saved design; carry designId when revising an existing saved draft. When the user asks what alternatives are available for a main charm, accent, bead or other slot, call loop_preview_design with the latest complete configuration and selectionSlot set to that slot ID. This opens illustrated selectable cards alongside the default 3D preview; do not answer only with a text list or change a part before the user chooses. For hero, main is the main charm and accent is the auxiliary part. Use the latest widget model context after every card action, including checkout. It retains the current name, config, quote, designId, language and saveStatus alongside any order. Preserve designId on further revisions so the same saved draft is updated. Saved designs belong to this connected identity; only offer a website collection link when the result provides studioUrl. Preserve locked parts from the latest widget context unless the user unlocks them. Prefer this workflow over loop_suggest_design, which is a fallback for clients without a model. Saving and checkout are separate actions. Before loop_confirm_test_order, show the exact prepared design, itemized USD quote and test-only notice, and ask for explicit user confirmation. A confirmation token is bound to that configuration and user; prepare again after edits. All orders are simulations: no payment, inventory reservation, manufacturing or shipping. Never claim a real Alexa+ device connection. Use English for design names, explanations and suggestions by default. Use the language selected in the latest widget context, or another language when the user explicitly requests it.',
  });
  server.registerTool('loop_get_preview_asset', {
    description: 'Read a bundled public 3D asset for the LOOP preview card. Internal renderer utility; no writes or external network requests.',
    inputSchema: z.strictObject({path:z.enum(Object.keys(PREVIEW_ASSETS) as [PreviewAssetPath, ...PreviewAssetPath[]])}),
    annotations: readOnly, _meta: {ui:{visibility:['app']},'openai/widgetAccessible':true},
  }, async ({path}) => {
    try {
      const bytes = await readFile(resolve('public',path.slice(1)));
      if (bytes.length > 6 * 1024 * 1024) throw new Error('Preview asset exceeds the transport budget');
      const manifest = {path,mime:PREVIEW_ASSETS[path],byteLength:bytes.length};
      return {content:[{type:'text',text:JSON.stringify(manifest)}],structuredContent:manifest,_meta:{asset:{mime:manifest.mime,base64:bytes.toString('base64')}}};
    } catch { return result(() => {throw new ValidationError('3D 素材暂时不可用，请重试预览。',503);}); }
  });
  server.registerTool('loop_get_catalog', {
    description: 'Get supported bag-charm templates, slot compatibility, part IDs, materials, colors, USD prices, and valid starter configurations. Read this before designing; do not invent items or availability.',
    inputSchema: z.strictObject({}), annotations: readOnly,
  }, () => result(() => ({ catalog, examples: catalog.templates.map(t => ({ name: t.name, config: createDefaultConfig(t.id) })), testOrdersOnly: true })));
  server.registerTool('loop_suggest_design', {
    description: 'Ask LOOP\'s configured AI stylist for a first draft or conversational revision using real catalog items. Send conversation messages ending with a user message and currentConfig when editing. Preserves locked parts. Returns a proposal and server quote; does not save or order. Requires the server AI key; clients may alternatively design using the catalog.',
    inputSchema: z.strictObject({ messages: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(3000) })).min(1).max(20), currentConfig: configSchema.optional(), language: z.enum(['en', 'zh-CN']).optional() }),
    annotations: { ...readOnly, idempotentHint: false, openWorldHint: true },
  }, args => result(() => service.suggest(owner, args)));
  server.registerTool('loop_quote_design', {
    description: 'Validate a full configuration and return the authoritative itemized USD price. No state changes. Invalid part/slot combinations are rejected.',
    inputSchema: z.strictObject({ config: configSchema }), annotations: readOnly,
  }, ({ config }) => result(() => ({ config: validateConfig(config), quote: quoteConfig(config), testOrdersOnly: true })));
  server.registerTool('loop_save_design', {
    description: 'Save the user\'s chosen full configuration as a draft in this connected user\'s collection. Omit id for a new draft; pass an owned draft id to update it. Browser and desktop connections can have different identities. This does not create an order. Preserve locked parts unless the user explicitly unlocks them. Wait for saving to finish before calling loop_preview_design for the saved draft.',
    inputSchema: z.strictObject({ name: nameSchema, config: configSchema, id: idSchema.optional() }), annotations: { ...write, destructiveHint: true },
  }, args => result(async () => ({ ...await service.saveDesign(owner, args), studioUrl })));
  server.registerTool('loop_list_designs', {
    description: 'List only this connected user\'s saved designs, newest first. Use offset/limit to page through results.',
    inputSchema: z.strictObject(pageSchema), annotations: readOnly,
  }, ({ offset, limit }) => result(async () => { const items = await storage.listDesigns(owner); return { designs: items.slice(offset, offset + limit), total: items.length, studioUrl }; }));
  server.registerTool('loop_get_design', {
    description: 'Load an owned draft by id, including its complete editable configuration and a freshly calculated quote.',
    inputSchema: z.strictObject({ id: idSchema }), annotations: readOnly,
  }, ({ id }) => result(async () => { const design = await service.getDesign(owner, id); return { design, quote: quoteConfig(design.config), studioUrl }; }));
  server.registerTool('loop_prepare_test_order', {
    description: 'Prepare a test-only checkout with an exact configuration and itemized USD quote. Does NOT create an order. Show the complete returned summary to the user and wait for explicit confirmation before using the returned confirmationToken. Token expires in 10 minutes; prepare again after any edit.',
    inputSchema: z.strictObject({ designName: nameSchema, config: configSchema }), annotations: readOnly,
  }, args => result(() => {
    const config = validateConfig(args.config), designName = validateName(args.designName), quote = quoteConfig(config);
    const signed = tokens.issue('checkout', owner, audience, 10 * 60_000, { config, designName, quote, idempotencyKey: randomUUID() });
    return { designName, config, quote, confirmationToken: signed.token, expiresAt: signed.expiresAt, requiresConfirmation: true, notice: '仅创建测试订单，不会扣款、锁定库存或发货。' };
  }));
  server.registerTool('loop_confirm_test_order', {
    description: 'Create a test order ONLY after the user explicitly confirms the exact prepared summary. Pass the unchanged confirmationToken and confirmed=true. Never infer consent from a design request. Retrying the same token returns the same order; edits require a new prepare step. No real payment or shipping.',
    inputSchema: z.strictObject({ confirmationToken: z.string().max(12000), confirmed: z.literal(true) }), annotations: { ...write, idempotentHint: true },
  }, ({ confirmationToken }) => result(async () => {
    const ticket = tokens.verify(confirmationToken, 'checkout', audience);
    if (ticket.owner !== owner) throw new ValidationError('没有找到这份待确认订单。', 404);
    const config = validateConfig(ticket.data.config);
    if (JSON.stringify(quoteConfig(config)) !== JSON.stringify(ticket.data.quote)) throw new ValidationError('报价已变化，请重新获取报价并确认。', 409);
    return { ...await service.createOrder(owner, ticket.data), testOrdersOnly: true, notice: '测试订单已确认，未扣款，不会发货。', studioUrl };
  }));
  server.registerTool('loop_list_orders', {
    description: 'List this connected user\'s persisted test orders and their price snapshots, newest first. All orders have status test_confirmed; there is no shipping tracking.',
    inputSchema: z.strictObject(pageSchema), annotations: readOnly,
  }, ({ offset, limit }) => result(async () => { const items = await storage.listOrders(owner); return { orders: items.slice(offset, offset + limit), total: items.length, testOrdersOnly: true }; }));
  registerAppTool(server, 'loop_preview_design', {
    title: 'Preview LOOP design',
    description: 'Render an editable 3D bag-charm preview with exact USD price and illustrated selectable part cards. When asked for replacement options, call this with selectionSlot (hero main for main charm, accent for auxiliary charm) and the latest full configuration instead of returning only a text list. Cards update the preview and price on selection. Read loop_get_catalog first. Use after design revisions or loading a draft. Does not save or order. Pass designId when revising an owned saved draft.',
    inputSchema: z.strictObject({ name: nameSchema, config: configSchema, designId: idSchema.optional(), selectionSlot: z.string().optional().describe('Open visual replacement cards for this slot ID. Must belong to the current template. Omit for a normal 3D preview.') }), annotations: readOnly,
    _meta: { ui: { resourceUri: WIDGET_URI }, 'openai/outputTemplate': WIDGET_URI, 'openai/widgetAccessible': true },
  }, args => result(async () => {
    const saved = args.designId ? await service.getDesign(owner, args.designId) : undefined;
    const config = validateConfig(args.config);
    if (args.selectionSlot !== undefined && !catalog.templates.find(t => t.id === config.templateId)!.slots.some(slot => slot.id === args.selectionSlot)) throw new ValidationError('请选择当前样式中的配件位置。');
    return { name: validateName(args.name), config, quote: quoteConfig(config), designId: args.designId, ...(saved ? { savedSignature: designSignature(saved.config, saved.name) } : {}), ...(args.selectionSlot !== undefined ? { selectionSlot: args.selectionSlot } : {}), catalog, testOrdersOnly: true };
  }));
  registerLoopWidget(server, new URL(audience).origin);
  server.registerResource('loop-catalog', 'loop://catalog', { description: 'Current LOOP catalog and compatibility rules', mimeType: 'application/json' }, () => ({ contents: [{ uri: 'loop://catalog', mimeType: 'application/json', text: JSON.stringify(catalog) }] }));
  server.registerPrompt('design-bag-charm', {
    description: 'Guide a complete LOOP design, revision, save and explicitly confirmed test checkout.',
    argsSchema: { idea: z.string().max(3000) },
  }, ({ idea }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Help me design a LOOP bag charm for this brief: ${idea}\nRead loop_get_catalog, construct a valid design using your own reasoning, and call loop_preview_design to show its interactive 3D card. Use the latest card context on revisions, preserving locked parts and designId. Open selectionSlot when I ask to see alternatives. Saving is a separate explicit action. Only when I request checkout, prepare the test order, show its full itemized quote and wait for my explicit confirmation before confirming it. No real payment or shipping.` } }] }));
  return server;
}
