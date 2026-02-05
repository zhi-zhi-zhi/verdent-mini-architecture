import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RPCClient, RPCServer, MemoryTransport } from '@verdent-mini/rpc';
import { RPC_METHODS, PERMISSIONS } from '@verdent-mini/core';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '@verdent-mini/backend';

describe('Web Mode Integration', () => {
  let clientTransport: MemoryTransport;
  let serverTransport: MemoryTransport;
  let client: RPCClient;
  let server: RPCServer;
  let agent: MockAgent;
  let authProvider: SimpleTokenProvider;

  beforeEach(() => {
    // Setup web mode simulation
    [clientTransport, serverTransport] = MemoryTransport.createPair();
    client = new RPCClient(clientTransport);
    server = new RPCServer();
    agent = new MockAgent('web');

    // Web mode: auth optional (can be enabled)
    authProvider = new SimpleTokenProvider([
      { token: 'web-token', userId: 'web-user', permissions: [PERMISSIONS.USER] },
      { token: 'saas-admin', userId: 'admin', permissions: [PERMISSIONS.ADMIN] },
    ]);

    // Web mode can work with or without auth
    server.use(
      createAuthMiddleware({
        provider: authProvider,
        requireAuth: false, // For this test, auth is optional
      })
    );

    registerHandlers(server, agent, 'web');
    server.addTransport(serverTransport);
  });

  afterEach(() => {
    client.disconnect();
  });

  it('should report correct mode', async () => {
    const response = await client.call<{ pong: true; mode: string }>(
      RPC_METHODS.SYSTEM_PING
    );

    expect(response.pong).toBe(true);
    expect(response.mode).toBe('web');
  });

  it('should execute prompts (auth optional)', async () => {
    const response = await client.call<{ taskId: string; output: string; status: string }>(
      RPC_METHODS.AGENT_EXECUTE,
      { prompt: 'Hello, web agent!' }
    );

    expect(response.status).toBe('success');
    expect(response.output).toContain('web');
  });

  it('should work with authentication when provided', async () => {
    const response = await client.call<{ taskId: string; status: string }>(
      RPC_METHODS.AGENT_EXECUTE,
      {
        prompt: 'Authenticated request',
        __auth: { type: 'token', value: 'web-token' },
      }
    );

    expect(response.status).toBe('success');
  });

  it('should support multiple concurrent requests', async () => {
    const [executeResult, pingResult, statusResult] = await Promise.all([
      client.call<{ taskId: string }>(RPC_METHODS.AGENT_EXECUTE, { prompt: 'Request 1' }),
      client.call<{ mode: string }>(RPC_METHODS.SYSTEM_PING),
      client.call<{ running: boolean }>(RPC_METHODS.AGENT_GET_STATUS),
    ]);

    expect(executeResult.taskId).toBeDefined();
    expect(pingResult.mode).toBe('web');
    expect(statusResult.running).toBeDefined();
  });
});
