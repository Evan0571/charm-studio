# LOOP Sandbox — public directory submission

Prepared October 18, 2026; recording and publication checks updated October 19, 2026. Hosted MCP version **0.2.1**. Publication support changes deployed in commit `9ac0e32`.

**Draft only: no review submission, approval, or public publication is established by this document.** The owner completed the Persona verification flow on October 18, 2026. On October 19, the user reported **Verified**, and the upload dialog offered **Individual — YIFAN SONG**. The prepared ZIP uses that verified publishing identity.

## October 19 upload record

- Package **0.2.1** uploaded successfully and created [the Platform draft](https://platform.openai.com/plugins/manage/plugin_asdk_app_6ad661daee488191af1f5dc7ed1b647e).
- Plugin ID: `plugin_asdk_app_6ad661daee488191af1f5dc7ed1b647e`.
- Initial draft submission ID: `appsub_6ad661daee7c8191a2837bf48f93befc`.
- Name, verified individual, logo, description, OAuth/DCR configuration, and five positive/three negative review cases were imported. The listing visibly includes **SANDBOX TESTING ONLY**.
- Package **0.2.2** added the terms URL. The terms, updated privacy/operator details, and exact domain challenge are deployed and verified on the production origin.
- After domain verification, the portal's actual OAuth flow completed successfully. The MCP panel shows **Configured**, **Authorized**, and **Domain verified**. All 11 tools were discovered; the latest rescan reported **No findings in the latest MCP scan**.
- Reviewer guest-consent steps were saved in the private dashboard. LOOP has no email/password login; username/password fields were deliberately left empty rather than inventing credentials. The portal offers no explicit guest-consent sign-in option, so final validation may still require clarification.
- Package **0.2.3** adds the real walkthrough URL. Its video is 2 minutes 31 seconds, with synthesized English narration, real desktop capture, chapter labels, and an explicit sandbox notice. See [recording scope and evidence](review/README.md).
- The public domain challenge token is served by the exact `/.well-known/openai-apps-challenge` route. It is a public ownership-verification value, not a client secret. Preserve the token associated with this draft when deploying.

## Accurate sandbox disclosure

> LOOP Sandbox is for sandbox testing. Its test orders do not charge money, reserve stock, manufacture, or ship. The website's separate Amazon Pay Sandbox integration also uses test transactions. Prices and 3D previews are illustrative. OAuth connects a browser guest workspace, not a verified customer account or a cross-device account.

This disclosure is included in the plugin name, package summary, full listing description, commerce declaration, release notes, and test cases. It must remain accurate in the listing and reviewer materials.

The official [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines#quality-and-reliability) currently state: **“Trial or demo plugins will not be accepted.”** Sandbox labeling is truthful disclosure, not an exception to this requirement. The present prototype cannot be represented as a production retailer to gain acceptance. Public availability remains an OpenAI review decision; uploading a draft does not make it public.

## Package

- Source folder: [`plugins/loop-sandbox/`](../plugins/loop-sandbox/).
- Manifest: [`plugin.json`](../plugins/loop-sandbox/plugin.json).
- Remote MCP configuration: [`mcp.json`](../plugins/loop-sandbox/mcp.json).
- Existing original project logo, copied without redesign: `assets/loop.svg`.
- Original MIT license: `LICENSE`.
- Build the ZIP with the command below. It includes only those four package files, with `plugin.json` at the archive root; it contains no `.env`, credentials, browser data, databases, source bundles, or private reviewer records.

```bash
python3 - <<'PY'
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
root = Path('plugins/loop-sandbox')
output = Path('tmp/loop-publication/loop-sandbox-0.2.3.zip')
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for relative in ['plugin.json', 'mcp.json', 'assets/loop.svg', 'LICENSE']:
        archive.write(root / relative, relative)
print(output.resolve())
PY
```

The package author and developer label are `YIFAN SONG`, matching the verified individual offered by the upload dialog. The source repository remains under the public GitHub handle `Evan0571`. Do not invent a company or support email.

Package 0.2.3 includes `termsOfServiceURL`, pointing to the deployed `/terms.html`, and `review.demo_recording_url`, pointing to the public MP4 in this repository. A draft upload remains distinct from review submission or approval.

## Upload and final-review work

1. **Owner identity (complete):** the verified individual is available in the upload dialog. Do not put identity documents, verification codes, or passwords in this repo or chat.
2. **Upload:** open [Platform Plugins](https://platform.openai.com/plugins), choose **Upload new or existing plugin**, select the verified identity, and upload the ZIP as **With MCP**. Prefer the existing Platform draft if one is subsequently created; do not assume the personal custom plugin ID is already a public submission.
3. **MCP setup:** connect `https://loop-charm-studio.vercel.app/mcp`, OAuth with Dynamic Client Registration, scope `loop:studio`. Leave static client credentials blank. Discovery supplies the registration/authorization/token endpoints. Do not choose unauthenticated access or embed a bearer token.
4. **Domain verification (complete):** the portal's exact challenge is deployed as plain text at `https://loop-charm-studio.vercel.app/.well-known/openai-apps-challenge`. The dashboard shows Domain verified. Preserve this draft's token.
5. **Scan (complete for current desktop publisher connection):** OAuth completed and all 11 tools were scanned with no findings. This is not acceptance of an independent recipient's connection.
6. **Required public pages (deployed):** product, privacy, support, and service terms URLs are included. The terms identify the actual operator and sandbox boundaries. Do not claim nonexistent deletion controls, automatic retention, real inventory, or fulfillment.
7. **Review details:** paste the reviewer-access text below into the private Review details form. No password is required by LOOP's current guest-consent flow. Explain that fact rather than supplying a real user's credentials or inventing a demo password. Resolve any reviewer requirement for account authentication with OpenAI if guest consent is insufficient.
8. **Run review cases:** the ZIP contains exactly five positive and three negative cases. The desktop recording covers their main user flows against the real hosted service. It does not prove independent second-account linking, physical-mobile rendering, adversarial server isolation, or idempotent replay through the ChatGPT UI. Initial card loads required Try again; this is retained in the recording.
9. **Video (created):** [public MP4](https://raw.githubusercontent.com/Evan0571/charm-studio/master/docs/review/loop-sandbox-walkthrough.mp4), [English captions](review/loop-sandbox-walkthrough.en.srt), and [narration](review/walkthrough-narration.md). The capture excludes browser chrome, authentication secrets, cookies, codes, and unrelated private records. Only the owner-approved sample draft and one simulated order are shown.
10. **Submit and publish:** after required findings and materials are complete, inspect the final draft and required attestations. The owner must personally accept any new legally binding terms. Submit the truthful sandbox description for review only if it meets the applicable requirements. After approval, publish the approved version; approval alone does not list it publicly.

## Reviewer access — for the secure dashboard form

Keep this outside plugin metadata; the package importer does not accept reviewer-instruction or credential fields.

```text
LOOP uses OAuth guest-workspace consent. There is no LOOP email/password login, MFA, signup, or test-account password. No private credentials are needed.

Start from the installed plugin with the remote MCP URL https://loop-charm-studio.vercel.app/mcp. OAuth Dynamic Client Registration and S256 PKCE are supported; request loop:studio and the MCP URL as the resource. On first protected use, follow ChatGPT's native connection flow. The LOOP consent page is titled "连接你的 LOOP 工作台"; "授权连接" means authorize, and "取消" means cancel. Consent connects the browser's current guest workspace.

Use a new isolated browser profile for review. The catalog is seeded and needs no account data; test case 4 creates the review sample draft, and test case 5 optionally creates a simulated test order after explicit confirmation. Keep the same guest workspace and plugin connection throughout those cases. A fresh browser or cleared guest cookie identifies a different workspace. A standalone /authorize URL is insufficient: the host must supply its registered client, callback, state, resource, and PKCE parameters.

SANDBOX ONLY: all orders are simulated; no payment, stock reservation, manufacturing, or shipping. The MCP card does not open Amazon Pay. Website Amazon Pay Sandbox is a separate optional demo and is not a prerequisite for reviewing the plugin. Do not use real payment credentials.

Review limitations: independent second-account linking and physical mobile rendering still require acceptance. Tool-level protocol success does not establish native ChatGPT consent UI or 3D rendering success.
```

## Tool annotation explanations

The booleans below reflect the current server declarations; submit explanations against the actual tool scan. `idempotentHint` is included for reviewer clarity.

| Tool | Read only | Destructive | Open world | Idempotent | Explanation |
| --- | --- | --- | --- | --- | --- |
| `loop_get_preview_asset` | true | false | false | true | Reads only a validated bundled public asset; no writes or arbitrary destinations. Renderer visibility is app-only. |
| `loop_get_catalog` | true | false | false | true | Reads the defined catalog and starter configurations. |
| `loop_suggest_design` | true | false | true | false | Returns a proposal without saving or ordering; may send the provided design brief to the configured external AI provider, and output can vary. |
| `loop_quote_design` | true | false | false | true | Validates a configuration and computes its quote without writing. |
| `loop_save_design` | false | true | false | false | Creates or overwrites an owned saved draft. Existing draft content can be replaced; omitting an ID can create a new record on retry. |
| `loop_list_designs` | true | false | false | true | Reads only drafts belonging to the connected guest workspace. |
| `loop_get_design` | true | false | false | true | Reads one owned draft and recalculates its quote; foreign IDs remain inaccessible. |
| `loop_prepare_test_order` | true | false | false | true | Does not create an order or charge money. Returns an expiring signed confirmation token for a validated configuration and quote; token bytes may differ. |
| `loop_confirm_test_order` | false | false | false | true | Creates a simulated order only from an explicitly confirmed, owner-bound token; retries of the same valid token return the same order. It does not overwrite a draft, charge, or ship. |
| `loop_list_orders` | true | false | false | true | Reads only the connected workspace's simulated-order records. |
| `loop_preview_design` | true | false | false | true | Returns validated configuration, catalog, quote, and an interactive UI resource without saving or ordering. |

## Evidence boundaries

- Hosted OAuth version 0.2.1 supports per-tool OAuth metadata and a first-use `mcp/www_authenticate` challenge; prior production protocol acceptance covered DCR, consent, S256 PKCE, catalog, preview, refresh, revocation, and the inline UI resource.
- [CI for 53959f7](https://github.com/Evan0571/charm-studio/actions/runs/39152026850) passed 175 automated tests plus build and transport checks. Isolated automated tests are not native ChatGPT review runs.
- [CI for publication support commit 9ac0e32](https://github.com/Evan0571/charm-studio/actions/runs/39303612022) passed automated tests, builds, artifacts, transport, and desktop checks. The live challenge endpoint and terms were verified separately.
- The real desktop walkthrough shows catalog/3D preview, locked revision, alternatives, save/list/reopen/update of the same owned draft, exact quote review, one explicitly approved test order and order readback, plus model refusals for three negative prompts. It does not show server rejection of a foreign-ID request or repeated order-token replay; automated checks and UI evidence remain distinct.
- The current friend's original plugin still has an unresolved linking problem. Do not mark that account or its UI as verified.
- A directory listing would provide a supported discovery/install route for eligible accounts; it would not guarantee every account, region, client, OAuth connection, or 3D renderer succeeds.

Official references: [submission](https://developers.openai.com/plugins/deploy/submission), [packaging and OAuth](https://developers.openai.com/plugins/build/plugins), [submission errors](https://developers.openai.com/plugins/deploy/submission-errors), [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).
