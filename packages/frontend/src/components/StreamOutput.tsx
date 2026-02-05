import type { StreamStatus } from '../hooks/useAgentStream.js';

interface StreamOutputProps {
  output: string;
  status: StreamStatus;
  error: string | null;
}

export function StreamOutput({ output, status, error }: StreamOutputProps) {
  return (
    <div className="stream-output">
      {/* Status indicator */}
      <div className={`status-badge status-${status}`}>
        {status === 'idle' && '● Ready'}
        {status === 'connecting' && '◐ Connecting...'}
        {status === 'streaming' && '◉ Streaming...'}
        {status === 'done' && '✓ Complete'}
        {status === 'error' && '✗ Error'}
        {status === 'cancelled' && '○ Cancelled'}
      </div>

      {/* Output display */}
      <div className="output-content">
        {output}
        {status === 'streaming' && <span className="cursor" />}
      </div>

      {/* Error message - always rendered to prevent layout shift */}
      <div className={`error-message ${error ? 'visible' : ''}`}>
        {error || ''}
      </div>
    </div>
  );
}
