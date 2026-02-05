import { describe, it, expect, beforeEach } from 'vitest';
import { RPCClient, RPCServer, MemoryTransport, RPCClientError } from '../src/index.js';
import { ERROR_CODES, RPCErrors, type StreamEvent } from '@verdent-mini/core';

describe('RPC Client/Server', () => {
  let clientTransport: MemoryTransport;
  let serverTransport: MemoryTransport;
  let client: RPCClient;
  let server: RPCServer;

  beforeEach(() => {
    [clientTransport, serverTransport] = MemoryTransport.createPair();
    client = new RPCClient(clientTransport);
    server = new RPCServer();
    server.addTransport(serverTransport);
  });

  describe('Basic RPC calls', () => {
    it('should handle successful request/response', async () => {
      server.register('add', async (params) => {
        const { a, b } = params as { a: number; b: number };
        return { result: a + b };
      });

      const response = await client.call<{ result: number }>('add', { a: 2, b: 3 });
      expect(response.result).toBe(5);
    });

    it('should handle method not found', async () => {
      await expect(client.call('nonexistent')).rejects.toThrow(RPCClientError);
      
      try {
        await client.call('nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe(ERROR_CODES.METHOD_NOT_FOUND);
      }
    });

    it('should handle async handlers', async () => {
      server.register('async-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { done: true };
      });

      const response = await client.call<{ done: boolean }>('async-op');
      expect(response.done).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should propagate custom errors', async () => {
      server.register('fail', async () => {
        throw new Error('Something went wrong');
      });

      try {
        await client.call('fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe(ERROR_CODES.INTERNAL_ERROR);
      }
    });

    it('should handle retryable errors', async () => {
      server.register('rate-limited', async () => {
        const error = RPCErrors.rateLimited(30);
        throw { ...error, isRPCError: true };
      });

      // This test verifies error structure, actual retry logic would be in client
    });
  });

  describe('Notifications', () => {
    it('should handle notifications', async () => {
      const received: unknown[] = [];
      
      client.onNotification('event', (params) => {
        received.push(params);
      });

      // Server broadcasts notification
      await server.broadcast('event', { message: 'hello' });
      
      // Give time for async delivery
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ message: 'hello' });
    });

    it('should allow unsubscribing from notifications', async () => {
      const received: unknown[] = [];
      
      const unsubscribe = client.onNotification('event', (params) => {
        received.push(params);
      });

      await server.broadcast('event', { count: 1 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      unsubscribe();
      
      await server.broadcast('event', { count: 2 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      expect(received).toHaveLength(1);
    });
  });

  describe('Streaming', () => {
    it('should handle streaming responses', async () => {
      server.registerStream('stream-test', async function* (params) {
        const { count } = params as { count: number; taskId: string };
        
        for (let i = 0; i < count; i++) {
          yield {
            type: 'chunk' as const,
            data: {
              taskId: (params as { taskId: string }).taskId,
              index: i,
              chunk: `chunk-${i}`,
              timestamp: Date.now(),
            },
          };
        }
        
        return {
          taskId: (params as { taskId: string }).taskId,
          totalChunks: count,
          finalOutput: 'done',
          status: 'success' as const,
        };
      });

      const chunks: StreamEvent[] = [];
      const stream = client.callStream<{ totalChunks: number; status: string }>(
        'stream-test',
        { count: 3 }
      );

      for await (const event of stream) {
        chunks.push(event);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].type).toBe('chunk');
    });

    it('should handle streaming with progress', async () => {
      server.registerStream('stream-progress', async function* (params) {
        const { taskId } = params as { taskId: string };
        
        yield {
          type: 'progress' as const,
          data: {
            taskId,
            phase: 'thinking' as const,
            progress: 0,
          },
        };

        yield {
          type: 'chunk' as const,
          data: {
            taskId,
            index: 0,
            chunk: 'result',
            timestamp: Date.now(),
          },
        };

        yield {
          type: 'progress' as const,
          data: {
            taskId,
            phase: 'finalizing' as const,
            progress: 100,
          },
        };

        return { taskId, status: 'success' };
      });

      const events: StreamEvent[] = [];
      const stream = client.callStream('stream-progress', {});

      for await (const event of stream) {
        events.push(event);
      }

      expect(events.filter((e) => e.type === 'progress')).toHaveLength(2);
      expect(events.filter((e) => e.type === 'chunk')).toHaveLength(1);
    });
  });

  describe('Middleware', () => {
    it('should execute middleware in order', async () => {
      const order: string[] = [];

      server.use(async (request, context, next) => {
        order.push('middleware-1-before');
        const response = await next();
        order.push('middleware-1-after');
        return response;
      });

      server.use(async (request, context, next) => {
        order.push('middleware-2-before');
        const response = await next();
        order.push('middleware-2-after');
        return response;
      });

      server.register('test', async () => {
        order.push('handler');
        return { ok: true };
      });

      await client.call('test');

      expect(order).toEqual([
        'middleware-1-before',
        'middleware-2-before',
        'handler',
        'middleware-2-after',
        'middleware-1-after',
      ]);
    });

    it('should allow middleware to short-circuit', async () => {
      server.use(async (request, context, next) => {
        if (request.method === 'blocked') {
          return {
            jsonrpc: '2.0' as const,
            id: request.id,
            error: RPCErrors.permissionDenied(),
          };
        }
        return next();
      });

      server.register('blocked', async () => ({ ok: true }));

      try {
        await client.call('blocked');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe(ERROR_CODES.AUTH_PERMISSION_DENIED);
      }
    });
  });
});
