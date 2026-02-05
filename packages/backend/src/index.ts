// Agent
export { MockAgent } from './agent/mock-agent.js';
export { OpenAIAgent, type OpenAIAgentConfig, type OpenAIExecuteParams } from './agent/openai-agent.js';
export { HybridAgent, type HybridAgentConfig } from './agent/hybrid-agent.js';

// Auth
export { SimpleTokenProvider } from './auth/providers/simple-token.js';
export {
  createAuthMiddleware,
  authenticateConnection,
  type ConnectionContext,
  type AuthMiddlewareConfig,
} from './auth/middleware.js';

// RPC
export { registerHandlers } from './rpc-handler.js';
