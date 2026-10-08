// Set this in JavaScript so pnpm start also works in Windows shells.
process.env.NODE_ENV = 'production';
await import('../server/index.ts');
