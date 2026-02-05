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

## Key Features

### 1. Streaming Support

The framework supports streaming responses via JSON-RPC notifications:

```typescript
const stream = client.callStream('agent/executeStream', { prompt });

for await (const event of stream) {
  if (event.type === 'chunk') {
    console.log(event.data.chunk);
  } else if (event.type === 'progress') {
    console.log(`${event.data.phase}: ${event.data.progress}%`);
  }
}
```

### 2. Error Handling

Comprehensive error code system:

```typescript
// Error categories
- AUTH_*: Authentication errors (-32000 to -32009)
- AGENT_*: Agent execution errors (-32010 to -32029)
- CONNECTION_*: Network errors (-32030 to -32039)

// Retryable errors include retry hints
error.data.retryable // boolean
error.data.retryAfter // seconds
```

### 3. Authentication

Mode-specific authentication:

```typescript
// Local mode: No auth required
createAuthMiddleware({ requireAuth: false })

// Remote/Web mode: Token-based auth
createAuthMiddleware({ 
  provider: new SimpleTokenProvider([
    { token: 'user-token', permissions: ['user'] }
  ]),
  requireAuth: true 
})
```

### 4. Transport Abstraction

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
