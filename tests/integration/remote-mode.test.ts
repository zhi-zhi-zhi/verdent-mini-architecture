import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RPCClient, RPCServer, MemoryTransport, RPCClientError } from '@verdent-mini/rpc';
import { RPC_METHODS, PERMISSIONS, ERROR_CODES } from '@verdent-mini/core';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '@verdent-mini/backend';

describe('Remote Mode Integration', () => {
  let clientTransport: MemoryTransport;
  let serverTransport: MemoryTransport;
  let client: RPCClient;
  let server: RPCServer;
  let agent: MockAgent;
  let authProvider: SimpleTokenProvider;

  beforeEach(() => {
    // Setup remote mode simulation using memory transports
    [clientTransport, serverTransport] = MemoryTransport.createPair();
    client = new RPCClient(clientTransport);
    server = new RPCServer();
    agent = new MockAgent('remote');

    // Remote mode: auth required
    authProvider = new SimpleTokenProvider([
      { token: 'remote-token', userId: 'remote-user', permissions: [PERMISSIONS.USER] },
    ]);

    server.use(
      createAuthMiddleware({
        provider: authProvider,
        requireAuth: true,
      })
    );

    registerHandlers(server, agent, 'remote');
    server.addTransport(serverTransport);
  });

  afterEach(() => {
    client.disconnect();
  });

  it('should report correct mode', async () => {
    // Ping is public, no auth needed
    const response = await client.call<{ pong: true; mode: string }>(
      RPC_METHODS.SYSTEM_PING
    );

    expect(response.pong).toBe(true);
    expect(response.mode).toBe('remote');
  });

  it('should require authentication for protected endpoints', async () => {
    try {
      await client.call(RPC_METHODS.AGENT_EXECUTE, { prompt: 'test' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RPCClientError);
      expect((error as RPCClientError).code).toBe(ERROR_CODES.AUTH_REQUIRED);
    }
  });

  it('should execute prompts with valid token', async () => {
    const response = await client.call<{ taskId: string; output: string; status: string }>(
      RPC_METHODS.AGENT_EXECUTE,
      {
        prompt: 'Hello, remote agent!',
        __auth: { type: 'token', value: 'remote-token' },
      }
    );

    expect(response.status).toBe('success');
    expect(response.output).toContain('remote');
  });

  it('should support streaming with authentication', async () => {
    const chunks: string[] = [];
    const stream = client.callStream<{ status: string }>(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      {
        prompt: 'Stream test',
        __auth: { type: 'token', value: 'remote-token' },
      }
    );

    for await (const event of stream) {
      if (event.type === 'chunk') {
        chunks.push(event.data.chunk);
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
  });
});
