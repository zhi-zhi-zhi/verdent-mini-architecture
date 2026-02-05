/**
 * JSON-RPC 2.0 Error Codes
 * Standard: -32700 to -32600
 * Custom: -32000 to -32099 (reserved for implementation-defined server errors)
 */
export const ERROR_CODES = {
  // JSON-RPC Standard Errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Authentication Errors (-32000 ~ -32009)
  AUTH_REQUIRED: -32000,
  AUTH_INVALID_TOKEN: -32001,
  AUTH_TOKEN_EXPIRED: -32002,
  AUTH_PERMISSION_DENIED: -32003,

  // Agent Errors (-32010 ~ -32029)
  AGENT_BUSY: -32010,
  AGENT_TIMEOUT: -32011,
  AGENT_CANCELLED: -32012,
  AGENT_EXECUTION_FAILED: -32013,
  AGENT_INVALID_CONTEXT: -32014,
  AGENT_RATE_LIMITED: -32015,

  // Connection Errors (-32030 ~ -32039)
  CONNECTION_FAILED: -32030,
  CONNECTION_LOST: -32031,
  CONNECTION_TIMEOUT: -32032,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * RPC Error structure
 */
export interface RPCError {
  code: ErrorCode;
  message: string;
  data?: {
    details?: string;
    retryable?: boolean;
    retryAfter?: number; // seconds
    context?: Record<string, unknown>;
  };
}

/**
 * Create an RPC error
 */
export function createRPCError(
  code: ErrorCode,
  message: string,
  data?: RPCError['data']
): RPCError {
  return { code, message, data };
}

/**
 * Pre-defined error factories
 */
export const RPCErrors = {
  parseError: (details?: string) =>
    createRPCError(ERROR_CODES.PARSE_ERROR, 'Parse error', { details }),

  invalidRequest: (details?: string) =>
    createRPCError(ERROR_CODES.INVALID_REQUEST, 'Invalid request', { details }),

  methodNotFound: (method: string) =>
    createRPCError(ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`),

  invalidParams: (details?: string) =>
    createRPCError(ERROR_CODES.INVALID_PARAMS, 'Invalid params', { details }),

  internalError: (details?: string) =>
    createRPCError(ERROR_CODES.INTERNAL_ERROR, 'Internal error', { details }),

  authRequired: () =>
    createRPCError(ERROR_CODES.AUTH_REQUIRED, 'Authentication required', {
      retryable: true,
    }),

  invalidToken: () =>
    createRPCError(ERROR_CODES.AUTH_INVALID_TOKEN, 'Invalid token'),

  tokenExpired: () =>
    createRPCError(ERROR_CODES.AUTH_TOKEN_EXPIRED, 'Token has expired', {
      retryable: true,
    }),

  permissionDenied: (permission?: string) =>
    createRPCError(
      ERROR_CODES.AUTH_PERMISSION_DENIED,
      permission ? `Permission denied: ${permission}` : 'Permission denied'
    ),

  agentBusy: (currentTaskId?: string) =>
    createRPCError(ERROR_CODES.AGENT_BUSY, 'Agent is currently busy', {
      retryable: true,
      retryAfter: 5,
      context: currentTaskId ? { currentTaskId } : undefined,
    }),

  agentTimeout: (timeoutMs: number) =>
    createRPCError(
      ERROR_CODES.AGENT_TIMEOUT,
      `Agent execution timed out after ${timeoutMs}ms`,
      { retryable: true }
    ),

  agentCancelled: (taskId: string) =>
    createRPCError(ERROR_CODES.AGENT_CANCELLED, `Task ${taskId} was cancelled`),

  agentExecutionFailed: (details?: string) =>
    createRPCError(ERROR_CODES.AGENT_EXECUTION_FAILED, 'Agent execution failed', {
      details,
    }),

  rateLimited: (retryAfter: number) =>
    createRPCError(ERROR_CODES.AGENT_RATE_LIMITED, 'Rate limit exceeded', {
      retryable: true,
      retryAfter,
    }),

  connectionFailed: (details?: string) =>
    createRPCError(ERROR_CODES.CONNECTION_FAILED, 'Connection failed', {
      details,
      retryable: true,
    }),

  connectionLost: () =>
    createRPCError(ERROR_CODES.CONNECTION_LOST, 'Connection lost', {
      retryable: true,
    }),
};

/**
 * Check if an error code is in a specific category
 */
export function isAuthError(code: number): boolean {
  return code >= -32009 && code <= -32000;
}

export function isAgentError(code: number): boolean {
  return code >= -32029 && code <= -32010;
}

export function isConnectionError(code: number): boolean {
  return code >= -32039 && code <= -32030;
}
