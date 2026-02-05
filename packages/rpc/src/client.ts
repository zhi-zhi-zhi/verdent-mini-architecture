import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  StreamEvent,
} from '@verdent-mini/core';
import { STREAM_METHODS } from '@verdent-mini/core';
import type { ITransport } from './transports/interface.js';
import { RPCClientError } from './errors.js';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type NotificationHandler = (params: unknown) => void;

/**
 * JSON-RPC 2.0 Client with streaming support
 */
export class RPCClient {
  private pendingRequests = new Map<string | number, PendingRequest>();
  private notificationHandlers = new Map<string, Set<NotificationHandler>>();
  private requestId = 0;

  constructor(private transport: ITransport) {
    this.transport.onMessage(this.handleMessage.bind(this));
  }

  /**
   * Make an RPC call
   */
  async call<T>(method: string, params?: unknown): Promise<T> {
    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      this.transport.send(JSON.stringify(request)).catch((error) => {
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  /**
   * Subscribe to notifications
   * Returns unsubscribe function
   */
  onNotification(method: string, handler: NotificationHandler): () => void {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set());
    }
    this.notificationHandlers.get(method)!.add(handler);

    return () => {
      this.notificationHandlers.get(method)?.delete(handler);
    };
  }

  /**
   * Make a streaming RPC call
   * Returns an async generator that yields stream events
   */
  async *callStream<TResult>(
    method: string,
    params?: unknown
  ): AsyncGenerator<StreamEvent, TResult, undefined> {
    // Use existing taskId from params, or generate new one
    const paramsObj = (params as { taskId?: string } | undefined) || {};
    const taskId = paramsObj.taskId || crypto.randomUUID();
    const paramsWithTaskId = { ...(params as object || {}), taskId };

    // Queue for incoming chunks
    const eventQueue: StreamEvent[] = [];
    let resolveNext: ((done: boolean) => void) | null = null;
    let finalResult: TResult | null = null;
    let streamError: Error | null = null;
    let streamEnded = false;

    // Subscribe to stream notifications
    const unsubChunk = this.onNotification(STREAM_METHODS.STREAM_CHUNK, (data) => {
      const chunk = data as { taskId: string };
      if (chunk.taskId === taskId) {
        eventQueue.push({ type: 'chunk', data: data as StreamEvent['data'] } as StreamEvent);
        resolveNext?.(false);
      }
    });

    const unsubProgress = this.onNotification(STREAM_METHODS.STREAM_PROGRESS, (data) => {
      const progress = data as { taskId: string };
      if (progress.taskId === taskId) {
        eventQueue.push({ type: 'progress', data: data as StreamEvent['data'] } as StreamEvent);
        resolveNext?.(false);
      }
    });

    const unsubEnd = this.onNotification(STREAM_METHODS.STREAM_END, (data) => {
      const end = data as { taskId: string };
      if (end.taskId === taskId) {
        streamEnded = true;
        resolveNext?.(true);
      }
    });

    const unsubError = this.onNotification(STREAM_METHODS.STREAM_ERROR, (data) => {
      const error = data as { taskId: string };
      if (error.taskId === taskId) {
        eventQueue.push({ type: 'error', data: data as StreamEvent['data'] } as StreamEvent);
        resolveNext?.(false);
      }
    });

    // Start the streaming call
    const resultPromise = this.call<TResult>(method, paramsWithTaskId);

    // Handle final result
    resultPromise
      .then((result) => {
        finalResult = result;
        streamEnded = true;
        resolveNext?.(true);
      })
      .catch((error) => {
        streamError = error;
        streamEnded = true;
        resolveNext?.(true);
      });

    try {
      while (!streamEnded || eventQueue.length > 0) {
        // Yield any queued events
        while (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        }

        // Wait for next event or completion
        if (!streamEnded) {
          await new Promise<boolean>((resolve) => {
            resolveNext = resolve;
          });
          resolveNext = null;
        }
      }

      // Check for errors
      if (streamError) {
        throw streamError;
      }

      return finalResult!;
    } finally {
      unsubChunk();
      unsubProgress();
      unsubEnd();
      unsubError();
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as JSONRPCResponse | JSONRPCNotification;

      // Check if it's a notification (no id)
      if (!('id' in message) || message.id === null) {
        const notification = message as JSONRPCNotification;
        const handlers = this.notificationHandlers.get(notification.method);
        if (handlers) {
          handlers.forEach((handler) => handler(notification.params));
        }
        return;
      }

      // It's a response
      const response = message as JSONRPCResponse;
      const pending = this.pendingRequests.get(response.id!);
      if (!pending) {
        console.warn('Received response for unknown request:', response.id);
        return;
      }

      this.pendingRequests.delete(response.id!);

      if (response.error) {
        pending.reject(new RPCClientError(response.error));
      } else {
        pending.resolve(response.result);
      }
    } catch (error) {
      console.error('Failed to parse RPC message:', error);
    }
  }

  /**
   * Connect the transport (if applicable)
   */
  async connect(): Promise<void> {
    await this.transport.connect?.();
  }

  /**
   * Disconnect the transport
   */
  disconnect(): void {
    this.transport.disconnect?.();
  }
}
