# Product brief

Updated October 18, 2026.

## Customer problem

People personalizing an everyday bag often know a mood or color but not the names of compatible parts. A flat product grid makes it difficult to imagine the finished combination and compare the cost of small changes.

LOOP connects a natural-language brief to an editable catalog configuration, a 3D preview and a server-calculated quote. The working prototype is intended for people exploring personal accessories and for a future small catalog retailer offering guided customization. Customer demand and commercial conversion have not been measured.

## User journey

1. Describe a bag, style, occasion and budget, or choose an existing design.
2. Receive a catalog-valid proposal and itemized USD quote.
3. Rotate the charm and view it on an illustrative bag.
4. Lock a favorite part and revise the rest through conversation or visual choices.
5. Name and save a draft, then return to edit it in the same guest workspace.
6. Review the exact configuration and quote before explicitly confirming a test order.
7. Optionally use the website's separate Amazon Pay US Sandbox demonstration.

## Product surfaces

| Surface | Role |
| --- | --- |
| Website | Discovery, AI stylist, manual 3D editing, saved designs, test checkout and Amazon Pay Sandbox |
| ChatGPT MCP Apps | Conversational host and interactive card with catalog choices, locks, saves and confirmed test orders |
| MCP web client | Real Streamable HTTP demonstration with a visible protocol trace |
| Local stdio | Compatible desktop-host connection using the same tools and UI resource |

## Design rules

Three templates define compatible slots and connectors. Each part has a stable ID, category, material, appearance and sample price. The server validates selections and recalculates prices for every quote and checkout.

One shared configuration drives previews, saves and quotes. Locked slots must survive conversational revisions. Quote preparation does not create an order; explicit confirmation does. Retrying the same valid confirmation is idempotent.

The catalog contains 14 parts and five cord colors. The three bag models and custom bag colors affect preview appearance without changing the charm quote. USD sample prices are derived by rounding original CNY unit prices divided by seven; historical orders retain their confirmed currency and price.

## Technical implementation

TypeScript, React, React Three Fiber/Three.js, Express, the official MCP TypeScript SDK and MCP Apps. The website stylist uses OpenAI Responses and structured output. SQLite supports local development; the hosted Vercel deployment uses Supabase for business and OAuth state. The website uses the Amazon Pay SDK for its separate Sandbox integration.

The MCP server implements 2025-11-25 over Streamable HTTP, with ten design tools and one renderer asset tool. Shared business services serve REST and MCP. OAuth uses visitor consent and S256 PKCE; large card/model responses stream over HTTP.

## Scope and limits

This is a hackathon prototype, with guest identities and simulated commerce. It has no inventory, verified customer accounts, real fulfillment or manufacturing calibration. The model interprets a budget; the authoritative quote must still be reviewed. There is no real Alexa+ device integration or claim of Amazon/OpenAI directory publication.

Current evidence is in [STATUS.md](STATUS.md) and [VALIDATION.md](VALIDATION.md). Historical design references are in [DESIGN.md](../DESIGN.md) and [plans/](plans/).
