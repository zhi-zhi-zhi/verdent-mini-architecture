import type { StreamProgress } from '@verdent-mini/core';
import type { StreamStatus } from '../hooks/useAgentStream.js';

interface StreamOutputProps {
  output: string;
  progress: StreamProgress | null;
  status: StreamStatus;
  error: string | null;
}

export function StreamOutput({ output, progress, status, error }: StreamOutputProps) {
  return (
    <div className="stream-output">
      {/* Progress indicator */}
      {progress && status === 'streaming' && (
        <div className="progress-bar">
          <div className="progress-info">
            <span className="phase">{progress.phase}</span>
            {progress.message && <span className="message">{progress.message}</span>}
          </div>
          {progress.progress !== undefined && (
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Status indicator */}
      <div className={`status-badge status-${status}`}>
        {status === 'idle' && '● Ready'}
        {status === 'connecting' && '◐ Connecting...'}
        {status === 'streaming' && '◉ Streaming...'}
        {status === 'done' && '✓ Complete'}
        {status === 'error' && '✗ Error'}
        {status === 'cancelled' && '○ Cancelled'}
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Output display */}
      <div className="output-content">
        {output}
        {status === 'streaming' && <span className="cursor" />}
      </div>
    </div>
  );
}
