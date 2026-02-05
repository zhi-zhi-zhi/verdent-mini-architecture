import { useState, useEffect } from 'react';
import type { RunMode } from '@verdent-mini/core';
import { RPC_METHODS } from '@verdent-mini/core';
import { useAgentStream } from '../hooks/useAgentStream.js';
import { StreamOutput } from './StreamOutput.js';
import { getRPCClient, connectRPC, detectRunMode } from '../rpc/client.js';

export function AgentPanel() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<RunMode | null>(null);
  const [connected, setConnected] = useState(false);

  const {
    execute,
    cancel,
    output,
    progress,
    status,
    error,
  } = useAgentStream();

  // Connect on mount
  useEffect(() => {
    const connect = async () => {
      try {
        const detectedMode = detectRunMode();
        setMode(detectedMode);

        // Only need to explicitly connect for WebSocket (web mode)
        if (detectedMode === 'web' || detectedMode === 'remote') {
          await connectRPC();
        }

        // Ping to verify connection
        const client = getRPCClient();
        const response = await client.call<{ mode: RunMode }>(RPC_METHODS.SYSTEM_PING);
        setMode(response.mode);
        setConnected(true);
      } catch (err) {
        console.error('Failed to connect:', err);
        setConnected(false);
      }
    };

    connect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || status === 'streaming') return;

    await execute(prompt);
  };

  const handleCancel = () => {
    cancel();
  };

  return (
    <div className="agent-panel">
      <header className="panel-header">
        <h1>Verdent Mini Agent</h1>
        <div className="connection-status">
          <span className={`dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? `Connected (${mode})` : 'Disconnected'}</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="prompt-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={3}
          disabled={status === 'streaming'}
        />
        <div className="form-actions">
          <button
            type="submit"
            disabled={!prompt.trim() || status === 'streaming' || !connected}
          >
            {status === 'streaming' ? 'Processing...' : 'Execute'}
          </button>
          {status === 'streaming' && (
            <button type="button" onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
          )}
        </div>
      </form>

      <StreamOutput
        output={output}
        progress={progress}
        status={status}
        error={error}
      />
    </div>
  );
}
