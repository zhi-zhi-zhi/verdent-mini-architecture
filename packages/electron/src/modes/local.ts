import { ipcMain } from 'electron';
import type { RunMode } from '@verdent-mini/core';
import { RPCServer } from '@verdent-mini/rpc';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '@verdent-mini/backend';

/**
 * Setup local mode
 * Backend runs directly in the main process
 */
export function setupLocalMode(): { server: RPCServer; cleanup: () => void } {
  const mode: RunMode = 'local';

  // Create agent and RPC server
  const agent = new MockAgent(mode);
  const server = new RPCServer();

  // Setup auth (not required in local mode)
  const authProvider = new SimpleTokenProvider();
  server.use(
    createAuthMiddleware({
      provider: authProvider,
      requireAuth: false, // Local mode doesn't require auth
    })
  );

  // Register handlers
  registerHandlers(server, agent, mode);

  // Setup IPC transport
  const handleRPCMessage = async (event: Electron.IpcMainEvent, data: string) => {
    try {
      const response = await server.handleMessage(
        data,
        {
          send: async (responseData: string) => {
            event.sender.send('rpc-response', responseData);
          },
          onMessage: () => {},
        },
        undefined
      );

      if (response) {
        event.sender.send('rpc-response', JSON.stringify(response));
      }
    } catch (error) {
      console.error('RPC error:', error);
    }
  };

  ipcMain.on('rpc', handleRPCMessage);

  console.log('Local mode initialized');

  return {
    server,
    cleanup: () => {
      ipcMain.removeListener('rpc', handleRPCMessage);
    },
  };
}
