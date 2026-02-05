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
 * Mock Agent implementation for testing and demonstration
 */
export class MockAgent implements IAgent {
  private currentTaskId: string | null = null;
  private cancelled = new Set<string>();
  private mode: RunMode;

  constructor(mode: RunMode = 'local') {
    this.mode = mode;
  }

  /**
   * Execute a prompt and return result
   */
  async execute(params: AgentExecuteParams): Promise<AgentExecuteResult> {
    const taskId = params.taskId || crypto.randomUUID();

    if (this.currentTaskId) {
      throw new RPCException(
        RPCErrors.agentBusy(this.currentTaskId).code,
        RPCErrors.agentBusy(this.currentTaskId).message,
        RPCErrors.agentBusy(this.currentTaskId).data
      );
    }

    this.currentTaskId = taskId;

    try {
      // Simulate processing time
      await this.delay(100);

      if (this.cancelled.has(taskId)) {
        this.cancelled.delete(taskId);
        throw new RPCException(
          RPCErrors.agentCancelled(taskId).code,
          RPCErrors.agentCancelled(taskId).message
        );
      }

      // Generate mock response
      const output = this.generateMockResponse(params.prompt);

      return {
        taskId,
        output,
        status: 'success',
      };
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

    if (this.currentTaskId) {
      throw new RPCException(
        RPCErrors.agentBusy(this.currentTaskId).code,
        RPCErrors.agentBusy(this.currentTaskId).message,
        RPCErrors.agentBusy(this.currentTaskId).data
      );
    }

    this.currentTaskId = taskId;

    try {
      // Send initial progress
      yield {
        type: 'progress',
        data: {
          taskId,
          phase: 'thinking',
          progress: 0,
          message: 'Processing your request...',
        },
      };

      await this.delay(50);

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

      // Generate response chunks
      const response = this.generateMockResponse(params.prompt);
      const chunks = this.splitIntoChunks(response, 20);

      yield {
        type: 'progress',
        data: {
          taskId,
          phase: 'executing',
          progress: 10,
        },
      };

      // Stream chunks
      for (let i = 0; i < chunks.length; i++) {
        if (this.cancelled.has(taskId)) {
          this.cancelled.delete(taskId);
          yield {
            type: 'end',
            data: { taskId, reason: 'cancelled' },
          };
          return {
            taskId,
            totalChunks: i,
            finalOutput: chunks.slice(0, i).join(''),
            status: 'error',
            error: RPCErrors.agentCancelled(taskId),
          };
        }

        yield {
          type: 'chunk',
          data: {
            taskId,
            index: i,
            chunk: chunks[i],
            timestamp: Date.now(),
          },
        };

        yield {
          type: 'progress',
          data: {
            taskId,
            phase: 'executing',
            progress: 10 + Math.floor((i / chunks.length) * 80),
          },
        };

        await this.delay(30);
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
        finalOutput: response,
        status: 'success',
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

  /**
   * Generate mock response based on prompt
   */
  private generateMockResponse(prompt: string): string {
    const responses = [
      `I received your prompt: "${prompt}". This is a mock response from the ${this.mode} mode agent.`,
      `Processing "${prompt}" in ${this.mode} mode. Here's a simulated response demonstrating the streaming capability.`,
      `Mock Agent (${this.mode}): Your request "${prompt}" has been processed successfully.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Split text into chunks
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
