import { useState, useCallback, useRef } from 'react';
import type { StreamProgress, StreamExecuteResult } from '@verdent-mini/core';
import { RPC_METHODS } from '@verdent-mini/core';
import { RPCClientError } from '@verdent-mini/rpc';
import { getRPCClient } from '../rpc/client.js';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'cancelled';

export interface UseAgentStreamReturn {
  /** Execute with streaming */
  execute: (prompt: string) => Promise<StreamExecuteResult | null>;
  /** Cancel current stream */
  cancel: () => Promise<void>;
  /** Accumulated output chunks */
  chunks: string[];
  /** Combined output string */
  output: string;
  /** Current progress */
  progress: StreamProgress | null;
  /** Stream status */
  status: StreamStatus;
  /** Error message */
  error: string | null;
  /** Current task ID */
  taskId: string | null;
}

/**
 * Hook for streaming agent execution
 */
export function useAgentStream(): UseAgentStreamReturn {
  const [chunks, setChunks] = useState<string[]>([]);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const abortRef = useRef(false);

  const execute = useCallback(async (prompt: string): Promise<StreamExecuteResult | null> => {
    setStatus('connecting');
    setChunks([]);
    setProgress(null);
    setError(null);
    abortRef.current = false;

    const newTaskId = crypto.randomUUID();
    setTaskId(newTaskId);

    try {
      const client = getRPCClient();
      const stream = client.callStream<StreamExecuteResult>(
        RPC_METHODS.AGENT_EXECUTE_STREAM,
        { prompt, taskId: newTaskId }
      );

      setStatus('streaming');

      let result: StreamExecuteResult | undefined;
      
      for await (const event of stream) {
        if (abortRef.current) {
          setStatus('cancelled');
          return null;
        }

        switch (event.type) {
          case 'chunk':
            setChunks((prev) => [...prev, event.data.chunk]);
            break;
          case 'progress':
            setProgress(event.data);
            break;
          case 'error':
            setError(event.data.message);
            setStatus('error');
            return null;
          case 'end':
            if (event.data.reason === 'cancelled') {
              setStatus('cancelled');
              return null;
            }
            break;
        }
      }

      // Get final result from generator
      const finalResult = await stream.next();
      result = finalResult.value as StreamExecuteResult;

      setStatus('done');
      return result || null;
    } catch (err) {
      const message = err instanceof RPCClientError
        ? err.message
        : 'An error occurred during streaming';
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    abortRef.current = true;

    if (!taskId) return;

    try {
      const client = getRPCClient();
      await client.call(RPC_METHODS.AGENT_CANCEL, { taskId });
      setStatus('cancelled');
    } catch (err) {
      console.error('Failed to cancel stream:', err);
    }
  }, [taskId]);

  return {
    execute,
    cancel,
    chunks,
    output: chunks.join(''),
    progress,
    status,
    error,
    taskId,
  };
}
