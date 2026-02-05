import { RPC_METHODS } from '../protocol/methods.js';

/**
 * Permission levels
 */
export const PERMISSIONS = {
  GUEST: 'guest',
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Method to required permission mapping
 * null means no authentication required (public method)
 */
export const METHOD_PERMISSIONS: Record<string, Permission | null> = {
  // Public methods (no auth required)
  [RPC_METHODS.SYSTEM_PING]: null,
  [RPC_METHODS.AUTH_LOGIN]: null,

  // User level methods
  [RPC_METHODS.AGENT_EXECUTE]: PERMISSIONS.USER,
  [RPC_METHODS.AGENT_EXECUTE_STREAM]: PERMISSIONS.USER,
  [RPC_METHODS.AGENT_GET_STATUS]: PERMISSIONS.USER,
  [RPC_METHODS.AGENT_CANCEL]: PERMISSIONS.USER,
  [RPC_METHODS.AUTH_LOGOUT]: PERMISSIONS.USER,
  [RPC_METHODS.AUTH_REFRESH]: PERMISSIONS.USER,

  // Admin level methods
  [RPC_METHODS.SYSTEM_GET_MODE]: PERMISSIONS.ADMIN,
};

/**
 * Check if a method requires authentication
 */
export function requiresAuth(method: string): boolean {
  const permission = METHOD_PERMISSIONS[method];
  return permission !== null && permission !== undefined;
}

/**
 * Get required permission for a method
 */
export function getRequiredPermission(method: string): Permission | null {
  return METHOD_PERMISSIONS[method] ?? null;
}

/**
 * Check if user has required permission
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: Permission
): boolean {
  // Admin has all permissions
  if (userPermissions.includes(PERMISSIONS.ADMIN)) {
    return true;
  }

  // User has user and guest permissions
  if (userPermissions.includes(PERMISSIONS.USER)) {
    return (
      requiredPermission === PERMISSIONS.USER ||
      requiredPermission === PERMISSIONS.GUEST
    );
  }

  // Guest only has guest permission
  if (userPermissions.includes(PERMISSIONS.GUEST)) {
    return requiredPermission === PERMISSIONS.GUEST;
  }

  return false;
}
