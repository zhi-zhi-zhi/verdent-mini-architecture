import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  RPCError,
  StreamEvent,
} from '@verdent-mini/core';
import { RPCErrors } from '@verdent-mini/core';
import type { ITransport } from './transports/interface.js';
import { RPCException } from './errors.js';

type RequestHandler = (params: unknown, context?: unknown) => Promise<unknown>;
type StreamHandler = (
  params: unknown,
  context?: unknown
) => AsyncGenerator<StreamEvent, unknown, undefined>;
type MiddlewareNext = () => Promise<JSONRPCResponse>;
type Middleware = (
  request: JSONRPCRequest,
  context: unknown,
  next: MiddlewareNext
) => Promise<JSONRPCResponse>;

/**
 * JSON-RPC 2.0 Server with streaming support
 */
export class RPCServer {
  private handlers = new Map<string, RequestHandler>();
  private streamHandlers = new Map<string, StreamHandler>();
  private middlewares: Middleware[] = [];
  private transports = new Set<ITransport>();

  /**
   * Register a request handler
   */
  register(method: string, handler: RequestHandler): void {
    this.handlers.set(method, handler);
  }

  /**
   * Register a streaming handler
   */
  registerStream(method: string, handler: StreamHandler): void {
    this.streamHandlers.set(method, handler);
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Add a transport and start listening
   */
  addTransport(transport: ITransport, context?: unknown): void {
    this.transports.add(transport);
    transport.onMessage(async (data) => {
      const response = await this.handleMessage(data, transport, context);
      if (response) {
        await transport.send(JSON.stringify(response));
      }
    });
  }

  /**
   * Remove a transport
   */
  removeTransport(transport: ITransport): void {
    this.transports.delete(transport);
    transport.disconnect?.();
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    data: string,
    transport: ITransport,
    context?: unknown
  ): Promise<JSONRPCResponse | null> {
    let request: JSONRPCRequest;

    try {
      request = JSON.parse(data) as JSONRPCRequest;
    } catch {
      return this.createErrorResponse(null, RPCErrors.parseError());
    }

    // Validate request
    if (request.jsonrpc !== '2.0' || !request.method) {
      return this.createErrorResponse(request.id, RPCErrors.invalidRequest());
    }

    // Run through middlewares
    const runMiddlewares = async (index: number): Promise<JSONRPCResponse> => {
      if (index < this.middlewares.length) {
        return this.middlewares[index](request, context, () =>
          runMiddlewares(index + 1)
        );
      }
      return this.executeHandler(request, transport, context);
    };

    try {
      return await runMiddlewares(0);
    } catch (error) {
      return this.handleError(request.id, error);
    }
  }

  /**
   * Execute the appropriate handler
   */
  private async executeHandler(
    request: JSONRPCRequest,
    transport: ITransport,
    context?: unknown
  ): Promise<JSONRPCResponse> {
    // Check for streaming handler first
    const streamHandler = this.streamHandlers.get(request.method);
    if (streamHandler) {
      return this.executeStreamHandler(request, streamHandler, transport, context);
    }

    // Check for regular handler
    const handler = this.handlers.get(request.method);
    if (!handler) {
      return this.createErrorResponse(
        request.id,
        RPCErrors.methodNotFound(request.method)
      );
    }

    try {
      const result = await handler(request.params, context);
      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      return this.handleError(request.id, error);
    }
  }

  /**
   * Execute a streaming handler
   */
  private async executeStreamHandler(
    request: JSONRPCRequest,
    handler: StreamHandler,
    transport: ITransport,
    context?: unknown
  ): Promise<JSONRPCResponse> {
    try {
      const generator = handler(request.params, context);

      let result: unknown;
      for await (const event of generator) {
        // Send notification for each stream event
        const notification = this.createNotification(
          this.getNotificationMethod(event.type),
          event.data
        );
        await transport.send(JSON.stringify(notification));
      }

      // Get final result from generator
      const finalResult = await generator.next();
      result = finalResult.value;

      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      return this.handleError(request.id, error);
    }
  }

  /**
   * Get notification method for stream event type
   */
  private getNotificationMethod(type: StreamEvent['type']): string {
    switch (type) {
      case 'chunk':
        return 'agent/streamChunk';
      case 'progress':
        return 'agent/streamProgress';
      case 'end':
        return 'agent/streamEnd';
      case 'error':
        return 'agent/streamError';
      default:
        return 'agent/streamChunk';
    }
  }

  /**
   * Handle errors
   */
  private handleError(
    id: string | number | null,
    error: unknown
  ): JSONRPCResponse {
    if (error instanceof RPCException) {
      return this.createErrorResponse(id, error.toRPCError());
    }

    console.error('Unhandled RPC error:', error);
    return this.createErrorResponse(id, RPCErrors.internalError());
  }

  /**
   * Create a success response
   */
  private createSuccessResponse(
    id: string | number | null,
    result: unknown
  ): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create an error response
   */
  private createErrorResponse(
    id: string | number | null,
    error: RPCError
  ): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      error,
    };
  }

  /**
   * Create a notification
   */
  private createNotification(
    method: string,
    params?: unknown
  ): JSONRPCNotification {
    return {
      jsonrpc: '2.0',
      method,
      params,
    };
  }

  /**
   * Send a notification to all transports
   */
  async broadcast(method: string, params?: unknown): Promise<void> {
    const notification = this.createNotification(method, params);
    const data = JSON.stringify(notification);

    await Promise.all(
      Array.from(this.transports).map((transport) =>
        transport.send(data).catch((error) => {
          console.error('Failed to broadcast to transport:', error);
        })
      )
    );
  }
}
