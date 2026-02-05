import type { AuthCredentials } from '@verdent-mini/core';
import type { ITransport } from '../transports/interface.js';
import { WebSocketTransport } from '../transports/websocket.js';

/**
 * Auth interceptor that wraps a transport to add authentication
 */
export class AuthInterceptor {
  private credentials: AuthCredentials | null = null;
  private refreshPromise: Promise<void> | null = null;
  private onTokenRefresh?: (newCredentials: AuthCredentials) => Promise<AuthCredentials | null>;

  /**
   * Set current credentials
   */
  setCredentials(credentials: AuthCredentials | null): void {
    this.credentials = credentials;
  }

  /**
   * Get current credentials
   */
  getCredentials(): AuthCredentials | null {
    return this.credentials;
  }

  /**
   * Set token refresh callback
   */
  setTokenRefreshCallback(
    callback: (credentials: AuthCredentials) => Promise<AuthCredentials | null>
  ): void {
    this.onTokenRefresh = callback;
  }

  /**
   * Check if token is expiring soon (within 5 minutes)
   */
  isTokenExpiringSoon(): boolean {
    if (!this.credentials?.expiresAt) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return this.credentials.expiresAt - Date.now() < fiveMinutes;
  }

  /**
   * Refresh token if needed
   */
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.credentials || !this.isTokenExpiringSoon() || !this.onTokenRefresh) {
      return;
    }

    // Prevent multiple refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const newCredentials = await this.onTokenRefresh!(this.credentials!);
        if (newCredentials) {
          this.credentials = newCredentials;
        }
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Wrap a transport to add auth header/token
   */
  wrapTransport(transport: ITransport): ITransport {
    const self = this;

    return {
      async send(data: string): Promise<void> {
        // Refresh token if needed before sending
        await self.refreshTokenIfNeeded();

        // For regular transports, we can inject auth into the request
        if (self.credentials) {
          try {
            const request = JSON.parse(data);
            request.params = {
              ...request.params,
              __auth: {
                type: self.credentials.type,
                value: self.credentials.value,
              },
            };
            data = JSON.stringify(request);
          } catch {
            // If parsing fails, send as-is
          }
        }

        return transport.send(data);
      },

      onMessage(handler: (data: string) => void): void {
        transport.onMessage(handler);
      },

      async connect(): Promise<void> {
        // For WebSocket, inject token into URL
        if (transport instanceof WebSocketTransport && self.credentials) {
          const url = new URL(transport.getUrl());
          url.searchParams.set('token', self.credentials.value);
          transport.setUrl(url.toString());
        }

        await transport.connect?.();
      },

      disconnect(): void {
        transport.disconnect?.();
      },

      isConnected(): boolean {
        return transport.isConnected?.() ?? false;
      },
    };
  }
}
