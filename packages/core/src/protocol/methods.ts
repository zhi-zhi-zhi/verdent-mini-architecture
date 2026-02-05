/**
 * RPC Method definitions
 */
export const RPC_METHODS = {
  // Agent operations
  AGENT_EXECUTE: 'agent/execute',
  AGENT_EXECUTE_STREAM: 'agent/executeStream',
  AGENT_GET_STATUS: 'agent/getStatus',
  AGENT_CANCEL: 'agent/cancel',

  // System operations
  SYSTEM_PING: 'system/ping',
  SYSTEM_GET_MODE: 'system/getMode',

  // Auth operations
  AUTH_LOGIN: 'auth/login',
  AUTH_LOGOUT: 'auth/logout',
  AUTH_REFRESH: 'auth/refresh',
} as const;

export type RPCMethod = (typeof RPC_METHODS)[keyof typeof RPC_METHODS];

/**
 * Stream notification methods (Server -> Client, no response needed)
 */
export const STREAM_METHODS = {
  STREAM_CHUNK: 'agent/streamChunk',
  STREAM_PROGRESS: 'agent/streamProgress',
  STREAM_END: 'agent/streamEnd',
} as const;

export type StreamMethod = (typeof STREAM_METHODS)[keyof typeof STREAM_METHODS];
