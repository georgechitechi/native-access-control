import { defaultNormalize } from './engine';

export interface RouteAccessOptions {
  fallbackRoute?: string;
  normalizeRole?: (role: string) => string;
}

export interface RouteAccessResult {
  allowed: boolean;
  redirectTo?: string;
}

function normalizePathname(pathname: string): string {
  const withoutQueryOrHash = pathname.split(/[?#]/)[0] || '/';
  if (withoutQueryOrHash.length > 1 && withoutQueryOrHash.endsWith('/')) {
    return withoutQueryOrHash.slice(0, -1);
  }
  return withoutQueryOrHash;
}

function isPermitted(
  required: string | string[],
  normalizedUserRoles: Set<string>,
  normalizeRole: (role: string) => string
): boolean {
  if (required === '*') return true;
  if (Array.isArray(required)) {
    return required.some(r => r === '*' || normalizedUserRoles.has(normalizeRole(r)));
  }
  return normalizedUserRoles.has(normalizeRole(required));
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
  const { fallbackRoute = '/', normalizeRole = defaultNormalize } = options;
  const normalizedPath = normalizePathname(pathname);
  const normalizedUserRoles = new Set(
    (Array.isArray(userRoles) ? userRoles : [])
      .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      .map(normalizeRole)
  );

  // 1. Exact match check
  for (const [pattern, required] of Object.entries(routes)) {
    if (!pattern.endsWith('/*') && normalizePathname(pattern) === normalizedPath) {
      const allowed = isPermitted(required, normalizedUserRoles, normalizeRole);
      return { allowed, redirectTo: allowed ? undefined : fallbackRoute };
    }
  }

  // 2. Wildcard prefix match (longest/most-specific prefix wins, e.g. '/admin/billing/*' over '/admin/*')
  const wildcardRoutes = Object.entries(routes)
    .filter(([pattern]) => pattern.endsWith('/*'))
    .map(([pattern, required]) => ({
      prefix: normalizePathname(pattern.slice(0, -2)),
      required,
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  for (const { prefix, required } of wildcardRoutes) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      const allowed = isPermitted(required, normalizedUserRoles, normalizeRole);
      return { allowed, redirectTo: allowed ? undefined : fallbackRoute };
    }
  }

  // Route has no explicit restrictions
  return { allowed: true };
}
