import type { RunMode } from '@verdent-mini/core';
import {
  RPCClient,
  WebSocketTransport,
  IPCTransport,
  AuthInterceptor,
  type ElectronAPI,
} from '@verdent-mini/rpc';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

let rpcClient: RPCClient | null = null;
let authInterceptor: AuthInterceptor | null = null;

/**
 * Get or create the RPC client
 * Automatically selects transport based on environment
 */
export function getRPCClient(): RPCClient {
  if (rpcClient) {
    return rpcClient;
  }

  authInterceptor = new AuthInterceptor();

  if (window.electronAPI) {
    // Electron environment - use IPC
    const transport = new IPCTransport(window.electronAPI);
    const wrappedTransport = authInterceptor.wrapTransport(transport);
    rpcClient = new RPCClient(wrappedTransport);
  } else {
    // Web environment - use WebSocket
    // Server listens on /ws path
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
    const transport = new WebSocketTransport(wsUrl, {
      onConnect: () => console.log('WebSocket connected'),
      onDisconnect: () => console.log('WebSocket disconnected'),
      onError: (error) => console.error('WebSocket error:', error),
    });
    const wrappedTransport = authInterceptor.wrapTransport(transport);
    rpcClient = new RPCClient(wrappedTransport);
  }

  return rpcClient;
}

/**
 * Get the auth interceptor
 */
export function getAuthInterceptor(): AuthInterceptor | null {
  return authInterceptor;
}

/**
 * Connect the RPC client (for WebSocket)
 */
export async function connectRPC(): Promise<void> {
  const client = getRPCClient();
  await client.connect();
}

/**
 * Disconnect the RPC client
 */
export function disconnectRPC(): void {
  rpcClient?.disconnect();
  rpcClient = null;
  authInterceptor = null;
}

/**
 * Set auth token
 */
export function setAuthToken(token: string, expiresAt?: number): void {
  authInterceptor?.setCredentials({
    type: 'token',
    value: token,
    expiresAt,
  });
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
  authInterceptor?.setCredentials(null);
}

/**
 * Detect current run mode
 */
export function detectRunMode(): RunMode {
  if (window.electronAPI) {
    // Check if we have a remote URL configured
    const isRemote = import.meta.env.VITE_REMOTE_MODE === 'true';
    return isRemote ? 'remote' : 'local';
  }
  return 'web';
}
