/**
 * Custom Error Classes for Authentication and Authorization
 *
 * These errors are used throughout the application to provide
 * type-safe error handling for auth-related scenarios.
 */

/**
 * Base authentication error
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * User is not authenticated (401)
 */
export class UnauthorizedError extends AuthError {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }

  statusCode: number;
}

/**
 * User is authenticated but lacks permission (403)
 */
export class ForbiddenError extends AuthError {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }

  statusCode: number;
}

/**
 * User is not a member of any shop
 */
export class NoMembershipError extends AuthError {
  constructor(message: string = 'No shop membership found') {
    super(message);
    this.name = 'NoMembershipError';
    this.statusCode = 403;
    Object.setPrototypeOf(this, NoMembershipError.prototype);
  }

  statusCode: number;
}

/**
 * User does not have access to a specific shop
 */
export class ShopAccessDeniedError extends ForbiddenError {
  constructor(shopId: string) {
    super(`Access denied to shop: ${shopId}`);
    this.name = 'ShopAccessDeniedError';
    Object.setPrototypeOf(this, ShopAccessDeniedError.prototype);
  }
}

/**
 * User role is insufficient for the operation
 */
export class InsufficientRoleError extends ForbiddenError {
  constructor(required: string, actual: string) {
    super(`Role '${actual}' insufficient. Required: '${required}'`);
    this.name = 'InsufficientRoleError';
    Object.setPrototypeOf(this, InsufficientRoleError.prototype);
  }
}

/**
 * Token is invalid or expired
 */
export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid or expired token') {
    super(message);
    this.name = 'InvalidTokenError';
    this.statusCode = 401;
    Object.setPrototypeOf(this, InvalidTokenError.prototype);
  }

  statusCode: number;
}
