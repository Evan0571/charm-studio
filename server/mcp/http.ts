import express, { type Request, type RequestHandler, type ErrorRequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { hostHeaderValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import { CallToolRequestSchema, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import { ValidationError } from '../../shared/domain';
import type { Storage } from '../storage';
import type { StudioService } from '../studio-service';
import { createMcpTokens, type McpOptions } from './auth';
import { createLoopMcpServer } from './server';
import { createLoopOAuth, LOOP_SCOPE } from './oauth';
import { OAuthStore } from './oauth-store';

const discoveryMethods = new Set([
  'initialize', 'notifications/initialized', 'ping', 'tools/list',
  'resources/list', 'resources/templates/list', 'prompts/list',
]);

export function createMcpHttp(storage: Storage, service: StudioService, options: McpOptions = {}) {
  const tokens = createMcpTokens(options.secret, options.now);
  const publicUrl = options.publicUrl ? new URL(options.publicUrl) : undefined;
  if (publicUrl && (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/mcp')) throw new Error('MCP_PUBLIC_URL must be an HTTPS URL ending in /mcp, without credentials, query or fragment.');
  const hostGuard = hostHeaderValidation(['localhost', '127.0.0.1', '[::1]', ...(publicUrl ? [publicUrl.hostname] : [])]);
  const audience = (req: Request) => publicUrl?.href ?? `${req.protocol}://${req.get('host')}/mcp`;
  const oauthStore = options.oauthStore ?? new OAuthStore(options.oauthStorePath, options.now);
  const oauthServers = new Map<string, ReturnType<typeof createLoopOAuth>>();
  const oauthFor = (req: Request) => {
    const url = audience(req);
    let oauth = oauthServers.get(url);
    if (!oauth) {
      if (oauthServers.size >= 8) throw new Error('Too many OAuth origins');
      oauth = createLoopOAuth(url, tokens, oauthStore); oauthServers.set(url, oauth);
    }
    return oauth;
  };
  const oauthRouter = express.Router();
  oauthRouter.use(hostGuard);
  oauthRouter.use((req, res, next) => oauthFor(req).router(req, res, next));
  const originGuard: RequestHandler = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.get('origin');
    const expected = new URL(audience(req)).origin;
    if ((origin && origin !== expected) || req.get('sec-fetch-site') === 'cross-site') {
      res.status(403).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Origin not allowed' }, id: null }); return;
    }
    next();
  };
  const router = express.Router();
  router.use(hostGuard, originGuard);
  router.use(express.json({ limit: '48kb' }));
  router.use(async (req, res, next) => {
    const authorization = req.get('authorization');
    try {
      if (!authorization?.startsWith('Bearer ')) throw new ValidationError('Connect LOOP using OAuth.', 401);
      const token = authorization.slice(7);
      try { res.locals.mcpOwner = tokens.verify(token, 'access', audience(req)).owner; }
      catch { res.locals.mcpOwner = (await oauthFor(req).provider.verifyAccessToken(token)).extra?.owner; }
      next();
    } catch {
      const challenge = `Bearer resource_metadata="${new URL(audience(req)).origin}/.well-known/oauth-protected-resource/mcp", scope="${LOOP_SCOPE}"`;
      // Allow discovery so an unlinked host can offer first-use OAuth.
      // Tool calls reach only the challenge handler below, never business logic.
      const method = req.body?.method;
      const discovery = discoveryMethods.has(method);
      if (req.method === 'POST' && ((!authorization && discovery) || method === 'tools/call')) {
        res.locals.mcpChallenge = `${challenge}, error="${authorization ? 'invalid_token' : 'insufficient_scope'}", error_description="Connect or reauthorize LOOP to use this tool."`;
        next(); return;
      }
      res.setHeader('WWW-Authenticate', challenge);
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Connect or reauthorize the LOOP plugin to continue.' }, id: null });
    }
  });
  router.post('/', async (req, res) => {
    // The empty owner is used only for discovery; no unauthenticated tool
    // handler can execute because CallToolRequestSchema is replaced below.
    const server = createLoopMcpServer({ storage, service, tokens, owner: res.locals.mcpOwner ?? '', audience: audience(req) });
    if (!res.locals.mcpOwner) {
      server.server.setRequestHandler(CallToolRequestSchema, async () => ({
        isError: true,
        content: [{ type: 'text', text: 'Connect LOOP to use this tool, then retry the request.' }],
        _meta: { 'mcp/www_authenticate': [res.locals.mcpChallenge] },
      }));
    }
    // On Vercel, POST-scoped SSE streams bypass the buffered 4.5 MB response
    // limit for inline widget HTML and base64 models. No persistent session,
    // standalone GET stream or in-memory event broker is needed.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: !options.streamResponses });
    // SDK 1.x does not expose securitySchemes in registerTool. Add the
    // ChatGPT extension to HTTP discovery and mirror it for older clients.
    // Local stdio has its own trusted identity and must not advertise OAuth.
    if (req.body?.method === 'tools/list') {
      const send = transport.send.bind(transport);
      transport.send = (message, sendOptions) => {
        if ('result' in message && Array.isArray(message.result.tools)) {
          const result = message.result as ListToolsResult;
          const securitySchemes = [{ type: 'oauth2', scopes: [LOOP_SCOPE] }];
          message = { ...message, result: { ...result, tools: result.tools.map(tool => ({
            ...tool, securitySchemes, _meta: { ...tool._meta, securitySchemes },
          })) } };
        }
        return send(message, sendOptions);
      };
    }
    res.once('close', () => { void server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'MCP request failed' }, id: null });
      await server.close().catch(() => {});
    }
  });
  // Both response modes are stateless and have no standalone GET stream.
  router.all('/', (_req, res) => { res.setHeader('Allow', 'POST'); res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }); });
  router.use((_req, res) => { res.status(404).json({ error: 'MCP endpoint not found' }); });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ jsonrpc: '2.0', error: { code: -32700, message: 'Invalid JSON request' }, id: null });
  };
  router.use(errors);
  return {
    router, oauthRouter, close: () => oauthStore.close(), checkHealth: () => oauthStore.checkHealth(), guards: [hostGuard, originGuard],
    issueAccessToken(req: Request, owner: string) { return { ...tokens.issue('access', owner, audience(req), 24 * 60 * 60_000), endpoint: audience(req), tokenType: 'Bearer' }; },
  };
}
