import { describe, it, expect, beforeEach } from 'vitest';
import { RPCClient, RPCServer, MemoryTransport, RPCClientError } from '@verdent-mini/rpc';
import { ERROR_CODES, RPC_METHODS, PERMISSIONS } from '@verdent-mini/core';
import {
  MockAgent,
  SimpleTokenProvider,
  createAuthMiddleware,
  registerHandlers,
} from '../src/index.js';

describe('Authentication', () => {
  let clientTransport: MemoryTransport;
  let serverTransport: MemoryTransport;
  let client: RPCClient;
  let server: RPCServer;
  let agent: MockAgent;
  let authProvider: SimpleTokenProvider;

  beforeEach(() => {
    [clientTransport, serverTransport] = MemoryTransport.createPair();
    client = new RPCClient(clientTransport);
    server = new RPCServer();
    agent = new MockAgent('local');
    authProvider = new SimpleTokenProvider([
      { token: 'valid-user-token', userId: 'user-1', permissions: [PERMISSIONS.USER] },
      { token: 'valid-admin-token', userId: 'admin-1', permissions: [PERMISSIONS.ADMIN] },
    ]);
  });

  describe('With auth required', () => {
    beforeEach(() => {
      server.use(
        createAuthMiddleware({
          provider: authProvider,
          requireAuth: true,
        })
      );
      registerHandlers(server, agent, 'local');
      server.addTransport(serverTransport);
    });

    it('should reject unauthenticated requests to protected endpoints', async () => {
      try {
        await client.call(RPC_METHODS.AGENT_EXECUTE, { prompt: 'test' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe(ERROR_CODES.AUTH_REQUIRED);
      }
    });

    it('should allow public endpoints without auth', async () => {
      const response = await client.call<{ pong: boolean }>(RPC_METHODS.SYSTEM_PING);
      expect(response.pong).toBe(true);
    });

    it('should accept valid token in request', async () => {
      const response = await client.call<{ taskId: string; status: string }>(
        RPC_METHODS.AGENT_EXECUTE,
        {
          prompt: 'test',
          __auth: { type: 'token', value: 'valid-user-token' },
        }
      );
      expect(response.status).toBe('success');
    });

    it('should reject invalid token', async () => {
      try {
        await client.call(RPC_METHODS.AGENT_EXECUTE, {
          prompt: 'test',
          __auth: { type: 'token', value: 'invalid-token' },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe(ERROR_CODES.AUTH_REQUIRED);
      }
    });

    it('should enforce permission levels', async () => {
      // User trying to access admin endpoint
      try {
        await client.call(RPC_METHODS.SYSTEM_GET_MODE, {
          __auth: { type: 'token', value: 'valid-user-token' },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe(ERROR_CODES.AUTH_PERMISSION_DENIED);
      }

      // Admin can access admin endpoint
      const response = await client.call<{ mode: string }>(RPC_METHODS.SYSTEM_GET_MODE, {
        __auth: { type: 'token', value: 'valid-admin-token' },
      });
      expect(response.mode).toBe('local');
    });
  });

  describe('Without auth required (local mode)', () => {
    beforeEach(() => {
      server.use(
        createAuthMiddleware({
          provider: authProvider,
          requireAuth: false,
        })
      );
      registerHandlers(server, agent, 'local');
      server.addTransport(serverTransport);
    });

    it('should allow all requests without auth', async () => {
      const response = await client.call<{ taskId: string; status: string }>(
        RPC_METHODS.AGENT_EXECUTE,
        { prompt: 'test' }
      );
      expect(response.status).toBe('success');
    });

    it('should still work with auth provided', async () => {
      const response = await client.call<{ taskId: string; status: string }>(
        RPC_METHODS.AGENT_EXECUTE,
        {
          prompt: 'test',
          __auth: { type: 'token', value: 'valid-user-token' },
        }
      );
      expect(response.status).toBe('success');
    });
  });
});

describe('SimpleTokenProvider', () => {
  it('should validate correct tokens', async () => {
    const provider = new SimpleTokenProvider([
      { token: 'test-token', userId: 'user-1', permissions: [PERMISSIONS.USER] },
    ]);

    const result = await provider.validate({ type: 'token', value: 'test-token' });
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-1');
    expect(result?.permissions).toContain(PERMISSIONS.USER);
  });

  it('should reject invalid tokens', async () => {
    const provider = new SimpleTokenProvider([
      { token: 'test-token', userId: 'user-1' },
    ]);

    const result = await provider.validate({ type: 'token', value: 'wrong-token' });
    expect(result).toBeNull();
  });

  it('should reject non-token auth types', async () => {
    const provider = new SimpleTokenProvider([
      { token: 'test-token', userId: 'user-1' },
    ]);

    const result = await provider.validate({ type: 'apiKey', value: 'test-token' });
    expect(result).toBeNull();
  });

  it('should allow adding and removing tokens', async () => {
    const provider = new SimpleTokenProvider();

    provider.addToken('new-token', 'new-user', [PERMISSIONS.ADMIN]);
    expect(provider.isValidToken('new-token')).toBe(true);

    provider.removeToken('new-token');
    expect(provider.isValidToken('new-token')).toBe(false);
  });

  it('should provide default dev tokens when none specified', async () => {
    const provider = new SimpleTokenProvider();

    expect(provider.isValidToken('dev-token')).toBe(true);
    expect(provider.isValidToken('admin-token')).toBe(true);
  });
});
