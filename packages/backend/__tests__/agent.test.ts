import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockAgent, OpenAIAgent, HybridAgent } from '../src/index.js';
import type { AgentExecuteParams } from '@verdent-mini/core';

describe('MockAgent', () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = new MockAgent('local');
  });

  it('should execute and return mock response', async () => {
    const result = await agent.execute({ prompt: 'Hello' });
    expect(result.status).toBe('success');
    expect(result.output).toContain('Hello');
    expect(result.taskId).toBeDefined();
  });

  it('should stream mock response', async () => {
    const chunks: string[] = [];
    const generator = agent.executeStream({ prompt: 'Test stream' });
    
    for await (const event of generator) {
      if (event.type === 'chunk') {
        chunks.push(event.data.chunk);
      }
    }
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Test stream');
  });

  it('should return status', async () => {
    const status = await agent.getStatus();
    expect(status.running).toBe(false);
    expect(status.mode).toBe('local');
  });

  it('should handle cancellation', async () => {
    const taskId = 'test-task-id';
    await agent.cancel(taskId);
    
    // The cancellation is marked, subsequent execution with same taskId would be cancelled
    await expect(agent.execute({ prompt: 'test', taskId }))
      .rejects.toThrow('cancelled');
  });
});

describe('OpenAIAgent', () => {
  let agent: OpenAIAgent;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    agent = new OpenAIAgent('local', { apiKey: 'test-api-key' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should throw error when no API key is provided', async () => {
    const agentWithoutKey = new OpenAIAgent('local', {});
    
    await expect(agentWithoutKey.execute({ prompt: 'test' }))
      .rejects.toThrow('OpenAI API key is required');
  });

  it('should call OpenAI API for execute', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello from OpenAI!' } }],
      }),
    });

    const result = await agent.execute({ prompt: 'Hello' });
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key',
        }),
      })
    );
    expect(result.status).toBe('success');
    expect(result.output).toBe('Hello from OpenAI!');
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(agent.execute({ prompt: 'test' }))
      .rejects.toThrow('OpenAI API error');
  });

  it('should use custom API key from params', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
      }),
    });

    const params: AgentExecuteParams = {
      prompt: 'test',
      apiKey: 'custom-key',
    };
    
    await agent.execute(params);
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer custom-key',
        }),
      })
    );
  });

  it('should stream response from OpenAI', async () => {
    // Create a mock readable stream
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    });

    const chunks: string[] = [];
    const generator = agent.executeStream({ prompt: 'test' });
    
    // Collect all events
    let iterResult = await generator.next();
    while (!iterResult.done) {
      const event = iterResult.value;
      if (event.type === 'chunk') {
        chunks.push(event.data.chunk);
      }
      iterResult = await generator.next();
    }
    
    // The return value is in iterResult.value when done
    const result = iterResult.value;
    
    expect(chunks).toContain('Hello');
    expect(chunks).toContain(' World');
    expect(result?.finalOutput).toBe('Hello World');
    expect(result?.status).toBe('success');
  });

  it('should return correct status', async () => {
    const status = await agent.getStatus();
    expect(status.running).toBe(false);
    expect(status.mode).toBe('local');
  });
});

describe('HybridAgent', () => {
  let agent: HybridAgent;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    agent = new HybridAgent('web', {
      apiKey: 'test-api-key',
      defaultUseRealLLM: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should use MockAgent by default when useRealLLM is false', async () => {
    const result = await agent.execute({ prompt: 'Test' });
    
    expect(result.status).toBe('success');
    // Mock agent responses contain the mode
    expect(result.output).toMatch(/mock|web|local|remote/i);
  });

  it('should use OpenAIAgent when useRealLLM is true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI Response' } }],
      }),
    });

    const result = await agent.execute({ prompt: 'Test', useRealLLM: true });
    
    expect(global.fetch).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.output).toBe('OpenAI Response');
  });

  it('should respect defaultUseRealLLM config', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Default OpenAI' } }],
      }),
    });

    const agentWithDefaultReal = new HybridAgent('web', {
      apiKey: 'test-key',
      defaultUseRealLLM: true,
    });

    const result = await agentWithDefaultReal.execute({ prompt: 'Test' });
    
    expect(global.fetch).toHaveBeenCalled();
    expect(result.output).toBe('Default OpenAI');
  });

  it('should allow overriding defaultUseRealLLM per request', async () => {
    const agentWithDefaultReal = new HybridAgent('web', {
      apiKey: 'test-key',
      defaultUseRealLLM: true,
    });

    // Override to use mock
    const result = await agentWithDefaultReal.execute({ prompt: 'Test', useRealLLM: false });
    
    // Mock agent returns responses about the mode
    expect(result.output).toMatch(/mock|web|local|remote/i);
    expect(result.status).toBe('success');
  });

  it('should stream with correct agent based on useRealLLM', async () => {
    const chunks: string[] = [];
    
    // Test mock streaming
    const mockGenerator = agent.executeStream({ prompt: 'Test', useRealLLM: false });
    for await (const event of mockGenerator) {
      if (event.type === 'chunk') {
        chunks.push(event.data.chunk);
      }
    }
    
    // Mock agent returns responses about the mode
    expect(chunks.join('')).toMatch(/mock|web|local|remote/i);
  });

  it('should return combined status', async () => {
    const status = await agent.getStatus();
    expect(status.running).toBe(false);
    expect(status.mode).toBe('web');
  });

  it('should cancel on both agents', async () => {
    await expect(agent.cancel('test-task')).resolves.not.toThrow();
  });
});
