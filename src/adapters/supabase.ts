import type { ScopeFilterOptions } from '../scoping';
import { buildScopeFilter } from '../scoping';

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
  return buildScopeFilter(options);
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
  for (const [column, value] of Object.entries(buildScopeFilter(options))) {
    modifiedQuery = modifiedQuery.eq(column, value);
  }
  return modifiedQuery;
}
