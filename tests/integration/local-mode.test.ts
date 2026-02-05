import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RPCClient, RPCServer, MemoryTransport } from '@verdent-mini/rpc';
import { RPC_METHODS, STREAM_METHODS } from '@verdent-mini/core';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '@verdent-mini/backend';

describe('Local Mode Integration', () => {
  let clientTransport: MemoryTransport;
  let serverTransport: MemoryTransport;
  let client: RPCClient;
  let server: RPCServer;
  let agent: MockAgent;

  beforeEach(() => {
    // Setup local mode simulation using memory transports
    [clientTransport, serverTransport] = MemoryTransport.createPair();
    client = new RPCClient(clientTransport);
    server = new RPCServer();
    agent = new MockAgent('local');

    // Local mode: no auth required
    const authProvider = new SimpleTokenProvider();
    server.use(
      createAuthMiddleware({
        provider: authProvider,
        requireAuth: false,
      })
    );

    registerHandlers(server, agent, 'local');
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
    expect(response.mode).toBe('local');
  });

  it('should execute prompts without authentication', async () => {
    const response = await client.call<{ taskId: string; output: string; status: string }>(
      RPC_METHODS.AGENT_EXECUTE,
      { prompt: 'Hello, local agent!' }
    );

    expect(response.status).toBe('success');
    expect(response.output).toContain('local');
    expect(response.taskId).toBeDefined();
  });

  it('should support streaming execution', async () => {
    const chunks: string[] = [];
    const stream = client.callStream<{ status: string; totalChunks: number }>(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      { prompt: 'Stream test' }
    );

    for await (const event of stream) {
      if (event.type === 'chunk') {
        chunks.push(event.data.chunk);
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should get agent status', async () => {
    const status = await client.call<{ running: boolean; mode: string }>(
      RPC_METHODS.AGENT_GET_STATUS
    );

    expect(status.running).toBe(false);
    expect(status.mode).toBe('local');
  });
});
