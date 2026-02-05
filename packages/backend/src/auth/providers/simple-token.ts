import type { IAuthProvider, AuthCredentials, AuthContext } from '@verdent-mini/core';
import { PERMISSIONS } from '@verdent-mini/core';

/**
 * Simple token-based auth provider for development/testing
 */
export class SimpleTokenProvider implements IAuthProvider {
  private validTokens: Map<string, { userId?: string; permissions: string[] }>;

  constructor(
    tokens: Array<{
      token: string;
      userId?: string;
      permissions?: string[];
    }> = []
  ) {
    this.validTokens = new Map();

    // Add default tokens for development
    if (tokens.length === 0) {
      this.validTokens.set('dev-token', {
        userId: 'dev-user',
        permissions: [PERMISSIONS.USER],
      });
      this.validTokens.set('admin-token', {
        userId: 'admin-user',
        permissions: [PERMISSIONS.ADMIN],
      });
    } else {
      tokens.forEach(({ token, userId, permissions }) => {
        this.validTokens.set(token, {
          userId,
          permissions: permissions || [PERMISSIONS.USER],
        });
      });
    }
  }

  /**
   * Validate credentials
   */
  async validate(credentials: AuthCredentials): Promise<AuthContext | null> {
    if (credentials.type !== 'token') {
      return null;
    }

    const tokenData = this.validTokens.get(credentials.value);
    if (!tokenData) {
      return null;
    }

    return {
      sessionId: crypto.randomUUID(),
      userId: tokenData.userId,
      permissions: tokenData.permissions,
    };
  }

  /**
   * Add a valid token
   */
  addToken(
    token: string,
    userId?: string,
    permissions: string[] = [PERMISSIONS.USER]
  ): void {
    this.validTokens.set(token, { userId, permissions });
  }

  /**
   * Remove a token
   */
  removeToken(token: string): void {
    this.validTokens.delete(token);
  }

  /**
   * Check if token is valid
   */
  isValidToken(token: string): boolean {
    return this.validTokens.has(token);
  }
}
