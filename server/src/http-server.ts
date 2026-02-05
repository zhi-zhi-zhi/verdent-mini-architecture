import express from 'express';
import { createServer, type Server as HTTPServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface HTTPServerOptions {
  port: number;
  staticDir?: string;
}

/**
 * Create HTTP server for static files and health checks
 */
export function createHTTPServer(options: HTTPServerOptions): {
  app: express.Application;
  server: HTTPServer;
  start: () => Promise<void>;
} {
  const { port, staticDir } = options;

  const app = express();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // API info endpoint
  app.get('/api/info', (req, res) => {
    res.json({
      name: 'Verdent Mini Server',
      version: '1.0.0',
      wsEndpoint: '/ws',
    });
  });

  // Serve static files (for Web mode)
  if (staticDir) {
    const absoluteStaticDir = path.isAbsolute(staticDir)
      ? staticDir
      : path.join(__dirname, staticDir);

    app.use(express.static(absoluteStaticDir));

    // SPA fallback - serve index.html for all other routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(absoluteStaticDir, 'index.html'));
    });

    console.log(`Serving static files from: ${absoluteStaticDir}`);
  }

  const server = createServer(app);

  const start = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      server.listen(port, () => {
        console.log(`HTTP server listening on port ${port}`);
        resolve();
      });

      server.on('error', reject);
    });
  };

  return { app, server, start };
}
