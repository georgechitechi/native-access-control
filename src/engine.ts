import type {
  AccessControlConfig,
  AccessEvaluator,
  Policies,
  RoleHierarchy,
  RoleRule,
  RuleObject,
} from './types';

export function defaultNormalize(role: string): string {
  return role.trim().toLowerCase();
}

/**
 * Resolves all effective roles for a user by transitively expanding the hierarchy.
 */
export function resolveEffectiveRoles<TRole extends string = string>(
  userRoles: (TRole | string)[],
  hierarchy: RoleHierarchy<TRole> = {},
  normalize: (role: string) => string = defaultNormalize
): TRole[] {
  if (!Array.isArray(userRoles)) return [];

  const normalizedHierarchy: Record<string, string[]> = {};
  for (const [key, children] of Object.entries(hierarchy)) {
    if (!Array.isArray(children)) continue;
    const normKey = normalize(key);
    if (!normalizedHierarchy[normKey]) normalizedHierarchy[normKey] = [];
    normalizedHierarchy[normKey].push(...children);
  }

  const result: TRole[] = [];
  const visited = new Set<string>();
  const queue = [...userRoles];

  while (queue.length > 0) {
    const rawRole = queue.shift();
    if (typeof rawRole !== 'string' || !rawRole.trim()) continue;
    const norm = normalize(rawRole);
    if (!visited.has(norm)) {
      visited.add(norm);
      result.push(rawRole as TRole);

      const directChildren = normalizedHierarchy[norm] || [];
      for (const child of directChildren) {
        if (typeof child === 'string' && !visited.has(normalize(child))) {
          queue.push(child as TRole);
        }
      }
    }
  }

  return result;
}

function matchesRule(
  rule: RoleRule<any, any, any>,
  action: string,
  resource: string,
  context?: any
): { matches: boolean; isDeny: boolean } {
  if (typeof rule === 'string') {
    const matches =
      rule === '*' ||
      rule === `${resource}:*` ||
      rule === `*:${action}` ||
      rule === `${resource}:${action}`;
    return { matches, isDeny: false };
  }

  if (typeof rule === 'object' && rule !== null) {
    const rObj = rule as RuleObject;
    const actionMatches =
      rObj.action === '*' ||
      rObj.action === action ||
      (Array.isArray(rObj.action) && rObj.action.includes(action));

    if (!actionMatches) return { matches: false, isDeny: false };

    const resourceMatches =
      rObj.resource === '*' ||
      rObj.resource === resource ||
      (Array.isArray(rObj.resource) && rObj.resource.includes(resource));

    if (!resourceMatches) return { matches: false, isDeny: false };

    if (rObj.condition) {
      try {
        if (!rObj.condition(context)) return { matches: false, isDeny: false };
      } catch {
        return { matches: false, isDeny: false };
      }
    }

    return { matches: true, isDeny: rObj.effect === 'deny' };
  }

  return { matches: false, isDeny: false };
}

/**
 * Creates an AccessControl Engine instance from a declarative configuration.
 */
export function createAccessEngine<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>(config: AccessControlConfig<TRole, TResource, TAction, TContext>) {
  const normalize = config.normalizeRole || defaultNormalize;

  const clonePolicies = (
    source: Policies<TRole, TResource, TAction, TContext>
  ): Policies<TRole, TResource, TAction, TContext> => {
    const copy: Policies<TRole, TResource, TAction, TContext> = {};
    for (const [role, rules] of Object.entries(source)) {
      if (Array.isArray(rules)) {
        copy[role as TRole] = [...rules];
      }
    }
    return copy;
  };

  const buildNormalizedPolicies = (
    source: Policies<TRole, TResource, TAction, TContext>
  ): Record<string, RoleRule<TResource, TAction, TContext>[]> => {
    const map: Record<string, RoleRule<TResource, TAction, TContext>[]> = {};
    for (const [role, rules] of Object.entries(source)) {
      if (!Array.isArray(rules)) continue;
      const norm = normalize(role);
      if (!map[norm]) map[norm] = [];
      map[norm].push(...rules);
    }
    return map;
  };

  let policies = clonePolicies(config.policies);
  let normalizedPolicies = buildNormalizedPolicies(policies);
  const hierarchy: RoleHierarchy<TRole> = { ...(config.roleHierarchy || {}) };
  const superRolesSet = new Set((config.superRoles || []).map(r => normalize(r)));

  return {
    evaluate(
      userRoles: (TRole | string)[],
      action: TAction | string,
      resource: TResource | string,
      context?: TContext,
      isSuperUser = false
    ): boolean {
      if (typeof action !== 'string' || typeof resource !== 'string' || !action || !resource) {
        return false;
      }

      if (isSuperUser) return true;
      if (!Array.isArray(userRoles)) return false;

      // Check superRoles
      for (const role of userRoles) {
        if (typeof role === 'string' && superRolesSet.has(normalize(role))) return true;
      }

      const effectiveRoles = resolveEffectiveRoles(userRoles, hierarchy, normalize);

      let isAllowed = false;

      for (const role of effectiveRoles) {
        const rules = normalizedPolicies[normalize(role)] || [];
        for (const rule of rules) {
          const { matches, isDeny } = matchesRule(rule, action, resource, context);
          if (matches) {
            // Explicit deny immediately forbids access
            if (isDeny) return false;
            isAllowed = true;
          }
        }
      }

      return isAllowed;
    },

    buildEvaluator(
      userRoles: (TRole | string)[],
      isSuperUser = false
    ): AccessEvaluator<TRole, TResource, TAction, TContext> {
      const effectiveRoles = resolveEffectiveRoles(userRoles, hierarchy, normalize);
      const isSuper =
        isSuperUser ||
        userRoles.some(r => superRolesSet.has(normalize(r)));

      const can = (action: TAction | string, resource: TResource | string, context?: TContext): boolean => {
        return this.evaluate(userRoles, action, resource, context, isSuper);
      };

      const cannot = (action: TAction | string, resource: TResource | string, context?: TContext): boolean => {
        return !can(action, resource, context);
      };

      const canAll = (
        checks: Array<{ action: TAction | string; resource: TResource | string }>,
        context?: TContext
      ): boolean => {
        return checks.every(c => can(c.action, c.resource, context));
      };

      const canAny = (
        checks: Array<{ action: TAction | string; resource: TResource | string }>,
        context?: TContext
      ): boolean => {
        return checks.some(c => can(c.action, c.resource, context));
      };

      const effectiveSet = new Set(effectiveRoles.map(r => normalize(r)));

      const hasAnyRole = (rolesToCheck: (TRole | string)[]): boolean => {
        if (isSuper) return true;
        return rolesToCheck.some(r => effectiveSet.has(normalize(r)));
      };

      const hasAllRoles = (rolesToCheck: (TRole | string)[]): boolean => {
        if (isSuper) return true;
        return rolesToCheck.every(r => effectiveSet.has(normalize(r)));
      };

      const hasRole = (roleOrRoles: TRole | TRole[] | string): boolean => {
        const list = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
        return hasAnyRole(list);
      };

      return {
        can,
        cannot,
        canAll,
        canAny,
        hasRole,
        hasAllRoles,
        hasAnyRole,
        roles: userRoles as TRole[],
        effectiveRoles,
      };
    },

    addPolicy(role: TRole, rule: RoleRule<TResource, TAction, TContext>): void {
      if (!policies[role]) policies[role] = [];
      policies[role]!.push(rule);
      const norm = normalize(role);
      if (!normalizedPolicies[norm]) normalizedPolicies[norm] = [];
      normalizedPolicies[norm].push(rule);
    },

    setPolicies(newPolicies: Policies<TRole, TResource, TAction, TContext>): void {
      policies = clonePolicies(newPolicies);
      normalizedPolicies = buildNormalizedPolicies(policies);
    },

    getPolicies(): Policies<TRole, TResource, TAction, TContext> {
      return clonePolicies(policies);
    },
  };
}
