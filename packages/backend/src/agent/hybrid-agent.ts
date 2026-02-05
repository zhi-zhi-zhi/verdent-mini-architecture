import type {
  IAgent,
  AgentExecuteParams,
  AgentExecuteResult,
  AgentStatus,
  StreamEvent,
  StreamExecuteResult,
  RunMode,
} from '@verdent-mini/core';
import { MockAgent } from './mock-agent.js';
import { OpenAIAgent, type OpenAIAgentConfig } from './openai-agent.js';

/**
 * Hybrid Agent configuration
 */
export interface HybridAgentConfig extends OpenAIAgentConfig {
  /** Default to using real LLM (can be overridden per-request) */
  defaultUseRealLLM?: boolean;
}

/**
 * Hybrid Agent that can switch between Mock and OpenAI agents based on request parameters
 */
export class HybridAgent implements IAgent {
  private mockAgent: MockAgent;
  private openAIAgent: OpenAIAgent;
  private defaultUseRealLLM: boolean;

  constructor(mode: RunMode = 'local', config: HybridAgentConfig = {}) {
    this.mockAgent = new MockAgent(mode);
    this.openAIAgent = new OpenAIAgent(mode, config);
    this.defaultUseRealLLM = config.defaultUseRealLLM ?? false;
  }

  /**
   * Determine which agent to use based on params
   */
  private getAgent(params: AgentExecuteParams): IAgent {
    const useReal = params.useRealLLM ?? this.defaultUseRealLLM;
    return useReal ? this.openAIAgent : this.mockAgent;
  }

  /**
   * Execute a prompt and return result
   */
  async execute(params: AgentExecuteParams): Promise<AgentExecuteResult> {
    const agent = this.getAgent(params);
    return agent.execute(params);
  }

  /**
   * Execute with streaming response
   */
  async *executeStream(
    params: AgentExecuteParams
  ): AsyncGenerator<StreamEvent, StreamExecuteResult, undefined> {
    const agent = this.getAgent(params);
    return yield* agent.executeStream(params);
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<AgentStatus> {
    // Return status from whichever agent is currently active
    const mockStatus = await this.mockAgent.getStatus();
    const openAIStatus = await this.openAIAgent.getStatus();
    
    return {
      running: mockStatus.running || openAIStatus.running,
      currentTaskId: mockStatus.currentTaskId || openAIStatus.currentTaskId,
      mode: mockStatus.mode,
    };
  }

  /**
   * Cancel a task - cancel on both agents to be safe
   */
  async cancel(taskId: string): Promise<void> {
    await Promise.all([
      this.mockAgent.cancel(taskId),
      this.openAIAgent.cancel(taskId),
    ]);
  }
}
