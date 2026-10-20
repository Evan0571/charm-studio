# Devpost submission copy

**Owner-review draft, October 20, 2026. Not submitted.** The [Devpost draft](https://devpost.com/software/loop-bievcp) contains the project story, images, links and additional information. The owner confirmed the team, eligibility, US residence, learning and conditional tool-reuse answers. A recorded walkthrough exists, but the required public YouTube/Vimeo video link is still absent. The [checklist](DEVPOST_CHECKLIST.md) tracks the remaining work.

## Project name

LOOP

## Tagline

Turn a styling idea into an editable 3D bag charm, one conversation at a time.

## Inspiration

Personalizing an everyday bag starts with a feeling: a color, a favorite detail or a look for an occasion. A product grid does not make it easy to imagine how separate charms and beads will look together. We wanted a conversation to lead to something people could inspect and keep changing.

## What it does

LOOP turns a brief into a bag-charm configuration using a defined catalog. Users can rotate a 3D preview, see the charm on an illustrative bag, choose parts visually, lock a favorite detail and revise the rest through conversation. They can save the design and return to it in the same guest workspace.

Each design has an itemized USD quote calculated by the server. A test order is created only after a separate review and confirmation. The website also demonstrates a distinct Amazon Pay US Sandbox checkout with server-side transaction verification. All orders and payments are demonstrations, without real charges or shipping.

## How we built it

The Alexa+ track integration is a self-hosted MCP server implementing protocol 2025-11-25 over Streamable HTTP. Ten design tools and one renderer asset tool share the website's catalog, validation, pricing and persistence services. ChatGPT can use its own model to read the catalog, construct a design and display an interactive MCP Apps card. A web client independently exercises real MCP initialization, discovery and tool calls, with an inspectable trace.

The frontend uses React, TypeScript, Three.js and React Three Fiber. Original procedural geometry and Blender-authored bag models form the preview; third-party material maps and lighting retain their CC0 provenance. The independent website stylist uses OpenAI Responses with structured output, followed by server validation.

Express serves the backend. SQLite supports local use; the Vercel deployment uses Supabase for designs, test orders and shared OAuth records. OAuth provides guest consent, S256 PKCE, refresh rotation and revocation. Large preview resources use streamed responses and on-demand asset transfer. Amazon Pay's SDK powers the separate website Sandbox integration.

## Challenges

An assistant's prose, an editable card and a saved record must describe the same object. We use a shared configuration and authoritative server quotes, preserve locked slots during revisions, and carry a saved draft ID through subsequent changes.

Rendering detailed 3D inside constrained host frames also required work. We separated the card's static WebGL path from website physics and moved larger assets into bounded, on-demand MCP transfers. Shared OAuth persistence allows independent hosting instances to continue the same authorized workflow.

Sandbox payments required validating the provider's actual response shapes while still rejecting conflicting amounts, ownership, environments and charge states. Product feedback describes the specific compatibility issues and workarounds.

## What we are proud of

A user can move from an idea to a visible, editable object, keep a chosen detail, return to a saved draft and review an exact quote. The interaction extends beyond a single AI answer into a stateful design workflow. The repository includes the source, bundled assets, an MIT license and English instructions for reproducing it.

## What we learned

A useful conversational interface needs explicit product state and understandable controls. Server-side rules make model-generated configurations reviewable, while visual selection and locks give the user direct control. Host rendering and resource limits also need to be tested separately from protocol connection success.

## What's next

Independent target-host and mobile acceptance, better loading performance, verified customer accounts and cross-device recovery, user research with accessory shoppers, and measured catalog/retailer trials. Real inventory, manufacturing and fulfillment would require additional systems. There is no claim of a production retail launch or measured commercial impact.

## Built With

Model Context Protocol; MCP Apps; TypeScript; React; Three.js; React Three Fiber; Express; OpenAI Responses API; SQLite; Supabase; Vercel; Amazon Pay Sandbox; Blender.

Use the closest actual Devpost tags. Do not add AWS services, Kiro Crew or gated Alexa+ SDKs without real usage evidence.

## Links

- Source: https://github.com/Evan0571/charm-studio
- Website: https://loop-charm-studio.vercel.app/?lang=en
- Real MCP web client: https://loop-charm-studio.vercel.app/mcp-demo.html?lang=en
- MCP URL: `https://loop-charm-studio.vercel.app/mcp`
- English reviewer guide: https://github.com/Evan0571/charm-studio/blob/master/docs/TESTING.md
- Demo video: **the existing walkthrough still needs the required public YouTube/Vimeo upload and final team review**

## Track and development statement

Primary track: **Alexa+ — self-hosted MCP server**, demonstrated through ChatGPT/MCP Apps and a real web MCP client. No real Alexa+ device or partner-only runtime is connected.

LOOP was created from scratch during the hackathon submission period, as confirmed by the project owner. Repository development began on October 8, 2026. The project includes the conversational MCP workflow, editable 3D card, saved-draft revisions, hosted OAuth and explicitly confirmed sandbox checkout.
