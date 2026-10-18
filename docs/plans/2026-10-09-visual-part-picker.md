> Historical implementation plan, October 9, 2026. Some machine-specific assumptions and asset-delivery details were superseded. Use [current status](../STATUS.md), [ChatGPT setup](../CHATGPT.md) and [local stdio setup](../DESKTOP_MCP.md) for current behavior.

# Default 3D and visual part picker implementation plan

**Goal:** Open LOOP conversation previews in 3D and let users replace main and accent parts through illustrated selection cards.

**Architecture:** Reuse the existing MCP Apps widget and PartArt catalog illustrations. Extend loop_preview_design with an optional selectionSlot to open the relevant picker from conversation requests. Selection calls the authoritative quote tool and synchronizes model context, without saving or ordering automatically.

**Tech stack:** React, Three.js, MCP Apps AppBridge, Zod, Playwright.

1. Update src/chatgpt/main.tsx: default to 3D, start its timeout only after receiving a design, provide change buttons for every slot, and show compatible illustrated options with a current selection marker. Keep the existing illustration fallback.
2. Add selection handling: preserve the complete configuration, reject locked edits, clear pending checkout on successful edits, preserve saved draft IDs, and synchronize the updated configuration and price with the host model.
3. Update server/mcp/server.ts: validate optional selectionSlot against the selected template and describe the visual alternatives workflow in MCP instructions and tool metadata.
4. Add responsive styles in src/chatgpt/widget.css and English labels in shared/messages.json. Keep the existing subdued green and warm white design.
5. Extend tests/mcp.test.ts and scripts/chatgpt-browser-check.mjs for incoming picker requests, invalid slots, automatic 3D, main/accent changes, slot compatibility, locks, context updates, no incidental persistence, and mobile layout. Run TypeScript, tests, widget build, and browser verification.
6. Deploy the built widget and restart the MCP server with its existing public URL and OAuth storage. Verify local/public service health and provide the updated preview.

Acceptance: A main-part alternatives request opens charm cards; accent alternatives also include beads and a valid empty option. Selecting a card updates 3D and the server quote; save and test-order confirmation remain explicit actions.
