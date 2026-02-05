import type {
  IAuthProvider,
  AuthContext,
  AuthCredentials,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@verdent-mini/core';
import {
  RPCErrors,
  requiresAuth,
  getRequiredPermission,
  hasPermission,
} from '@verdent-mini/core';

/**
 * Connection context with optional auth
 */
export interface ConnectionContext {
  auth?: AuthContext;
  sessionId: string;
}

/**
 * Auth middleware configuration
 */
export interface AuthMiddlewareConfig {
  /** Auth provider */
  provider: IAuthProvider;
  /** Whether auth is required (can be false for local mode) */
  requireAuth: boolean;
  /** Methods that never require auth */
  publicMethods?: string[];
}

/**
 * Create auth middleware for RPC server
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const { provider, requireAuth, publicMethods = [] } = config;

  return async (
    request: JSONRPCRequest,
    context: unknown,
    next: () => Promise<JSONRPCResponse>
  ): Promise<JSONRPCResponse> => {
    const connContext = context as ConnectionContext | undefined;

    // Skip auth if not required (local mode)
    if (!requireAuth) {
      return next();
    }

    // Check if method is explicitly public
    if (publicMethods.includes(request.method)) {
      return next();
    }

    // Check if method requires auth
    if (!requiresAuth(request.method)) {
      return next();
    }

    // Get auth from request params if not in context
    let authContext: AuthContext | undefined = connContext?.auth;

    if (!authContext) {
      const authData = (request.params as { __auth?: AuthCredentials })?.__auth;
      if (authData) {
        const validated = await provider.validate(authData);
        if (validated) {
          authContext = validated;
        }
      }
    }

    // No valid auth
    if (!authContext) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: RPCErrors.authRequired(),
      };
    }

    // Check permissions
    const requiredPermission = getRequiredPermission(request.method);
    if (requiredPermission && !hasPermission(authContext.permissions, requiredPermission)) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: RPCErrors.permissionDenied(requiredPermission),
      };
    }

    // Update context with auth
    if (connContext) {
      connContext.auth = authContext;
    }

    // Remove auth data from params before passing to handler
    if (request.params && typeof request.params === 'object' && '__auth' in request.params) {
      const { __auth, ...cleanParams } = request.params as Record<string, unknown>;
      request.params = cleanParams;
    }

    return next();
  };
}

/**
 * Authenticate a WebSocket connection
 */
export async function authenticateConnection(
  provider: IAuthProvider,
  token: string | null,
  requireAuth: boolean
): Promise<ConnectionContext> {
  const sessionId = crypto.randomUUID();

  if (!token) {
    if (requireAuth) {
      throw new Error('Authentication required');
    }
    return { sessionId };
  }

  const authContext = await provider.validate({
    type: 'token',
    value: token,
  });

  if (!authContext) {
    if (requireAuth) {
      throw new Error('Invalid token');
    }
    return { sessionId };
  }

  return {
    sessionId: authContext.sessionId,
    auth: authContext,
  };
}
