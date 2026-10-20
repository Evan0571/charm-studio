# Product feedback and friction log

**Owner-review draft, October 20, 2026. Not submitted.** Implementation facts and issue records come from the source, tests and dated validation. The project owner confirmed the conditional reuse decisions. These are developer-integration observations, not collected user research. The saved Devpost answers and the shared feedback document use the same scope.

[Official submission guidance](https://amazonappdev2026.devpost.com/updates/46538-strong-submission-tips) asks for each tool's purpose, strengths, problems, onboarding and reuse decision. Include other tools actually used by the team; do not claim experience with partner-only Alexa+ SDKs.

## 1. MCP TypeScript SDK

**Use:** Ten design tools, a renderer asset tool, resources, a prompt, and real Streamable HTTP/stdio clients and servers.

**Worked well:** Typed schemas and SDK transports allow different clients to call the same validated product service. Real-client tests inspect discovery and complete workflows.

**Needs work:** Production guidance could separate connection success, large-resource delivery, guest authorization and host UI rendering more explicitly.

**Onboarding:** Basic initialization and tool calls were simpler than production OAuth and large interactive resources.

**Build again:** Yes, because the product service remains reusable across compatible clients.

## 2. MCP Apps and interactive host card

**Use:** An editable 3D card with visual part choices, locks, save state and quote/confirmation actions.

**Worked well:** Model context and interactive tools support continuing revisions. Card and server quote use the same configuration.

**Needs work:** CSP, WebAssembly and asset delivery require host-specific acceptance. Bridge success alone does not establish a rendered card.

**Onboarding:** Achieving reliable 3D in constrained frames required separating website physics from card rendering and changing asset delivery.

**Build again:** Yes, with an explicit target-host capability matrix and visible loading/fallback states.

## 3. OpenAI Responses API and ChatGPT host

**Use:** Responses with strict JSON Schema powers the website stylist. Separately, ChatGPT uses its host model with catalog/preview tools.

**Worked well:** Structured proposals map to catalog data; server checks enforce locks and calculate the actual price. Two live review calls generated a USD 12 design and silver revision preserving the cherry.

**Needs work:** Structurally valid output still needs domain validation. A conversational budget is not a hard spending cap. API configuration and ChatGPT host access are separate concepts for new operators.

**Onboarding:** API setup and host OAuth/card setup were separate integration tracks, now described independently in the guides.

**Build again:** Yes, with shared domain validation and separate live provider/host acceptance. Other models and vendors need their own compatibility testing.

## 4. Amazon Pay US Sandbox and Node SDK

**Use:** A distinct website checkout signs a one-time USD Sandbox session and verifies order binding, amount, environment and captured charge before recording success.

**Worked well:** Provider-hosted Sandbox checkout allows realistic transaction verification without live payment or fulfillment. A real Sandbox/Captured transaction was accepted on October 13.

**Needs work:** Optional response fields and completed-session retries need clear examples. An omitted `checkoutMode` field initially triggered an overly strict local check. Buyer session state and multiple windows also complicated a test run.

**Onboarding:** Sandbox registration, store/key configuration, return origins and a test buyer needed explicit guidance. The team avoided an unrelated paid seller subscription.

**Build again:** Yes, with fresh merchant/buyer acceptance before consequential releases.

## 5. Vercel

**Use:** Host the website, REST API, OAuth and streamed MCP endpoint on one stable domain.

**Worked well:** A single repository/build supplies frontend assets and a Node backend without depending on a developer laptop.

**Needs work:** Large card/GLB resources exceeded the earlier buffered response boundary and required streamed responses and artifact-level checks.

**Onboarding:** Full server bundling, included assets, shared state and canonical audience configuration required more than a frontend-only deployment.

**Build again:** Yes for this architecture, with persistent shared state and response-size checks.

## 6. Supabase JavaScript client and Data API

**Use:** Store designs, test orders and OAuth state; atomically consume short-lived authorization/refresh records across service instances.

**Worked well:** Shared state survives separate instances and restarts while local development can retain SQLite.

**Needs work:** Fresh-project Data API grants should be explicit alongside RLS. Sharing storage also does not create a shared browser guest identity.

**Onboarding:** Full schema application and a server-only key were important; health checks were followed by separate write acceptance.

**Build again:** Yes, with restricted table access, server-side ownership checks and migration validation.

## 7. React, Three.js, React Three Fiber, Rapier and Blender

**Use:** Procedural charms, original bag geometry, materials, interactive previews and reusable renders. Website motion uses Rapier; the card uses static WebGL.

**Worked well:** One configuration drives visual editing and product state. Bundled geometry avoids runtime asset generation and external model sign-in.

**Needs work:** Asset weight, first-frame loading and host restrictions need independent tests. Visual plausibility does not establish manufacturing accuracy.

**Onboarding:** Materials, attachment geometry and bounded motion took more iteration than the initial UI. New users can run the bundled result without Blender.

**Build again:** Yes, with asset budgets and physical-device performance acceptance.

## 8. TypeScript, Node.js, Express and Zod

**Use:** Typed frontend/backend contracts, Node HTTP services and Express routing, and runtime schemas at API/tool boundaries.

**Worked well:** Shared types and schemas keep previews, quotes and persistence aligned; schema errors are returned before an invalid configuration is saved.

**Needs work:** Compile-time types do not validate untrusted model or HTTP input. Runtime schemas still need compatibility, ownership and confirmation checks.

**Onboarding:** Basic routes and schemas were straightforward; cloud ESM bundling, runtime imports and cross-entry validation needed dedicated build and artifact checks.

**Build again:** Yes, with runtime validation and packaged-entry checks alongside TypeScript compilation.

## Friction log A — omitted Amazon Pay field

- **Task:** Verify a completed Sandbox session and captured charge.
- **Steps:** Prepare checkout, complete it with a Sandbox buyer, process the return and reread session/charge.
- **Expected:** Accept a matching captured Sandbox transaction while rejecting explicit conflicting checkout modes.
- **Actual:** The original validator rejected a matching response when `checkoutMode` was absent.
- **Severity:** Important; blocked the successful receipt.
- **Workaround/fix:** Accept missing/null mode, reject explicit conflicts, preserve ownership/amount/environment/charge checks and add regression coverage.
- **Suggestion:** Provide optional-field and completed-session retry JSON examples.
- **Evidence:** [payment service](../server/amazon-pay-service.ts), [API tests](../tests/amazon-pay-api.test.ts), [dated acceptance](VALIDATION.md).

## Friction log B — large hosted MCP resources

- **Task:** Deliver the full interactive UI and bag model through hosted MCP.
- **Steps:** Read the card resource and request the larger GLB via a real SDK client in the production-style backend.
- **Expected:** Receive complete content without truncation or function response-size errors.
- **Actual:** Larger resources exceeded the earlier buffered response boundary.
- **Severity:** Important; blocked full preview delivery.
- **Workaround/fix:** POST-scoped SSE Streamable HTTP and complete-content artifact/streaming checks.
- **Suggestion:** Publish a serverless MCP reference covering large resources, buffering proxies and failure diagnostics.
- **Evidence:** [HTTP transport](../server/mcp/http.ts), [streaming check](../scripts/mcp-streaming-check.mjs), [deployment](VERCEL_DEPLOY.md).

## Friction log C — frame policies and desktop message size

- **Task:** Render 3D inside a constrained frame and load it through local stdio.
- **Steps:** Test the original physics-enabled/large-asset card under strict CSP and the SDK's default stdio message limit.
- **Expected:** Show the interactive design without unsupported WebAssembly or external asset dependencies.
- **Actual:** Earlier checks reproduced a physics/WebAssembly block, host rejection of localhost assets and an oversized all-in-one stdio UI message.
- **Severity:** Important; connected tools could still fail to render the preview.
- **Workaround/fix:** Static WebGL in the card, bounded on-demand MCP assets, separate website motion; retest strict CSP and default message limits.
- **Suggestion:** Add a host-capability test matrix and incremental asset delivery example.
- **Evidence:** [CSP check](../scripts/widget-strict-csp-check.mjs), [desktop check](../scripts/mcp-desktop-check.mjs), [asset loader](../src/chatgpt/inlineAssets.ts).

## Proposed feature requests

| Request | Why | Priority |
| --- | --- | --- |
| Public Alexa+ simulation/validation tooling with explicit capability boundaries | Independent builders can reproduce an accepted environment | Important |
| Host capability report covering CSP, WebAssembly and resource limits | Diagnoses tools that connect successfully but cannot render | Important |
| Streamed serverless MCP large-resource reference | Prevents failures absent in small local examples | Important |
| Amazon Pay completed-session field/retry examples | Clarifies verification of optional response shapes | Nice-to-have |

Review these suggestions and subjective answers with the actual developers before copying into Devpost. No direct experience of unavailable Alexa+ partner tools is implied.
