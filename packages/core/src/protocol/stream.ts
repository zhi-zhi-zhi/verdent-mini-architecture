import type { RPCError } from './errors.js';

/**
 * Stream chunk data
 */
export interface StreamChunk {
  taskId: string;
  index: number;
  chunk: string;
  timestamp: number;
}

/**
 * Stream progress data
 */
export interface StreamProgress {
  taskId: string;
  phase: 'thinking' | 'executing' | 'finalizing';
  progress?: number; // 0-100
  message?: string;
}

/**
 * Stream end data
 */
export interface StreamEnd {
  taskId: string;
  reason: 'complete' | 'cancelled' | 'error';
}

/**
 * Stream event union type
 */
export type StreamEvent =
  | { type: 'chunk'; data: StreamChunk }
  | { type: 'progress'; data: StreamProgress }
  | { type: 'error'; data: RPCError }
  | { type: 'end'; data: StreamEnd };

/**
 * Stream execute result (final response after all chunks)
 */
export interface StreamExecuteResult {
  taskId: string;
  totalChunks: number;
  finalOutput: string;
  status: 'success' | 'error';
  error?: RPCError;
}
