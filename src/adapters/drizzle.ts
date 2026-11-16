import type { ScopeFilterOptions } from '../scoping';
import { buildScopeFilter } from '../scoping';

export interface DrizzleOperators<TResult = any> {
  eq: (column: any, value: any) => TResult;
  and: (...conditions: (TResult | undefined)[]) => TResult;
}

/**
 * Generates a Drizzle ORM where condition combining partition scope and optional user ownership.
 *
 * @param table - The Drizzle table object or column mapping
 * @param options - Scope and ownership options
 * @param operators - Drizzle's `eq` and `and` operators
 * @returns Combined Drizzle condition expression or undefined if no criteria
 */
export function toDrizzleWhere<TTable extends Record<string, any>, TResult = any>(
  table: TTable,
  options: ScopeFilterOptions,
  operators: DrizzleOperators<TResult>
): TResult | undefined {
  const filter = buildScopeFilter({
    ...options,
    isRestrictedRole: options.isRestrictedRole ?? true,
  });

  const validConditions = Object.entries(filter)
    .map(([key, value]) => {
      if (table[key] === undefined) {
        throw new Error(`Drizzle table does not contain column "${key}".`);
      }
      return operators.eq(table[key], value);
    })
    .filter((c): c is TResult => c !== undefined);

  if (validConditions.length === 0) {
    return undefined;
  }

  if (validConditions.length === 1) {
    return validConditions[0];
  }

  return operators.and(...validConditions);
}
