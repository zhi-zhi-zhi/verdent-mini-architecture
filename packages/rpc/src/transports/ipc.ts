import type { ITransport } from './interface.js';

/**
 * Electron IPC API interface (exposed via preload)
 */
export interface ElectronAPI {
  send(channel: string, data: string): void;
  on(channel: string, callback: (data: string) => void): void;
  removeListener(channel: string, callback: (data: string) => void): void;
}

/**
 * IPC transport for Electron renderer process
 */
export class IPCTransport implements ITransport {
  private messageHandler: ((data: string) => void) | null = null;
  private boundHandler: ((data: string) => void) | null = null;

  constructor(
    private electronAPI: ElectronAPI,
    private channel: string = 'rpc'
  ) {}

  async send(data: string): Promise<void> {
    this.electronAPI.send(this.channel, data);
  }

  onMessage(handler: (data: string) => void): void {
    // Remove previous handler if exists
    if (this.boundHandler) {
      this.electronAPI.removeListener(`${this.channel}-response`, this.boundHandler);
    }

    this.messageHandler = handler;
    this.boundHandler = (data: string) => {
      this.messageHandler?.(data);
    };

    this.electronAPI.on(`${this.channel}-response`, this.boundHandler);
  }

  disconnect(): void {
    if (this.boundHandler) {
      this.electronAPI.removeListener(`${this.channel}-response`, this.boundHandler);
      this.boundHandler = null;
    }
    this.messageHandler = null;
  }

  isConnected(): boolean {
    return true; // IPC is always connected within Electron
  }
}
