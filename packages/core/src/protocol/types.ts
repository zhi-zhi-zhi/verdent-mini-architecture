/**
 * Run mode types
 */
export type RunMode = 'local' | 'remote' | 'web' | 'saas';

/**
 * Agent execution parameters
 */
export interface AgentExecuteParams {
  prompt: string;
  taskId?: string;
  context?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentExecuteResult {
  taskId: string;
  output: string;
  status: 'success' | 'error';
  error?: import('./errors.js').RPCError;
}

/**
 * Agent status
 */
export interface AgentStatus {
  running: boolean;
  currentTaskId?: string;
  mode: RunMode;
}

/**
 * System ping response
 */
export interface PingResponse {
  pong: true;
  timestamp: number;
  mode: RunMode;
}

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: import('./errors.js').RPCError;
}

/**
 * JSON-RPC 2.0 Notification (no id, no response expected)
 */
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}
