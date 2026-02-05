import type { RPCError, ErrorCode } from '@verdent-mini/core';
import { isAuthError, isAgentError, isConnectionError } from '@verdent-mini/core';

/**
 * RPC Client Error
 * Thrown when an RPC call returns an error
 */
export class RPCClientError extends Error {
  constructor(public readonly error: RPCError) {
    super(error.message);
    this.name = 'RPCClientError';
  }

  get code(): ErrorCode {
    return this.error.code;
  }

  get isRetryable(): boolean {
    return this.error.data?.retryable ?? false;
  }

  get retryAfter(): number | undefined {
    return this.error.data?.retryAfter;
  }

  get details(): string | undefined {
    return this.error.data?.details;
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return isAuthError(this.code);
  }

  /**
   * Check if this is an agent error
   */
  isAgentError(): boolean {
    return isAgentError(this.code);
  }

  /**
   * Check if this is a connection error
   */
  isConnectionError(): boolean {
    return isConnectionError(this.code);
  }
}

/**
 * RPC Exception (thrown on server side, converted to RPCError)
 */
export class RPCException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly data?: RPCError['data']
  ) {
    super(message);
    this.name = 'RPCException';
  }

  toRPCError(): RPCError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}
