import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { visitor } from '../visitor';
import { hash } from '../studio-service';
import type { McpTokens } from './auth';
import type { OAuthPersistence } from './oauth-store';

export const LOOP_SCOPE = 'loop:studio';
const consentTTL = 5 * 60_000, grantTTL = 30 * 24 * 60 * 60_000;
type Pending = { owner: string; clientId: string; params: Omit<AuthorizationParams, 'resource'> & { resource: string } };
type Grant = { owner: string; clientId: string; resource: string };
type Code = Pending & { grantId: string };
type Refresh = { grantId: string; clientId: string };
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function createLoopOAuth(audience: string, tokens: McpTokens, store: OAuthPersistence) {
  const resource = new URL(audience), issuer = new URL(resource.origin);
  const requireResource = (value?: URL) => { if (value?.href !== resource.href) throw new InvalidTargetError('The resource must be the LOOP MCP endpoint.'); };
  const requireScopes = (scopes?: string[]) => { if (scopes?.some(s => s !== LOOP_SCOPE)) throw new InvalidScopeError('Unknown LOOP scope.'); };
  const findCode = async (client: OAuthClientInformationFull, code: string) => {
    const value = await store.get<Code>('code', hash(code));
    if (!value || value.clientId !== client.client_id || value.params.resource !== audience) throw new InvalidGrantError('Authorization code is invalid or expired.');
    return value;
  };
  const issue = async (grantId: string, grant: Grant): Promise<OAuthTokens> => {
    const access = tokens.issue('oauth-access', grant.owner, audience, 60 * 60_000, { grantId, clientId: grant.clientId, scope: LOOP_SCOPE });
    const refresh = randomBytes(32).toString('base64url');
    await store.put('refresh', hash(refresh), { grantId, clientId: grant.clientId }, grantTTL);
    return { access_token: access.token, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh, scope: LOOP_SCOPE };
  };
  const provider: OAuthServerProvider = {
    clientsStore: {
      getClient: id => store.get<OAuthClientInformationFull>('client', id),
      registerClient: async info => {
        if (info.redirect_uris.length > 10 || info.redirect_uris.some(raw => {
          const url = new URL(raw);
          return !!(url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))));
        })) throw new InvalidClientMetadataError('Redirects require HTTPS, except loopback development clients.');
        if (info.token_endpoint_auth_method && !['none', 'client_secret_post'].includes(info.token_endpoint_auth_method)) throw new InvalidClientMetadataError('Unsupported client authentication.');
        const client = { ...info, client_id: randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000) };
        await store.put('client', client.client_id, client);
        return client;
      },
    },
    async authorize(client, params, res) {
      requireResource(params.resource); requireScopes(params.scopes);
      const requestId = randomBytes(32).toString('base64url');
      await store.put('consent', hash(requestId), { owner: res.locals.ownerId, clientId: client.client_id, params: { ...params, resource: audience } }, consentTTL);
      // Chrome also applies form-action to the POST's 303 callback redirect.
      // Only permit this registered client's validated callback origin.
      res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(params.redirectUri).origin}; frame-ancestors 'none'; base-uri 'none'`);
      // Chrome sends Origin: null on form POSTs under no-referrer. Preserve
      // same-origin consent validation while hiding the URL from the callback.
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('X-Frame-Options', 'DENY');
      res.type('html').send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>连接 LOOP</title><style>body{font:16px/1.7 system-ui;background:#f7f5f0;color:#2b302c;margin:0;padding:8vh 24px}main{max-width:480px;margin:auto;background:white;border:1px solid #deded4;border-radius:24px;padding:32px}h1{font-size:26px}small{color:#686e65;overflow-wrap:anywhere}button{font:inherit;border-radius:24px;padding:10px 18px;border:1px solid #ccc;background:white;cursor:pointer}button[value=allow]{background:#304538;color:white;border-color:#304538}form{display:flex;gap:12px;margin-top:24px}</style><main><small>LOOP · BAG CHARM STUDIO</small><h1>连接你的 LOOP 工作台</h1><p><strong>${escape(client.client_name || 'MCP 客户端')}</strong> 请求使用当前浏览器在本站的访客工作台。</p><p>连接后可以查看和保存设计、生成报价，以及在你确认后创建测试订单。不会扣款或发货。</p><p>当前工作台由此浏览器的 Cookie 识别。这不是邮箱账号登录；换浏览器或域名会进入新的访客工作台。</p><small>授权返回地址：${escape(new URL(params.redirectUri).origin)}</small><form method="post" action="/oauth/consent"><input type="hidden" name="request" value="${requestId}"><button name="decision" value="deny">取消</button><button name="decision" value="allow">授权连接</button></form></main></html>`);
    },
    async challengeForAuthorizationCode(client, code) { return (await findCode(client, code)).params.codeChallenge; },
    async exchangeAuthorizationCode(client, code, _verifier, redirectUri, requestedResource) {
      const value = await findCode(client, code);
      requireResource(requestedResource);
      if (redirectUri !== value.params.redirectUri) throw new InvalidGrantError('Redirect URI does not match.');
      // Verification precedes consumption; DELETE ... RETURNING makes replay
      // rejection atomic even when requests land on different cloud instances.
      if (!await store.consume<Code>('code', hash(code))) throw new InvalidGrantError('Authorization code was already used or expired.');
      const grant = { owner: value.owner, clientId: client.client_id, resource: audience };
      await store.put('grant', value.grantId, grant, grantTTL);
      return issue(value.grantId, grant);
    },
    async exchangeRefreshToken(client, refreshToken, scopes, requestedResource) {
      requireResource(requestedResource); requireScopes(scopes);
      const record = await store.get<Refresh>('refresh', hash(refreshToken));
      const grant = record && await store.get<Grant>('grant', record.grantId);
      if (!record || !grant || record.clientId !== client.client_id || grant.resource !== audience) throw new InvalidGrantError('Refresh token is invalid or expired.');
      if (!await store.consume<Refresh>('refresh', hash(refreshToken))) throw new InvalidGrantError('Refresh token was already used or expired.');
      return issue(record.grantId, grant);
    },
    async verifyAccessToken(token) {
      try {
        const value = tokens.verify(token, 'oauth-access', audience);
        const grant = await store.get<Grant>('grant', String(value.data.grantId));
        if (!grant || grant.owner !== value.owner || grant.clientId !== value.data.clientId || grant.resource !== audience || value.data.scope !== LOOP_SCOPE) throw new Error();
        return { token, clientId: grant.clientId, scopes: [LOOP_SCOPE], expiresAt: value.expiresAt / 1000, resource, extra: { owner: grant.owner } };
      } catch { throw new InvalidTokenError('LOOP authorization expired or was revoked.'); }
    },
    async revokeToken(client, request) {
      const refresh = await store.get<Refresh>('refresh', hash(request.token));
      if (refresh?.clientId === client.client_id) { await store.remove('grant', refresh.grantId); await store.remove('refresh', hash(request.token)); return; }
      try {
        const value = tokens.verify(request.token, 'oauth-access', audience);
        if (value.data.clientId === client.client_id) await store.remove('grant', String(value.data.grantId));
      } catch { /* Revocation of an unknown token is intentionally successful. */ }
    },
  };
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  router.use(['/authorize', '/oauth/consent'], cookieParser(), visitor);
  router.post('/oauth/consent', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
    if (req.get('origin') !== issuer.origin || req.get('sec-fetch-site') === 'cross-site') { res.status(403).send('请在 LOOP 授权页面确认连接。'); return; }
    const id = typeof req.body.request === 'string' ? req.body.request : '';
    const pending = await store.get<Pending>('consent', hash(id));
    if (!pending || pending.owner !== res.locals.ownerId || pending.params.resource !== audience || !['allow', 'deny'].includes(req.body.decision)) { res.status(400).send('授权请求已失效，请回到客户端重新连接。'); return; }
    if (!await store.consume<Pending>('consent', hash(id))) { res.status(400).send('授权请求已失效，请回到客户端重新连接。'); return; }
    const redirect = new URL(pending.params.redirectUri);
    if (pending.params.state !== undefined) redirect.searchParams.set('state', pending.params.state);
    redirect.searchParams.set('iss', issuer.href);
    if (req.body.decision === 'deny') redirect.searchParams.set('error', 'access_denied');
    else {
      const code = randomBytes(32).toString('base64url');
      await store.put('code', hash(code), { ...pending, grantId: randomUUID() }, 60_000);
      redirect.searchParams.set('code', code);
    }
    res.redirect(303, redirect.href);
  });
  // Routers are cached per canonical origin by createMcpHttp (including the
  // ephemeral loopback port in tests). Keep rate limits, but disable the SDK
  // dependency's creation-stack heuristic for this one-time lazy construction.
  const rateLimit = { validate: { creationStack: false } };
  router.use(mcpAuthRouter({ provider, issuerUrl: issuer, resourceServerUrl: resource, resourceName: 'LOOP Charm Studio', scopesSupported: [LOOP_SCOPE], authorizationOptions: { rateLimit }, tokenOptions: { rateLimit }, revocationOptions: { rateLimit }, clientRegistrationOptions: { clientSecretExpirySeconds: 0, rateLimit } }));
  return { router, provider };
}
