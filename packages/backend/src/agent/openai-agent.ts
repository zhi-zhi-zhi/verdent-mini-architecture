import type {
  IAgent,
  AgentExecuteParams,
  AgentExecuteResult,
  AgentStatus,
  StreamEvent,
  StreamExecuteResult,
  RunMode,
} from '@verdent-mini/core';
import { RPCErrors } from '@verdent-mini/core';
import { RPCException } from '@verdent-mini/rpc';

/**
 * OpenAI Agent configuration
 */
export interface OpenAIAgentConfig {
  /** OpenAI API Key (can be overridden per-request) */
  apiKey?: string;
  /** Base URL for OpenAI API (optional, for proxy support) */
  baseUrl?: string;
  /** Model to use */
  model?: string;
  /** Max tokens */
  maxTokens?: number;
}

/**
 * Extended execute params with OpenAI-specific options
 */
export interface OpenAIExecuteParams extends AgentExecuteParams {
  /** Custom API key for this request */
  apiKey?: string;
  /** Model override */
  model?: string;
}

/**
 * OpenAI Agent implementation for real LLM interactions
 */
export class OpenAIAgent implements IAgent {
  private currentTaskId: string | null = null;
  private cancelled = new Set<string>();
  private mode: RunMode;
  private config: OpenAIAgentConfig;

  constructor(mode: RunMode = 'local', config: OpenAIAgentConfig = {}) {
    this.mode = mode;
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
      maxTokens: config.maxTokens || 2048,
    };
  }

  /**
   * Get the API key to use (request-level override or default)
   */
  private getApiKey(params: OpenAIExecuteParams): string {
    const apiKey = params.apiKey || this.config.apiKey;
    if (!apiKey) {
      throw new RPCException(
        -32001,
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in request.'
      );
    }
    return apiKey;
  }

  /**
   * Execute a prompt and return result
   */
  async execute(params: AgentExecuteParams): Promise<AgentExecuteResult> {
    const taskId = params.taskId || crypto.randomUUID();
    const openAIParams = params as OpenAIExecuteParams;

    if (this.currentTaskId) {
      throw new RPCException(
        RPCErrors.agentBusy(this.currentTaskId).code,
        RPCErrors.agentBusy(this.currentTaskId).message,
        RPCErrors.agentBusy(this.currentTaskId).data
      );
    }

    this.currentTaskId = taskId;

    try {
      const apiKey = this.getApiKey(openAIParams);

      if (this.cancelled.has(taskId)) {
        this.cancelled.delete(taskId);
        throw new RPCException(
          RPCErrors.agentCancelled(taskId).code,
          RPCErrors.agentCancelled(taskId).message
        );
      }

      // Call OpenAI API
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: openAIParams.model || this.config.model,
          messages: [
            {
              role: 'user',
              content: params.prompt,
            },
          ],
          max_tokens: this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new RPCException(
          -32002,
          `OpenAI API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const output = data.choices?.[0]?.message?.content || '';

      return {
        taskId,
        output,
        status: 'success',
      };
    } catch (error) {
      if (error instanceof RPCException) {
        throw error;
      }
      throw new RPCException(
        -32003,
        `Failed to call OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.currentTaskId = null;
    }
  }

  /**
   * Execute with streaming response
   */
  async *executeStream(
    params: AgentExecuteParams
  ): AsyncGenerator<StreamEvent, StreamExecuteResult, undefined> {
    const taskId = params.taskId || crypto.randomUUID();
    const openAIParams = params as OpenAIExecuteParams;

    if (this.currentTaskId) {
      throw new RPCException(
        RPCErrors.agentBusy(this.currentTaskId).code,
        RPCErrors.agentBusy(this.currentTaskId).message,
        RPCErrors.agentBusy(this.currentTaskId).data
      );
    }

    this.currentTaskId = taskId;
    const chunks: string[] = [];

    // Validate API key first - yield error event if missing
    let apiKey: string;
    try {
      apiKey = this.getApiKey(openAIParams);
    } catch (error) {
      this.currentTaskId = null; // Reset task ID on early error
      const errorMessage = error instanceof Error ? error.message : 'API key is required';
      yield {
        type: 'error',
        data: {
          taskId,
          code: -32001,
          message: errorMessage,
        },
      };
      yield {
        type: 'end',
        data: { taskId, reason: 'error' },
      };
      return {
        taskId,
        totalChunks: 0,
        finalOutput: '',
        status: 'error',
        error: {
          code: -32001,
          message: errorMessage,
        },
      };
    }

    try {
      // Check for cancellation
      if (this.cancelled.has(taskId)) {
        this.cancelled.delete(taskId);
        yield {
          type: 'end',
          data: { taskId, reason: 'cancelled' },
        };
        return {
          taskId,
          totalChunks: 0,
          finalOutput: '',
          status: 'error',
          error: RPCErrors.agentCancelled(taskId),
        };
      }

      // Send initial progress
      yield {
        type: 'progress',
        data: {
          taskId,
          phase: 'thinking',
          progress: 0,
          message: 'Connecting to OpenAI...',
        },
      };

      // Call OpenAI API with streaming
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: openAIParams.model || this.config.model,
          messages: [
            {
              role: 'user',
              content: params.prompt,
            },
          ],
          max_tokens: this.config.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const errorMessage = `OpenAI API error: ${errorData.error?.message || response.statusText}`;
        yield {
          type: 'error',
          data: {
            taskId,
            code: -32002,
            message: errorMessage,
          },
        };
        yield {
          type: 'end',
          data: { taskId, reason: 'error' },
        };
        return {
          taskId,
          totalChunks: 0,
          finalOutput: '',
          status: 'error',
          error: {
            code: -32002,
            message: errorMessage,
          },
        };
      }

      yield {
        type: 'progress',
        data: {
          taskId,
          phase: 'executing',
          progress: 10,
          message: 'Receiving response...',
        },
      };

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let chunkIndex = 0;

      while (true) {
        // Check for cancellation
        if (this.cancelled.has(taskId)) {
          this.cancelled.delete(taskId);
          reader.cancel();
          yield {
            type: 'end',
            data: { taskId, reason: 'cancelled' },
          };
          return {
            taskId,
            totalChunks: chunkIndex,
            finalOutput: chunks.join(''),
            status: 'error',
            error: RPCErrors.agentCancelled(taskId),
          };
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                chunks.push(content);
                yield {
                  type: 'chunk',
                  data: {
                    taskId,
                    index: chunkIndex++,
                    chunk: content,
                    timestamp: Date.now(),
                  },
                };

                // Update progress
                yield {
                  type: 'progress',
                  data: {
                    taskId,
                    phase: 'executing',
                    progress: Math.min(10 + chunkIndex * 2, 90),
                  },
                };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Final progress
      yield {
        type: 'progress',
        data: {
          taskId,
          phase: 'finalizing',
          progress: 100,
        },
      };

      yield {
        type: 'end',
        data: { taskId, reason: 'complete' },
      };

      return {
        taskId,
        totalChunks: chunks.length,
        finalOutput: chunks.join(''),
        status: 'success',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullErrorMessage = `Failed to call OpenAI: ${errorMessage}`;
      yield {
        type: 'error',
        data: {
          taskId,
          code: -32003,
          message: fullErrorMessage,
        },
      };
      yield {
        type: 'end',
        data: { taskId, reason: 'error' },
      };
      return {
        taskId,
        totalChunks: chunks.length,
        finalOutput: chunks.join(''),
        status: 'error',
        error: {
          code: -32003,
          message: fullErrorMessage,
        },
      };
    } finally {
      this.currentTaskId = null;
    }
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<AgentStatus> {
    return {
      running: this.currentTaskId !== null,
      currentTaskId: this.currentTaskId || undefined,
      mode: this.mode,
    };
  }

  /**
   * Cancel a task
   */
  async cancel(taskId: string): Promise<void> {
    this.cancelled.add(taskId);
  }
}
