# Verdent Mini Architecture

A multi-mode Electron AI Agent framework supporting Local, Remote, and Web modes. This project demonstrates architecture patterns similar to VSCode's multi-mode capabilities.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│         (Electron App or Web Browser)                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│              Unified UI across all modes                 │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Transport Layer                        │
│            IPC / WebSocket / HTTP                        │
└─────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │   Local   │    │  Remote   │    │    Web    │
    │  Backend  │    │  Server   │    │  Server   │
    └───────────┘    └───────────┘    └───────────┘
```

## Modes

| Mode | Description | Auth |
|------|-------------|------|
| **Local** | Electron app with backend in main process | Not required |
| **Remote** | Electron connects to remote server via WebSocket | Required |
| **Web** | Pure browser app connecting to server | Optional |

## Project Structure

```
verdent-mini-architecture/
├── packages/
│   ├── core/           # @verdent-mini/core - Protocol, types, errors
│   ├── rpc/            # @verdent-mini/rpc - JSON-RPC client/server
│   ├── backend/        # @verdent-mini/backend - Agent, auth middleware
│   ├── frontend/       # @verdent-mini/frontend - React UI
│   └── electron/       # @verdent-mini/electron - Desktop app
├── server/             # Standalone server for remote/web modes
└── tests/              # Integration tests
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Installation

```bash
cd verdent-mini-architecture
pnpm install
pnpm build
```

### Configuration (Optional)

Create a `.env` file in the `server/` directory for environment-specific settings:

```bash
# Copy from root or create manually
cat > server/.env << 'EOF'
PORT=3001
MODE=web
REQUIRE_AUTH=false
OPENAI_API_KEY=
DEFAULT_USE_REAL_LLM=false
STATIC_DIR=../packages/frontend/dist
EOF
```

Or manually create `server/.env` with your preferred settings.

### Running Modes

**Local Mode** (Electron with embedded backend):
```bash
pnpm dev:local
```

**Remote Mode** (Server + Electron client):
```bash
# Terminal 1: Start server
pnpm dev:server

# Terminal 2: Start Electron in remote mode
pnpm --filter @verdent-mini/electron dev:remote
```

**Web Mode** (Browser-based):
```bash
pnpm dev:web
# Open http://localhost:3001 in browser
```

### Running Tests

```bash
# All tests
pnpm test

# Integration tests only
pnpm test:integration

# Watch mode
pnpm test:watch
```

**Integration Tests**:
- `local-mode.test.ts` - Tests Electron local mode with embedded backend
- `remote-mode.test.ts` - Tests Electron connecting to remote WebSocket server
- `streaming.test.ts` - Tests streaming responses and progress events
- `web-mode.test.ts` - Tests browser-based web mode

## Configuration

### Environment Variables

The server supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `MODE` | `web` | Run mode: `local`, `remote`, `saas` or `web` |
| `REQUIRE_AUTH` | `false` | Whether authentication is required |
| `STATIC_DIR` | `../../packages/frontend/dist` | Static files directory for web mode |
| `OPENAI_API_KEY` | - | OpenAI API key for real LLM integration |
| `DEFAULT_USE_REAL_LLM` | `false` | Use real LLM by default (can be overridden per-request) |

**Example**:

```bash
# Method 1: Using environment variables (macOS/Linux)
OPENAI_API_KEY=sk-xxx DEFAULT_USE_REAL_LLM=true pnpm dev:server
REQUIRE_AUTH=true pnpm dev:server

# Method 2: Using .env file (recommended for all platforms)
# Create a .env file in the server directory:
# server/.env
```

**server/.env** example:
```env
PORT=3001
MODE=web
REQUIRE_AUTH=true
OPENAI_API_KEY=sk-your-api-key-here
DEFAULT_USE_REAL_LLM=true
STATIC_DIR=../packages/frontend/dist
```

Then simply run:
```bash
pnpm dev:server
```

> **Note**: `.env` files are already ignored in `.gitignore`. The server now supports loading environment variables from `.env` files using `dotenv`.

**Electron Environment Variables**:

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_MODE` | `local` | Agent mode: `local` or `remote` |
| `REMOTE_URL` | `ws://localhost:3001/ws` | Remote server URL (for remote mode) |

## Key Features

### 1. Hybrid Agent (Mock & Real LLM)

The framework includes a `HybridAgent` that can dynamically switch between mock responses and real OpenAI integration:

```typescript
// Server configuration
const agent = new HybridAgent('local', {
  apiKey: process.env.OPENAI_API_KEY,
  defaultUseRealLLM: false, // Default to mock agent
});

// Client request - override to use real LLM for this specific call
const result = await client.call('agent/execute', {
  prompt: 'Explain quantum computing',
  useRealLLM: true, // Use OpenAI for this request
});
```

**Benefits**:
- Development without API costs (mock agent)
- Easy testing with predictable responses
- Seamless switch to production LLM
- Per-request override capability

### 2. Streaming Support

The framework supports streaming responses via JSON-RPC notifications:

```typescript
// taskId is optional - will be auto-generated if not provided
const stream = client.callStream('agent/executeStream', { 
  prompt: 'Write a story',
  // taskId: 'my-task-123', // Optional: provide your own taskId
});

for await (const event of stream) {
  if (event.type === 'chunk') {
    console.log(event.data.chunk);
  } else if (event.type === 'progress') {
    console.log(`${event.data.phase}: ${event.data.progress}%`);
  } else if (event.type === 'error') {
    console.error('Stream error:', event.data);
  }
}

// Generator returns the final result
console.log('Final result:', stream.return);
```

**Note**: The `callStream` method automatically generates a unique `taskId` if not provided, ensuring proper event routing.

### 3. Error Handling

Comprehensive error code system:

```typescript
// Error categories
- AUTH_*: Authentication errors (-32000 to -32009)
- AGENT_*: Agent execution errors (-32010 to -32029)
- CONNECTION_*: Network errors (-32030 to -32039)

// Retryable errors include retry hints
error.data.retryable // boolean
error.data.retryAfter // seconds

// Example error handling
try {
  await client.call('agent/execute', { prompt });
} catch (error) {
  if (error.code === ERROR_CODES.AGENT_BUSY) {
    console.log(`Retry after ${error.data.retryAfter} seconds`);
  }
}
```

### 4. Authentication

Mode-specific authentication with flexible configuration:

```typescript
// Option 1: Local mode - No auth required
createAuthMiddleware({ 
  provider: new SimpleTokenProvider(),
  requireAuth: false 
})

// Option 2: Default dev tokens (dev-token, admin-token)
createAuthMiddleware({ 
  provider: new SimpleTokenProvider(), // Auto-creates dev tokens
  requireAuth: true 
})

// Option 3: Custom tokens
createAuthMiddleware({ 
  provider: new SimpleTokenProvider([
    { token: 'user-token', userId: 'user-1', permissions: ['user'] },
    { token: 'admin-token', userId: 'admin-1', permissions: ['admin'] }
  ]),
  requireAuth: true 
})
```

**Default Tokens** (when no tokens provided):
- `dev-token` - User with `user` permission
- `admin-token` - User with `admin` permission

### 5. Transport Abstraction

Pluggable transport layer:

- `MemoryTransport` - For testing
- `IPCTransport` - Electron IPC
- `WebSocketTransport` - Browser/Node WebSocket

## Technology Stack

| Component | Technology |
|-----------|------------|
| Monorepo | pnpm workspace |
| Frontend | React 18, Vite |
| Desktop | Electron 28 |
| Protocol | JSON-RPC 2.0 |
| Server | Express, ws |
| Testing | Vitest |
| Build | tsup |

## Usage Examples

### Using the Agent

```typescript
// Simple execution
const result = await client.call('agent/execute', {
  prompt: 'What is the capital of France?',
  context: { language: 'en' },
});

console.log(result.result); // Agent response
console.log(result.tokenCount); // Token usage
```

### Streaming with Real-time Progress

```typescript
const stream = client.callStream('agent/executeStream', {
  prompt: 'Write a comprehensive guide',
  useRealLLM: true, // Use OpenAI
});

for await (const event of stream) {
  switch (event.type) {
    case 'chunk':
      process.stdout.write(event.data.chunk);
      break;
    case 'progress':
      console.log(`Progress: ${event.data.progress}%`);
      break;
    case 'error':
      console.error('Error:', event.data.error);
      break;
  }
}
```

### Authentication in Client

```typescript
// WebSocket client with auth
const transport = new WebSocketTransport('ws://localhost:3001/ws', {
  headers: {
    Authorization: 'Bearer dev-token',
  },
});

const client = new RPCClient(transport);
await client.connect();
```

## Extending

### Adding New Agent Capabilities

1. Define method in `packages/core/src/protocol/methods.ts`
2. Add types in `packages/core/src/protocol/types.ts`
3. Implement handler in `packages/backend/src/rpc-handler.ts`

### Adding New Transport

Implement `ITransport` interface:

```typescript
interface ITransport {
  send(data: string): Promise<void>;
  onMessage(handler: (data: string) => void): void;
  connect?(): Promise<void>;
  disconnect?(): void;
}
```

## License

MIT
