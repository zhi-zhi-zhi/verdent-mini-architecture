import type { RunMode } from '@verdent-mini/core';
import { RPCServer } from '@verdent-mini/rpc';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '@verdent-mini/backend';
import { createHTTPServer } from './http-server.js';
import { createWebSocketServer } from './ws-server.js';

// Configuration from environment
const PORT = parseInt(process.env.PORT || '3001', 10);
const MODE = (process.env.MODE || 'web') as RunMode;
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';
const STATIC_DIR = process.env.STATIC_DIR || '../../packages/frontend/dist';

async function main() {
  console.log('Starting Verdent Mini Server...');
  console.log(`Mode: ${MODE}`);
  console.log(`Auth required: ${REQUIRE_AUTH}`);

  // Create auth provider
  const authProvider = new SimpleTokenProvider();

  // Create RPC server
  const rpcServer = new RPCServer();

  // Add auth middleware
  rpcServer.use(
    createAuthMiddleware({
      provider: authProvider,
      requireAuth: REQUIRE_AUTH,
    })
  );

  // Create agent and register handlers
  const agent = new MockAgent(MODE);
  registerHandlers(rpcServer, agent, MODE);

  // Create HTTP server
  const { server: httpServer, start } = createHTTPServer({
    port: PORT,
    staticDir: MODE === 'web' ? STATIC_DIR : undefined,
  });

  // Create WebSocket server
  createWebSocketServer({
    httpServer,
    rpcServer,
    authProvider,
    requireAuth: REQUIRE_AUTH,
    mode: MODE,
  });

  // Start server
  await start();

  console.log(`\nServer ready!`);
  console.log(`- HTTP: http://localhost:${PORT}`);
  console.log(`- WebSocket: ws://localhost:${PORT}/ws`);
  
  if (MODE === 'web') {
    console.log(`\nOpen http://localhost:${PORT} in your browser`);
  }

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
