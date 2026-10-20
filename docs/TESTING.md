# Reviewer testing guide

LOOP is a working bag-charm design prototype for the Alexa+ track. The hosted website and actual web MCP client are free to try without an account, installation or visitor-supplied API key.

## 1. Open the website

[https://loop-charm-studio.vercel.app/?lang=en](https://loop-charm-studio.vercel.app/?lang=en)

New visitors start in English. `?lang=en` also opens English when this browser previously selected Chinese. The language selector remains available; visits without an explicit language use the saved preference.

Use **Make it yours** or open [the studio](https://loop-charm-studio.vercel.app/#/studio). Wait for the 3D assets to load. Rotate/zoom, change the main charm or accent, and switch between **The charm** and **On a bag**. The configuration and USD quote should update together. Bag appearance does not change the charm price.

## 2. Test the conversational MCP workflow

Open [the MCP web client](https://loop-charm-studio.vercel.app/mcp-demo.html?lang=en), then:

1. Click **Connect to the studio**. The status should show **Connected · 11 tools**.
2. Enter: `Create a hero design with a cherry charm and a pearl for my brown tote, under 15 USD.`
3. Click **Send idea** and wait for a proposal. The model's chosen layout/wording can vary; inspect the actual quote.
4. Check the cherry's lock checkbox, then ask: `Keep the locked cherry and pearl. Change the hardware to silver.`
5. Verify the selected cherry remains and the hardware changes.
6. Expand **MCP calls and connection settings** to see successful initialization, discovery and tool calls. Do not reveal external connection credentials while recording.

If the hosted AI provider is unavailable, use **Try a catalog example**. That is a deterministic example, not an AI response; quotes, saves and test checkout still use real MCP.

## 3. Save and reopen

Click **Save design**. Open **My designs** using the client link or [Your collection](https://loop-charm-studio.vercel.app/#/saved) in the same browser. Reopen the draft, change a detail and save. Reload to verify persistence.

The same domain/browser guest is required. A different browser or private window intentionally has separate records.

## 4. Review and confirm a test order

In the MCP web client, click **Review quote and test order**. Verify configuration, itemized USD amount and test-only notice. **Cancel** creates no order. Prepare again and choose **Create test order** only if you intend to create a demo record. Use **Load saved records** to retrieve it.

The confirmation is bound to the exact quote/configuration/guest and expires after ten minutes. Repeated use of the same valid token returns the same order. The server does not charge money, reserve stock or ship.

## 5. Optional ChatGPT card

Follow [CHATGPT.md](CHATGPT.md) using OAuth and `https://loop-charm-studio.vercel.app/mcp`. A custom-MCP-enabled account/workspace is required only for this route. Try the catalog/preview prompt, lock a part, revise it and use card actions. Rendering depends on host support; the web MCP client remains independently testable.

## 6. Optional website Amazon Pay Sandbox

In the website studio, choose **Review design**, then **Continue with Amazon Pay sandbox**. This is a separate integration from the MCP card's test checkout. It needs a Sandbox test buyer, not a normal live buyer account. The service verifies the returned captured Sandbox transaction before showing success. Do not enter real payment credentials for a demonstration.

Reviewer evaluation does not depend on having a Sandbox buyer: the ordinary test-order route above demonstrates confirmation and persistence. [Payment configuration and acceptance](ENVIRONMENT.md#amazon-pay-sandbox).

## 7. Run the source locally

Follow [SETUP.md](SETUP.md) with Node 24 and pnpm 11.25.0. No credentials are needed for local manual design, deterministic MCP examples, saving and test orders. A provider key enables the website AI. `pnpm test`, `pnpm mcp:smoke` and `pnpm build` cover isolated automated checks.

## Expected prototype limits

Guest identities do not provide cross-device customer accounts. Conversational budgets are model-interpreted, not hard server caps. The quote is authoritative and must be reviewed. 3D models illustrate appearance and proportion, without calibrated manufacturing dimensions. Real Alexa+ hardware and partner-only tools are not connected.

See [current status](STATUS.md), [dated validation](VALIDATION.md), and [privacy notice](https://loop-charm-studio.vercel.app/privacy.html).
