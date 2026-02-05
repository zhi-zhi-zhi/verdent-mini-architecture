/**
 * Authentication credentials
 */
export interface AuthCredentials {
  type: 'token' | 'apiKey';
  value: string;
  expiresAt?: number; // Unix timestamp in ms
}

/**
 * Authentication context (after successful auth)
 */
export interface AuthContext {
  sessionId: string;
  userId?: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Auth provider interface
 */
export interface IAuthProvider {
  /**
   * Validate credentials and return auth context
   */
  validate(credentials: AuthCredentials): Promise<AuthContext | null>;

  /**
   * Refresh credentials (if supported)
   */
  refresh?(credentials: AuthCredentials): Promise<AuthCredentials | null>;
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  /** Whether authentication is required */
  requireAuth: boolean;
  /** List of methods that don't require authentication */
  publicMethods?: string[];
}

/**
 * Login request params
 */
export interface LoginParams {
  type: 'token' | 'apiKey';
  value: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  success: boolean;
  sessionId?: string;
  expiresAt?: number;
  error?: string;
}
