/**
 * Transport layer interface
 * Abstracts the communication channel between client and server
 */
export interface ITransport {
  /**
   * Send data through the transport
   */
  send(data: string): Promise<void>;

  /**
   * Register a message handler
   */
  onMessage(handler: (data: string) => void): void;

  /**
   * Connect to the remote endpoint (if applicable)
   */
  connect?(): Promise<void>;

  /**
   * Disconnect from the remote endpoint
   */
  disconnect?(): void;

  /**
   * Check if the transport is connected
   */
  isConnected?(): boolean;
}

/**
 * Transport events
 */
export interface TransportEvents {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
