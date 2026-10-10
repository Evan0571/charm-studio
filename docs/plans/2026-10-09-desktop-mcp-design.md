# Desktop MCP connection for the verified visual picker

Target: this computer's ChatGPT desktop app. Preserve the accepted default-3D and illustrated main/accent picker source and built assets.

Use the existing official-SDK MCP server over stdio, launched by the desktop plugin. This avoids a changing public development URL and cloud-side OAuth discovery for localhost. Public HTTP connections retain their existing OAuth implementation. Web/mobile deployment remains outside this desktop connection.

The entrypoint reuses the catalog, quote service, resource metadata and UI bundle. A persistent local desktop visitor profile owns saved designs; existing database records are preserved. The local website remains running on port 3000 to serve 3D assets. No separate model API key is required: the ChatGPT model chooses catalog configurations.

Update the existing personal private loop-new package in place with its identity, audience and default prompt preserved. Configure its real local executable, repository working directory and stdio entrypoint; add a workflow skill for natural-language design and replacement requests.

Verification: real SDK stdio initialize/tools/list, catalog, 3D preview resource, main/accent selection metadata, quote changes, reconnect and process cleanup using isolated test storage. Confirm the accepted UI files have unchanged hashes. Then verify the installed ChatGPT desktop host with a fresh conversation; package upload is not host verification.
