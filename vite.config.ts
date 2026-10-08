import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()], server:{host:'127.0.0.1'}, build:{outDir:'dist',rollupOptions:{input:{studio:'index.html',mcpDemo:'mcp-demo.html'}}}});
