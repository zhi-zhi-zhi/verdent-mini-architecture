import type { ITransport } from './interface.js';

/**
 * In-memory transport for testing
 * Creates a pair of connected transports that communicate directly
 */
export class MemoryTransport implements ITransport {
  private peer: MemoryTransport | null = null;
  private messageHandler: ((data: string) => void) | null = null;
  private connected = false;

  /**
   * Create a pair of connected memory transports
   */
  static createPair(): [MemoryTransport, MemoryTransport] {
    const a = new MemoryTransport();
    const b = new MemoryTransport();
    a.peer = b;
    b.peer = a;
    a.connected = true;
    b.connected = true;
    return [a, b];
  }

  async send(data: string): Promise<void> {
    if (!this.peer) {
      throw new Error('Transport not connected');
    }
    // Simulate async message delivery
    await Promise.resolve();
    this.peer.messageHandler?.(data);
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
    this.peer = null;
  }

  isConnected(): boolean {
    return this.connected && this.peer !== null;
  }
}
