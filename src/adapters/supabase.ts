import type { ScopeFilterOptions } from '../scoping';

export type SupabaseMatchFilter = Record<string, any>;

export interface FilterableQuery {
  eq(column: string, value: any): this;
}

/**
 * Returns a filter object directly usable with Supabase's `.match()` method.
 *
 * @example
 * const filter = toSupabaseMatch({
 *   scopeId: activeOrgId,
 *   scopeKey: 'org_id',
 *   userId: currentUserId,
 *   userKey: 'author_id',
 *   isRestrictedRole: !isAdmin,
 * });
 *
 * const { data } = await supabase.from('posts').select().match(filter);
 */
export function toSupabaseMatch(options: ScopeFilterOptions): SupabaseMatchFilter {
  const match: SupabaseMatchFilter = {};

  if (options.scopeId !== undefined && options.scopeId !== null) {
    match[options.scopeKey || 'scopeId'] = options.scopeId;
  }

  if (options.isRestrictedRole && options.userId !== undefined && options.userId !== null) {
    match[options.userKey || 'userId'] = options.userId;
  }

  return match;
}

/**
 * Applies scope and ownership filters directly to a Supabase or PostgREST query builder.
 *
 * @example
 * let query = supabase.from('receipts').select('*');
 * query = applySupabaseScope(query, {
 *   scopeId: activeBusinessId,
 *   scopeKey: 'business_id',
 *   userId: currentTenantId,
 *   userKey: 'tenant_id',
 *   isRestrictedRole: isTenantOnly,
 * });
 *
 * const { data } = await query;
 */
export function applySupabaseScope<T extends FilterableQuery>(
  query: T,
  options: ScopeFilterOptions
): T {
  let modifiedQuery = query;

  if (options.scopeId !== undefined && options.scopeId !== null) {
    modifiedQuery = modifiedQuery.eq(options.scopeKey || 'scopeId', options.scopeId);
  }

  if (options.isRestrictedRole && options.userId !== undefined && options.userId !== null) {
    modifiedQuery = modifiedQuery.eq(options.userKey || 'userId', options.userId);
  }

  return modifiedQuery;
}
