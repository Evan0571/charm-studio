import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One self-contained JS/CSS pair for MCP resources/read. No relative chunk URLs
// or development HMR connections are allowed inside the host's sandbox iframe.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist-mcp',
    lib: { entry: 'src/chatgpt/main.tsx', name: 'LoopWidget', formats: ['iife'], fileName: () => 'loop-widget.js', cssFileName: 'loop-widget' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
