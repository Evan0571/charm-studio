// Vite files are served by the CDN. Every REST/MCP/OAuth route is rewritten
// here with its original URL. The build emits portable Node ESM JavaScript;
// no TypeScript loader, development middleware or listen() is needed.
export { default } from '../dist-server/app.mjs';
