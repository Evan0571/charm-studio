import { createApp } from './app';
import { storageFromEnvironment } from './storage';
import { mcpOptionsFromEnvironment } from './mcp/auth';

export function createVercelApp() {
  // Validate cloud configuration before constructing any storage adapter, so
  // missing credentials can never fall back to creating a local SQLite file.
  const options = mcpOptionsFromEnvironment();
  const app = createApp(storageFromEnvironment(), undefined, options);
  if (process.env.VERCEL === '1') app.set('trust proxy', 1);
  return app;
}
