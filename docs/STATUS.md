# Current project status

Updated October 20, 2026. This is the current capability summary; dated evidence and older checks are in [VALIDATION.md](VALIDATION.md).

## Available

| Area | Implemented behavior |
| --- | --- |
| Website | Landing page, AI stylist, manual design studio, saved designs, review and test checkout |
| Catalog | Three structures, 14 parts, five cord colors, gold/silver hardware, USD itemized prices |
| 3D | Original models and materials, rotation, zoom, three bag previews and custom bag colors; bounded motion in the website studio |
| Conversational design | Catalog-based proposals, revisions, locked-part validation and editable previews |
| Storage | SQLite locally; Supabase in the hosted deployment; saved designs, test orders and visitor isolation |
| MCP | Version 2025-11-25, Streamable HTTP; 10 design tools plus one renderer asset tool |
| Authorization | OAuth discovery, dynamic registration, explicit guest consent, S256 PKCE, refresh rotation and revocation |
| MCP Apps | Inline 3D card, visual part selection, locks, rename, undo, saved-state feedback and test-order confirmation |
| Deployment | Fixed Vercel website/API/OAuth/MCP domain, shared OAuth persistence, streamed UI/model delivery |
| Payments | Separate Amazon Pay US Sandbox website checkout, server-verified amount/ownership/environment/capture status and retry handling |
| Local desktop | stdio entry with persistent local guest and on-demand MCP assets |

## Latest evidence

- October 20: Devpost non-video fields are saved in the existing LOOP draft and reviewed against the current rules. It remains **not submitted**; the required public YouTube/Vimeo video field is blank by owner instruction.
- The October 19 [2:31 walkthrough](review/README.md) records actual desktop OAuth consent, 3D design/revision, save/reopen and one explicitly confirmed simulated order. It is not independent second-account or mobile acceptance.
- October 20: **175/175 automated tests passed**; the complete build, packaged Vercel entry, streamed resources, desktop transport and isolated MCP smoke checks passed. Browser checks passed for explicit `?lang=en` entry support on the homepage, studio and web MCP client. New visitors already default to English; an explicit entry overrides a previous Chinese preference.

- October 18: **173/173 automated tests passed**, using isolated data and mocked model/provider behavior.
- The pre-documentation code baseline `d508741` passed GitHub CI: tests, complete build, Vercel artifact check, MCP streaming check and desktop stdio check.
- Hosted health, catalog, AI configuration and Amazon Pay configuration endpoints returned HTTP 200.
- A live MCP client negotiated **2025-11-25** over **SSE Streamable HTTP**, listed 11 tools, read the catalog, quoted and previewed a design, listed guest records and retrieved the full UI resource.
- Two real website-backed stylist calls produced a USD 12 cherry/pearl design and a silver revision preserving the locked cherry.
- Chrome rendered the studio's bag view and the MCP web client's catalog-example 3D preview. Browser MCP initialization/discovery/quote succeeded; the checked 390 px MCP layout had no horizontal overflow.
- October 13: a real Amazon Pay **Sandbox/Captured** transaction was verified and stored as `sandbox_paid`. This is a historical provider acceptance check, not a new payment performed during the October 18 review.

## Identity and commerce limits

Guest cookies identify a browser workspace. There is no verified customer registration, cross-device account recovery, or automatic sharing between unrelated browser/stdio guests. Using the same browser for website and hosted OAuth consent can bind that connection to the same guest workspace.

Natural-language budget interpretation is model-driven. The server enforces catalog compatibility, locks and authoritative prices; it does not treat a conversational budget as a hard spending cap.

MCP confirmation creates a test order. Amazon Pay Sandbox is a separate website payment flow. Neither charges real money, reserves inventory, manufactures goods, or ships. 3D colors, dimensions and attachment fit are illustrative.

## Remaining validation and production work

- Independent second-account ChatGPT OAuth, card interaction, save and confirmation acceptance.
- Target-host verification of the current card under that host's actual enforced CSP; local strict-CSP checks do not establish every host's behavior.
- Physical mobile and low-end GPU performance; broad Windows/Linux/desktop-host acceptance.
- Verified customer accounts, deployment-wide rate limits, operations monitoring, backups and a commerce administration system.
- Real Alexa+ devices/voice runtime and partner-only tooling are outside the current prototype.
- Final video review and public YouTube/Vimeo upload, owner review and actual Devpost submission. The existing website-hosted walkthrough alone does not satisfy the required video host. See the [checklist](DEVPOST_CHECKLIST.md).

Automated tests and historical acceptance records are not a claim that every external host or provider was re-tested today.
