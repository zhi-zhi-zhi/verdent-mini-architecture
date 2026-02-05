import { useState, useCallback } from 'react';
import type { AgentExecuteResult, AgentStatus } from '@verdent-mini/core';
import { RPC_METHODS } from '@verdent-mini/core';
import { RPCClientError } from '@verdent-mini/rpc';
import { getRPCClient } from '../rpc/client.js';

export interface UseAgentReturn {
  /** Execute a prompt */
  execute: (prompt: string) => Promise<AgentExecuteResult | null>;
  /** Cancel current task */
  cancel: () => Promise<void>;
  /** Get agent status */
  getStatus: () => Promise<AgentStatus | null>;
  /** Current execution result */
  result: AgentExecuteResult | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Current task ID */
  taskId: string | null;
}

/**
 * Hook for non-streaming agent execution
 */
export function useAgent(): UseAgentReturn {
  const [result, setResult] = useState<AgentExecuteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const execute = useCallback(async (prompt: string): Promise<AgentExecuteResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const client = getRPCClient();
      const response = await client.call<AgentExecuteResult>(
        RPC_METHODS.AGENT_EXECUTE,
        { prompt }
      );

      setTaskId(response.taskId);
      setResult(response);
      return response;
    } catch (err) {
      const message = err instanceof RPCClientError
        ? err.message
        : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    if (!taskId) return;

    try {
      const client = getRPCClient();
      await client.call(RPC_METHODS.AGENT_CANCEL, { taskId });
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  }, [taskId]);

  const getStatus = useCallback(async (): Promise<AgentStatus | null> => {
    try {
      const client = getRPCClient();
      return await client.call<AgentStatus>(RPC_METHODS.AGENT_GET_STATUS);
    } catch (err) {
      console.error('Failed to get status:', err);
      return null;
    }
  }, []);

  return {
    execute,
    cancel,
    getStatus,
    result,
    loading,
    error,
    taskId,
  };
}
