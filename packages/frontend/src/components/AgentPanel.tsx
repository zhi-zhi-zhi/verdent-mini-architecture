import { useState, useEffect, useRef } from 'react';
import type { RunMode } from '@verdent-mini/core';
import { RPC_METHODS } from '@verdent-mini/core';
import { useAgentStream } from '../hooks/useAgentStream.js';
import { StreamOutput } from './StreamOutput.js';
import { getRPCClient, connectRPC, detectRunMode } from '../rpc/client.js';

// Local storage keys
const STORAGE_KEY_USE_REAL_LLM = 'verdent_use_real_llm';
const STORAGE_KEY_API_KEY = 'verdent_api_key';

export function AgentPanel() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<RunMode | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Real LLM mode state
  const [useRealLLM, setUseRealLLM] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USE_REAL_LLM);
    return saved === 'true';
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const {
    execute,
    cancel,
    output,
    progress,
    status,
    error,
  } = useAgentStream();
  
  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USE_REAL_LLM, String(useRealLLM));
  }, [useRealLLM]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
  }, [apiKey]);

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

    await execute(prompt, {
      useRealLLM,
      apiKey: useRealLLM && apiKey ? apiKey : undefined,
    });
  };

  const handleCancel = () => {
    cancel();
  };

  // Progress bar reset logic
  const progressFillRef = useRef<HTMLDivElement>(null);
  const prevProgressRef = useRef<number | null>(null);
  
  useEffect(() => {
    const currentProgress = progress?.progress ?? null;
    const prevProgress = prevProgressRef.current;
    
    if (progressFillRef.current) {
      if (currentProgress === null || (prevProgress !== null && currentProgress < prevProgress)) {
        progressFillRef.current.style.transition = 'none';
        progressFillRef.current.offsetHeight;
        requestAnimationFrame(() => {
          if (progressFillRef.current) {
            progressFillRef.current.style.transition = '';
          }
        });
      }
    }
    
    prevProgressRef.current = currentProgress;
  }, [progress?.progress]);

  const showProgress = progress && status === 'streaming';

  return (
    <div className="agent-panel">
      <header className="panel-header">
        <h1>Verdent Mini Agent</h1>
        <div className="connection-status">
          <span className={`dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? `Connected (${mode})` : 'Disconnected'}</span>
        </div>
      </header>
      
      {/* LLM Mode Settings */}
      <div className="llm-settings">
        <div className="llm-switch-row">
          <div className="switch-group">
            <label className="switch-label">
              <span className="switch-text">Use Real LLM (OpenAI)</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={useRealLLM}
                  onChange={(e) => setUseRealLLM(e.target.checked)}
                  disabled={status === 'streaming'}
                />
                <span className="slider" />
              </label>
            </label>
            {/* Always render mock-badge but use visibility to prevent layout shift */}
            <span className={`mock-badge ${useRealLLM ? 'hidden' : ''}`}>Mock Mode</span>
          </div>
          
          <button
            type="button"
            className={`api-key-toggle ${useRealLLM ? '' : 'invisible'}`}
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            disabled={!useRealLLM}
          >
            {apiKey ? '🔑 Key Set' : '⚙️ Set API Key'}
          </button>
        </div>
        
        {/* Always render API key input container to reserve space, control visibility with CSS */}
        <div className={`api-key-input ${useRealLLM && showApiKeyInput ? 'visible' : ''}`}>
          <input
            type="password"
            placeholder="Enter your OpenAI API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={status === 'streaming'}
            tabIndex={useRealLLM && showApiKeyInput ? 0 : -1}
          />
          <small className="api-key-hint">
            Optional: Uses server's key if not provided
          </small>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="prompt-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={3}
          disabled={status === 'streaming'}
        />
        <div className="form-actions">
          {/* Progress bar on the left */}
          <div className={`progress-inline ${showProgress ? 'visible' : ''}`}>
            <div className="progress-track">
              <div
                ref={progressFillRef}
                className="progress-fill"
                style={{ width: `${progress?.progress ?? 0}%` }}
              />
            </div>
            <span className="progress-text">
              {progress?.phase || ''}
              {progress?.message ? ` · ${progress.message}` : ''}
            </span>
          </div>
          
          <div className="form-buttons">
            <button 
              type="button" 
              onClick={handleCancel} 
              className={`cancel-btn ${status === 'streaming' ? '' : 'invisible'}`}
              disabled={status !== 'streaming'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || status === 'streaming' || !connected}
            >
              {status === 'streaming' ? 'Processing...' : 'Execute'}
            </button>
          </div>
        </div>
      </form>

      <StreamOutput
        output={output}
        status={status}
        error={error}
      />
    </div>
  );
}
