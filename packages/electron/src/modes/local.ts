import { ipcMain } from 'electron';
import type { RunMode } from '@verdent-mini/core';
import { RPCServer } from '@verdent-mini/rpc';
import {
  HybridAgent,
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

  // Get configuration from environment
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const DEFAULT_USE_REAL_LLM = process.env.DEFAULT_USE_REAL_LLM === 'true';

  // Create agent and RPC server - use HybridAgent to support both mock and real LLM
  const agent = new HybridAgent(mode, {
    apiKey: OPENAI_API_KEY,
    defaultUseRealLLM: DEFAULT_USE_REAL_LLM,
  });
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
  console.log(`- Agent: HybridAgent`);
  console.log(`- OpenAI API Key: ${OPENAI_API_KEY ? 'configured' : 'not configured'}`);
  console.log(`- Default use real LLM: ${DEFAULT_USE_REAL_LLM}`);

  return {
    server,
    cleanup: () => {
      ipcMain.removeListener('rpc', handleRPCMessage);
    },
  };
}
