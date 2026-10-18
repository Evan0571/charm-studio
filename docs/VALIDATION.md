# Validation record

Current review: October 18, 2026. Historical entries describe the versions and environments tested at the time. Mocked, local and live checks are distinguished below.

## October 18 — public showcase documentation checks

The showcase update changed documentation, license and package metadata, with no runtime/dependency changes. Local checks passed: **173/173 tests**, MCP smoke with isolated save/confirmation/retry, complete TypeScript/frontend/MCP UI/server build, Vercel artifact import, large-resource HTTP SSE transfer and offline desktop stdio. A documentation check verified **152 relative links/anchors** across 23 Markdown files, and the README screenshot/render was inspected.

Before public release, 444 historical Git blobs and 10 GitHub issue/comment records were checked for credential patterns and current local secret values, without findings. Private configuration and payment evidence remain ignored. This is a scoped publication check, not a guarantee that every possible sensitive datum is absent.

## October 18 — submission-readiness review

Code baseline: `d508741` on `master` before the documentation/public-showcase update.

| Check | Result and boundary |
| --- | --- |
| Automated tests | **173 passed, zero failed**; isolated data and mocked model/provider calls |
| Baseline CI | [Successful run](https://github.com/Evan0571/charm-studio/actions/runs/38484350394): tests, complete build, Vercel artifact, streaming and desktop checks |
| Hosted endpoints | Health, catalog, AI configuration and Amazon Pay configuration returned HTTP 200 |
| Anonymous MCP | HTTP 401 with expected protected-resource metadata challenge |
| Discovery | Protected resource and authorization-server metadata available; canonical hosted URL and S256 PKCE advertised |
| Protocol | Explicit **2025-11-25** initialization succeeded with `text/event-stream` over Streamable HTTP |
| Live SDK calls | Listed **11 tools**; catalog, quote, preview, guest design/order lists and full UI resource succeeded |
| Widget delivery | Full `ui://loop/design-v5.html` resource retrieved, approximately 6.08 MB |
| Real backend AI | Two calls generated a USD 12 cherry/pearl design and a silver revision preserving the locked cherry |
| Browser visuals | Chrome rendered the studio bag view and the MCP web client's deterministic-example 3D view |
| Web MCP trace | Initialization, tools/list, catalog and quote succeeded |
| Narrow layout | Checked 390 px MCP layout had no horizontal overflow |

No new hosted order or Amazon Pay payment was created during this review. Direct SDK initialization and web-client use do not constitute a new real-ChatGPT-account acceptance test. A brief initial 3D loading interval is expected before the first rendered frame.

## October 13 — real Amazon Pay Sandbox acceptance

The website's separate Sandbox integration completed a USD 15 test transaction using a real Sandbox buyer. Amazon returned Sandbox/Captured. The service checked session/order binding, one-time permission, currency/amount and captured charge before persisting `sandbox_paid`.

The first completion was performed by a corrected local service against the same production database and Amazon Sandbox API, then the correction was deployed. The website subsequently read and re-verified the same transaction. This was not a mocked provider or a manually edited paid status; it did not charge real money or ship goods.

Tests reached **173/173** after correcting an omitted `checkoutMode` response field and completion retries. Configuration and transaction evidence remain private. Provider acceptance on this date does not guarantee a newly created merchant setup will work without its own testing.

## October 13 — hosting and MCP delivery

The fixed Vercel domain served the website and OAuth/MCP endpoints without a Vercel login. Discovery and anonymous challenges were checked. Shared OAuth was tested against independent service instances with a real Supabase development flow, including atomic authorization-code/refresh consumption, restart continuity, same-draft updates, visitor isolation and revocation.

Large UI and GLB content passed real local HTTP SSE streaming checks beyond the buffered-response boundary. The streaming script uses in-memory storage and no external providers. Desktop stdio checks use the SDK's default message limit and no external network access.

The current implementation has ten design tools and an additional renderer asset tool. Older records referring to ten tools predate or exclude that internal tool.

## Earlier acceptance summaries

- A clean macOS/Apple Silicon copy installed with the frozen lockfile, started with no copied keys/databases and passed its then-current 54 tests, build and MCP smoke checks. The package cache was reused; this was not a completely uncached physical new-machine test.
- Local AppBridge/browser checks exercised OAuth/PKCE, iframe CSP, visual choices, lock context, same-draft revisions, cancellation, explicit test confirmation, USD quotes and narrow layouts. AI was stubbed.
- Strict-CSP preview checks disabled WebAssembly and external asset connections. The card used static WebGL and bundled/MCP-provided assets; website physics remained separate.
- The author's real ChatGPT account completed OAuth, catalog, interactive preview, bag-view and locked-cherry/silver-revision checks. Earlier records used CNY sample prices. That session did not validate every save/order action, and its development UI reported CSP off.
- Earlier 3D geometry/physics checks covered hanging contacts, bounded initial movement, template/connector variations, bag color restoration and original model asset integrity. These do not establish manufacturing accuracy.

Detailed older source changes and local records remain in Git history. Current capabilities are summarized in [STATUS.md](STATUS.md).

## Still requiring target-environment acceptance

Independent second-account ChatGPT OAuth/card/save/confirmation; target-host enforced CSP; physical mobile/low-end GPU performance; broad Windows/Linux and desktop host rendering; and the final recorded demo. Automated/local results do not replace these checks.
