import type { ScopeFilterOptions } from '../scoping';
import { buildScopeFilter } from '../scoping';

/**
 * Generates a MongoDB / Mongoose filter query object based on partition scope and user ownership.
 */
export function toMongoFilter<T = Record<string, any>>(options: ScopeFilterOptions): T {
  return buildScopeFilter(options) as T;
}
