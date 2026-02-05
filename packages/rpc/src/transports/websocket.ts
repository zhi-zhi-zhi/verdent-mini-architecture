import type { ITransport, TransportEvents } from './interface.js';

/**
 * WebSocket transport for browser and Node.js
 */
export class WebSocketTransport implements ITransport {
  private ws: WebSocket | null = null;
  private messageHandler: ((data: string) => void) | null = null;
  private events: TransportEvents;

  constructor(
    private url: string,
    events: TransportEvents = {}
  ) {
    this.events = events;
  }

  async send(data: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(data);
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.events.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.messageHandler?.(event.data as string);
        };

        this.ws.onerror = () => {
          const error = new Error('WebSocket error');
          this.events.onError?.(error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.events.onDisconnect?.();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the WebSocket URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * Set the WebSocket URL (for auth token injection)
   */
  setUrl(url: string): void {
    this.url = url;
  }
}
