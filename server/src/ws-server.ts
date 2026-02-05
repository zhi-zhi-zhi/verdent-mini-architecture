import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer, IncomingMessage } from 'node:http';
import type { RunMode } from '@verdent-mini/core';
import { RPCServer } from '@verdent-mini/rpc';
import type { IAuthProvider } from '@verdent-mini/core';
import {
  authenticateConnection,
  type ConnectionContext,
} from '@verdent-mini/backend';

interface WebSocketServerOptions {
  httpServer: HTTPServer;
  rpcServer: RPCServer;
  authProvider: IAuthProvider;
  requireAuth: boolean;
  mode: RunMode;
}

/**
 * Create WebSocket server for RPC
 */
export function createWebSocketServer(options: WebSocketServerOptions): WebSocketServer {
  const { httpServer, rpcServer, authProvider, requireAuth, mode } = options;

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
  });

  console.log('WebSocket server listening on /ws');

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    // Extract token from URL query params
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    // Authenticate connection
    let context: ConnectionContext;
    try {
      context = await authenticateConnection(authProvider, token, requireAuth);
      console.log(`Client connected: ${context.sessionId} (auth: ${!!context.auth})`);
    } catch (error) {
      console.log('Connection rejected: authentication failed');
      ws.close(4001, 'Authentication required');
      return;
    }

    // Create transport adapter for this WebSocket connection
    const transport = {
      send: async (data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      },
      onMessage: (handler: (data: string) => void) => {
        ws.on('message', (data) => {
          handler(data.toString());
        });
      },
      disconnect: () => {
        ws.close();
      },
      isConnected: () => ws.readyState === WebSocket.OPEN,
    };

    // Add transport to RPC server
    rpcServer.addTransport(transport, context);

    // Handle connection close
    ws.on('close', () => {
      console.log(`Client disconnected: ${context.sessionId}`);
      rpcServer.removeTransport(transport);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${context.sessionId}:`, error);
    });
  });

  return wss;
}
