import { build } from 'esbuild';

// Resolve all repo-local TypeScript imports into one Node ESM module. Keep
// runtime packages external so Vercel's normal tracing includes their files.
await build({
  entryPoints: ['server/vercel-entry.ts'], outfile: 'dist-server/app.mjs',
  bundle: true, platform: 'node', format: 'esm', target: 'node22.13',
  packages: 'external', sourcemap: false,
});
console.log('Built the Vercel Node handler in dist-server/app.mjs.');
