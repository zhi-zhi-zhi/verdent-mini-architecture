import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RPCClient, RPCServer, MemoryTransport } from '@verdent-mini/rpc';
import { RPC_METHODS, type StreamEvent, type StreamProgress } from '@verdent-mini/core';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '@verdent-mini/backend';

describe('Streaming Integration', () => {
  let clientTransport: MemoryTransport;
  let serverTransport: MemoryTransport;
  let client: RPCClient;
  let server: RPCServer;
  let agent: MockAgent;

  beforeEach(() => {
    [clientTransport, serverTransport] = MemoryTransport.createPair();
    client = new RPCClient(clientTransport);
    server = new RPCServer();
    agent = new MockAgent('local');

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

  it('should receive chunks in correct order', async () => {
    const chunks: { index: number; chunk: string }[] = [];
    const stream = client.callStream<{ totalChunks: number }>(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      { prompt: 'Order test' }
    );

    for await (const event of stream) {
      if (event.type === 'chunk') {
        chunks.push({ index: event.data.index, chunk: event.data.chunk });
      }
    }

    // Verify chunks are received in order
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].index).toBeGreaterThan(chunks[i - 1].index);
    }
  });

  it('should receive progress updates', async () => {
    const progressUpdates: StreamProgress[] = [];
    const stream = client.callStream(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      { prompt: 'Progress test' }
    );

    for await (const event of stream) {
      if (event.type === 'progress') {
        progressUpdates.push(event.data);
      }
    }

    // Should have at least thinking and finalizing phases
    expect(progressUpdates.length).toBeGreaterThanOrEqual(2);
    
    // First progress should be 'thinking'
    expect(progressUpdates[0].phase).toBe('thinking');
    
    // Last progress should be 'finalizing' at 100%
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    expect(lastProgress.phase).toBe('finalizing');
    expect(lastProgress.progress).toBe(100);
  });

  it('should complete streaming successfully', async () => {
    const events: StreamEvent[] = [];
    const stream = client.callStream<{ status: string }>(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      { prompt: 'End test' }
    );

    for await (const event of stream) {
      events.push(event);
    }

    // Should have received multiple events
    expect(events.length).toBeGreaterThan(0);
    
    // Should have chunk and progress events
    const hasChunks = events.some(e => e.type === 'chunk');
    const hasProgress = events.some(e => e.type === 'progress');
    expect(hasChunks).toBe(true);
    expect(hasProgress).toBe(true);
  });

  it('should accumulate chunks to form complete output', async () => {
    const chunks: string[] = [];
    const stream = client.callStream<{ finalOutput: string }>(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      { prompt: 'Accumulate test' }
    );

    for await (const event of stream) {
      if (event.type === 'chunk') {
        chunks.push(event.data.chunk);
      }
    }

    const accumulated = chunks.join('');
    // Verify chunks were accumulated
    expect(accumulated.length).toBeGreaterThan(0);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should include timestamps in chunks', async () => {
    const stream = client.callStream(
      RPC_METHODS.AGENT_EXECUTE_STREAM,
      { prompt: 'Timestamp test' }
    );

    const startTime = Date.now();
    
    for await (const event of stream) {
      if (event.type === 'chunk') {
        expect(event.data.timestamp).toBeDefined();
        expect(event.data.timestamp).toBeGreaterThanOrEqual(startTime);
      }
    }
  });
});
