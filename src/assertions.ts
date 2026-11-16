export class AccessDeniedError extends Error {
  public readonly action?: string;
  public readonly resource?: string;
  public readonly statusCode: number = 403;

  constructor(message: string, action?: string, resource?: string) {
    super(message);
    this.name = 'AccessDeniedError';
    this.action = action;
    this.resource = resource;
  }
}

/**
 * Asserts that the evaluator has permission for the specified action and resource,
 * throwing an AccessDeniedError if not permitted.
 *
 * @example
 * assertCan(evaluator, 'delete', 'contract');
 */
export function assertCan(
  evaluator: { can: (action: any, resource: any, context?: any) => boolean } | null | undefined,
  action: string,
  resource: string,
  context?: any,
  customMessage?: string
): void {
  if (!evaluator || typeof evaluator.can !== 'function' || !evaluator.can(action, resource, context)) {
    throw new AccessDeniedError(
      customMessage ||
        `Access Denied: You do not have permission to perform "${action}" on "${resource}".`,
      action,
      resource
    );
  }
}

/**
 * Asserts that the evaluator possesses the required role(s),
 * throwing an AccessDeniedError if not found.
 *
 * @example
 * assertHasRole(evaluator, ['admin', 'staff']);
 */
export function assertHasRole(
  evaluator: { hasRole: (role: any) => boolean } | null | undefined,
  roleOrRoles: string | string[],
  customMessage?: string
): void {
  if (!evaluator || typeof evaluator.hasRole !== 'function' || !evaluator.hasRole(roleOrRoles)) {
    const roleStr = Array.isArray(roleOrRoles) ? roleOrRoles.join(' or ') : String(roleOrRoles);
    throw new AccessDeniedError(
      customMessage || `Access Denied: Required role (${roleStr}) not found.`
    );
  }
}
