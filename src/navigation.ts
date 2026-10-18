export interface RouteAccessOptions {
  fallbackRoute?: string;
}

export interface RouteAccessResult {
  allowed: boolean;
  redirectTo?: string;
}

function isPermitted(required: string | string[], userRoles: string[]): boolean {
  if (required === '*') return true;
  if (Array.isArray(required)) {
    return required.some(r => r === '*' || userRoles.includes(r));
  }
  return userRoles.includes(required);
}

/**
 * Validates route permissions for Expo Router, React Navigation, or Next.js.
 * Supports single roles, arrays of roles, '*' wildcards, and prefix patterns (e.g. '/admin/*').
 *
 * @example
 * const { allowed, redirectTo } = checkRouteAccess(pathname, userRoles, {
 *   '/admin/*': 'admin',
 *   '/reports': ['admin', 'staff'],
 *   '/dashboard': '*',
 * }, { fallbackRoute: '/login' });
 */
export function checkRouteAccess(
  pathname: string,
  userRoles: string[],
  routes: Record<string, string | string[]>,
  options: RouteAccessOptions = {}
): RouteAccessResult {
  const { fallbackRoute = '/' } = options;

  // 1. Exact match check
  if (routes[pathname] !== undefined) {
    const allowed = isPermitted(routes[pathname], userRoles);
    return { allowed, redirectTo: allowed ? undefined : fallbackRoute };
  }

  // 2. Wildcard prefix match (e.g. '/admin/*')
  for (const [pattern, required] of Object.entries(routes)) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const allowed = isPermitted(required, userRoles);
        return { allowed, redirectTo: allowed ? undefined : fallbackRoute };
      }
    }
  }

  // Route has no explicit restrictions
  return { allowed: true };
}
