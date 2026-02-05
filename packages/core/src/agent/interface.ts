import type { AgentExecuteParams, AgentExecuteResult, AgentStatus } from '../protocol/types.js';
import type { StreamEvent, StreamExecuteResult } from '../protocol/stream.js';

/**
 * Agent interface that all agent implementations must follow
 */
export interface IAgent {
  /**
   * Execute a prompt and return the result
   */
  execute(params: AgentExecuteParams): Promise<AgentExecuteResult>;

  /**
   * Execute a prompt with streaming response
   * Returns an async generator that yields stream events
   */
  executeStream(
    params: AgentExecuteParams
  ): AsyncGenerator<StreamEvent, StreamExecuteResult, undefined>;

  /**
   * Get current agent status
   */
  getStatus(): Promise<AgentStatus>;

  /**
   * Cancel an ongoing task
   */
  cancel(taskId: string): Promise<void>;
}

/**
 * Mode configuration
 */
export interface ModeConfig {
  /** Whether authentication is required */
  requireAuth: boolean;
  /** Allowed tokens for simple auth (only for dev/testing) */
  allowedTokens?: string[];
  /** Remote server URL (for remote mode) */
  remoteUrl?: string;
  /** Connection timeout in ms */
  connectionTimeout?: number;
}

/**
 * Mode context passed to backends
 */
export interface IModeContext {
  mode: import('../protocol/types.js').RunMode;
  config: ModeConfig;
}
