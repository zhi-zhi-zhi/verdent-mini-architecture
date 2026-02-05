import type { IAgent, RunMode, PingResponse } from '@verdent-mini/core';
import { RPC_METHODS } from '@verdent-mini/core';
import { RPCServer } from '@verdent-mini/rpc';

/**
 * Register all RPC handlers on the server
 */
export function registerHandlers(
  server: RPCServer,
  agent: IAgent,
  mode: RunMode
): void {
  // System handlers
  server.register(RPC_METHODS.SYSTEM_PING, async (): Promise<PingResponse> => {
    return {
      pong: true,
      timestamp: Date.now(),
      mode,
    };
  });

  server.register(RPC_METHODS.SYSTEM_GET_MODE, async () => {
    return { mode };
  });

  // Agent handlers
  server.register(RPC_METHODS.AGENT_EXECUTE, async (params) => {
    return agent.execute(params as Parameters<IAgent['execute']>[0]);
  });

  server.registerStream(RPC_METHODS.AGENT_EXECUTE_STREAM, async function* (params) {
    const generator = agent.executeStream(
      params as Parameters<IAgent['executeStream']>[0]
    );

    for await (const event of generator) {
      yield event;
    }

    // Get the final result from the generator
    const final = await generator.next();
    return final.value;
  });

  server.register(RPC_METHODS.AGENT_GET_STATUS, async () => {
    return agent.getStatus();
  });

  server.register(RPC_METHODS.AGENT_CANCEL, async (params) => {
    const { taskId } = params as { taskId: string };
    await agent.cancel(taskId);
    return { success: true };
  });

  // Auth handlers
  server.register(RPC_METHODS.AUTH_LOGIN, async () => {
    // Login is handled by auth middleware, this just returns success
    return { success: true, message: 'Logged in' };
  });

  server.register(RPC_METHODS.AUTH_LOGOUT, async () => {
    return { success: true, message: 'Logged out' };
  });

  server.register(RPC_METHODS.AUTH_REFRESH, async () => {
    // Token refresh would be handled by auth provider
    return { success: true };
  });
}
